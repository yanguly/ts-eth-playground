// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV4} from '../src/YansTokenUUPSV4.sol';
import {UpgradeUUPS} from '../scripts/UpgradeUUPS.s.sol';

contract UpgradeUUPSScriptTest is Test {
  bytes32 private constant SLOT =
    0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;
  bytes32 private constant TEST_PK = bytes32(uint256(0xA11CE));

  address private signer;

  address private constant ADMIN = address(0xA11CE);
  address private constant MINTER = address(0xA11CF);
  address private constant BURNER = address(0xA11D0);
  address private constant GOVERNOR = address(0xA11D1);
  uint256 private constant CAP_UNLIMITED = 0;

  function setUp() public {
    signer = vm.addr(uint256(TEST_PK));

    vm.setEnv('PRIVATE_KEY', vm.toString(TEST_PK));
    vm.setEnv('ADMIN_ADDRESS', vm.toString(ADMIN));
    vm.setEnv('MINTER_ADDRESS', vm.toString(MINTER));
    vm.setEnv('BURNER_ADDRESS', vm.toString(BURNER));
    vm.setEnv('GOVERNOR_ADDRESS', vm.toString(GOVERNOR));
    vm.setEnv('SUPPLY_CAP_WEI', vm.toString(CAP_UNLIMITED));
    vm.setEnv('IMPL_NEW', '0x'); // default to fallback deployment path
  }

  function test_Run_RevertsWhenSignerNotOwner() public {
    address proxy = _deployProxyOwnedBy(address(0xB0B));
    _seedProxyEnv(proxy);

    UpgradeUUPS script = new UpgradeUUPS();
    vm.expectRevert(bytes('Signer is not owner'));
    script.run();
  }

  function test_Run_DeploysImplementationWhenEnvMissing() public {
    address proxy = _deployProxyOwnedBy(signer);
    _seedProxyEnv(proxy);

    new UpgradeUUPS().run();

    address impl = _impl(proxy);
    assertEq(YansTokenUUPSV4(impl).proxiableUUID(), SLOT);
    assertEq(YansTokenUUPSV4(proxy).cap(), CAP_UNLIMITED);

    bytes32 minterRole = YansTokenUUPSV4(proxy).MINTER_ROLE();
    bytes32 burnerRole = YansTokenUUPSV4(proxy).BURNER_ROLE();
    bytes32 governorRole = YansTokenUUPSV4(proxy).GOVERNOR_ROLE();
    assertTrue(YansTokenUUPSV4(proxy).hasRole(minterRole, MINTER));
    assertTrue(YansTokenUUPSV4(proxy).hasRole(burnerRole, BURNER));
    assertTrue(YansTokenUUPSV4(proxy).hasRole(governorRole, GOVERNOR));
  }

  function test_Run_UsesProvidedImplementation() public {
    address proxy = _deployProxyOwnedBy(signer);
    _seedProxyEnv(proxy);

    address implOverride = address(new YansTokenUUPSV4());
    vm.setEnv('IMPL_NEW', vm.toString(implOverride));

    new UpgradeUUPS().run();

    assertEq(_impl(proxy), implOverride);
  }

  function _deployProxyOwnedBy(address owner_) private returns (address proxyAddr) {
    YansTokenUUPS implV1 = new YansTokenUUPS();
    bytes memory initData = abi.encodeWithSelector(
      YansTokenUUPS.initialize.selector,
      'YAN',
      'YAN',
      address(0xBEEF),
      1_000 ether
    );
    vm.prank(owner_);
    ERC1967Proxy proxy = new ERC1967Proxy(address(implV1), initData);
    proxyAddr = address(proxy);
  }

  function _impl(address proxyAddr) private view returns (address impl) {
    bytes32 word = vm.load(proxyAddr, SLOT);
    impl = address(uint160(uint256(word)));
  }

  function _seedProxyEnv(address proxy) private {
    vm.setEnv('TOKEN_ADDRESS', vm.toString(proxy));
  }
}
