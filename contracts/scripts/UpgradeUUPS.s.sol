// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import 'forge-std/Script.sol';
import {YansTokenUUPSV4} from '../src/YansTokenUUPSV4.sol';

// --- Minimal interfaces ---
interface IUUPS {
  function upgradeTo(address newImplementation) external;
  function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
  function proxiableUUID() external view returns (bytes32);
}

interface IERC20Ownable {
  function owner() external view returns (address);
}

contract UpgradeUUPS is Script {
  // EIP-1967 implementation slot constant
  bytes32 private constant EIP1967_IMPL_SLOT =
    0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

  // Env keys
  string private constant ENV_TOKEN_ADDRESS = 'TOKEN_ADDRESS';
  string private constant ENV_PRIVATE_KEY = 'PRIVATE_KEY';
  string private constant ENV_IMPL_NEW = 'IMPL_NEW';
  string private constant ENV_ADMIN = 'ADMIN_ADDRESS';
  string private constant ENV_MINTER = 'MINTER_ADDRESS';
  string private constant ENV_BURNER = 'BURNER_ADDRESS';
  string private constant ENV_GOVERNOR = 'GOVERNOR_ADDRESS';
  string private constant ENV_CAP = 'SUPPLY_CAP_WEI';

  function run() external {
    // Inputs
    address proxy = _readProxyFromEnv();
    address signer = _readSigner();

    console2.log('Proxy:', proxy);
    console2.log('Signer:', signer);

    // Authorization: signer must be the owner
    _assertSignerIsOwner(proxy, signer);

    // Current implementation
    address implBefore = _getImplementation(proxy);
    console2.log('Impl(before):', implBefore);

    // Obtain V4 implementation (from env or freshly deployed)
    address implV4 = _getOrDeployImplNew(signer);
    bytes memory initData = _buildInitializeData();

    // Sanity: new implementation must be UUPS-compliant
    _assertUUPSImplementation(implV4);

    // Perform upgrade
    _upgradeProxy(proxy, implV4, signer, initData);

    // Verify implementation changed
    address implAfter = _getImplementation(proxy);
    console2.log('Impl(after):', implAfter);
    require(implAfter == implV4, 'Implementation not updated');

    console2.log('Upgrade complete');
  }

  // --- Orchestration helpers ---
  function _readProxyFromEnv() private view returns (address proxy) {
    // Keep using string + parse to preserve original behavior
    proxy = vm.parseAddress(vm.envString(ENV_TOKEN_ADDRESS));
  }

  function _readSigner() private view returns (address signer) {
    bytes32 pk = vm.envBytes32(ENV_PRIVATE_KEY);
    signer = vm.addr(uint256(pk));
  }

  function _assertSignerIsOwner(address proxy, address signer) private view {
    address owner = IERC20Ownable(proxy).owner();
    console2.log('Owner:', owner);
    require(signer == owner, 'Signer is not owner');
  }

  function _getOrDeployImplNew(address signer) private returns (address impl) {
    try vm.envAddress(ENV_IMPL_NEW) returns (address a) {
      impl = a;
      console2.log('Using IMPL_NEW from env:', impl);
    } catch {
      _beginAs(signer);
      impl = address(new YansTokenUUPSV4());
      _endAs();
      console2.log('Deployed IMPL_NEW:', impl);
    }
  }

  function _buildInitializeData() private view returns (bytes memory) {
    address admin = vm.envAddress(ENV_ADMIN);
    address minter = vm.envAddress(ENV_MINTER);
    address burner = vm.envAddress(ENV_BURNER);
    address governor = vm.envAddress(ENV_GOVERNOR);
    uint256 cap = vm.envUint(ENV_CAP); // zero disables the cap, mirroring contract semantics

    require(admin != address(0), 'admin not set');
    require(minter != address(0), 'minter not set');
    require(burner != address(0), 'burner not set');
    require(governor != address(0), 'governor not set');

    return abi.encodeWithSelector(
      YansTokenUUPSV4.initializeV4.selector,
      admin,
      minter,
      burner,
      governor,
      cap
    );
  }

  function _assertUUPSImplementation(address impl) private view {
    require(IUUPS(impl).proxiableUUID() == EIP1967_IMPL_SLOT, 'Not UUPS impl');
  }

  function _upgradeProxy(address proxy, address newImpl, address signer, bytes memory initData) private {
    _beginAs(signer);

    // Prefer OZ v5 path first (upgradeToAndCall), fallback to upgradeTo if needed
    (bool ok, ) = address(proxy).call(
      abi.encodeWithSelector(IUUPS.upgradeToAndCall.selector, newImpl, initData)
    );
    if (!ok) {
      (ok, ) = address(proxy).call(abi.encodeWithSelector(IUUPS.upgradeTo.selector, newImpl));
      require(ok, 'upgrade reverted');
      console2.log('upgradeTo: OK');
    } else {
      console2.log('upgradeToAndCall: OK');
    }

    _endAs();
  }

  // Use broadcast in script context; fallback to prank in test context.
  function _beginAs(address signer) private {
    try vm.startBroadcast(signer) {} catch {
      vm.startPrank(signer);
    }
  }
  function _endAs() private {
    try vm.stopBroadcast() {} catch {
      vm.stopPrank();
    }
  }

  // --- Utilities (no external calls other than vm) ---
  function _getImplementation(address proxy) private view returns (address impl) {
    bytes32 word = vm.load(proxy, EIP1967_IMPL_SLOT);
    impl = address(uint160(uint256(word)));
  }

}
