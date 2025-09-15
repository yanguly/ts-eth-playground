// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import {YansTokenUUPSV2} from "../src/YansTokenUUPSV2.sol";

// --- Minimal interfaces ---
interface IUUPS {
    function upgradeTo(address newImplementation) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function proxiableUUID() external view returns (bytes32);
}

interface IERC20Like {
    function owner() external view returns (address);
    function mint(address to, uint256 amount) external;
}

contract UpgradeUUPS is Script {
    // EIP-1967 implementation slot constant
    bytes32 private constant EIP1967_IMPL_SLOT =
        0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    // Env keys
    string private constant ENV_TOKEN_ADDRESS = "TOKEN_ADDRESS";
    string private constant ENV_PRIVATE_KEY = "PRIVATE_KEY";
    string private constant ENV_IMPL_V2 = "IMPL_V2";
    string private constant ENV_MINT_TO = "MINT_TO";
    string private constant ENV_MINT_AMOUNT = "MINT_AMOUNT";

    function run() external {
        // Inputs
        address proxy = _readProxyFromEnv();
        address signer = _readSigner();

        console2.log("Proxy:", proxy);
        console2.log("Signer:", signer);

        // Authorization: signer must be the owner
        _assertSignerIsOwner(proxy, signer);

        // Current implementation
        address implBefore = _getImplementation(proxy);
        console2.log("Impl(before):", implBefore);

        // Obtain V2 implementation (from env or freshly deployed)
        address implV2 = _getOrDeployImplV2(signer);

        // Sanity: new implementation must be UUPS-compliant
        _assertUUPSImplementation(implV2);

        // Perform upgrade
        _upgradeProxy(proxy, implV2, signer);

        // Verify implementation changed
        address implAfter = _getImplementation(proxy);
        console2.log("Impl(after):", implAfter);
        require(implAfter == implV2, "Implementation not updated");

        // Optional post-upgrade mint
        _maybeMint(proxy, signer);
    }

    // --- Orchestration helpers ---
    function _readProxyFromEnv() private view returns (address proxy) {
        // Keep using string + parse to preserve original behavior
        string memory proxyStr = _envStringOrRevert(ENV_TOKEN_ADDRESS);
        proxy = vm.parseAddress(proxyStr);
    }

    function _readSigner() private view returns (address signer) {
        bytes32 pk = vm.envBytes32(ENV_PRIVATE_KEY);
        signer = vm.addr(uint256(pk));
    }

    function _assertSignerIsOwner(address proxy, address signer) private view {
        address owner = IERC20Like(proxy).owner();
        console2.log("Owner:", owner);
        require(signer == owner, "Signer is not owner");
    }

    function _getOrDeployImplV2(address signer) private returns (address implV2) {
        // Prefer env-provided implementation when available
        try vm.envAddress(ENV_IMPL_V2) returns (address a) {
            implV2 = a;
            console2.log("Using IMPL_V2 from env:", implV2);
        } catch {
            _beginAs(signer);
            implV2 = address(new YansTokenUUPSV2());
            _endAs();
            console2.log("Deployed IMPL_V2:", implV2);
        }
    }

    function _assertUUPSImplementation(address impl) private view {
        require(IUUPS(impl).proxiableUUID() == EIP1967_IMPL_SLOT, "Not UUPS impl");
    }

    function _upgradeProxy(address proxy, address newImpl, address signer) private {
        _beginAs(signer);

        // Try upgradeTo first; fallback to upgradeToAndCall with empty data
        (bool ok,) = address(proxy).call(
            abi.encodeWithSelector(IUUPS.upgradeTo.selector, newImpl)
        );
        if (!ok) {
            (ok,) = address(proxy).call(
                abi.encodeWithSelector(IUUPS.upgradeToAndCall.selector, newImpl, bytes(""))
            );
            require(ok, "upgrade reverted");
            console2.log("upgradeToAndCall: OK");
        } else {
            console2.log("upgradeTo: OK");
        }

        _endAs();
    }

    function _maybeMint(address proxy, address signer) private {
        (bool hasTo, string memory toStr) = _tryEnvString(ENV_MINT_TO);
        (bool hasAmt, string memory amtStr) = _tryEnvString(ENV_MINT_AMOUNT);
        if (!(hasTo && hasAmt)) return;

        address to = vm.parseAddress(toStr);
        uint256 amount = vm.parseUint(amtStr); // accepts decimal or 0x-hex

        _beginAs(signer);
        IERC20Like(proxy).mint(to, amount);
        _endAs();
        console2.log("Minted (raw):", amount, "to:", to);
    }

    // Use broadcast in script context; fallback to prank in test context.
    function _beginAs(address signer) private {
        try vm.startBroadcast(signer) { } catch { vm.startPrank(signer); }
    }
    function _endAs() private {
        try vm.stopBroadcast() { } catch { vm.stopPrank(); }
    }

    // --- Utilities (no external calls other than vm) ---
    function _getImplementation(address proxy) private view returns (address impl) {
        bytes32 word = vm.load(proxy, EIP1967_IMPL_SLOT);
        impl = address(uint160(uint256(word)));
    }

    function _envStringOrRevert(string memory key) private view returns (string memory s) {
        try vm.envString(key) returns (string memory v) { return v; } catch {}
        revert(string(abi.encodePacked("Missing env: ", key)));
    }

    function _tryEnvString(string memory key) private view returns (bool ok, string memory v) {
        try vm.envString(key) returns (string memory s) { return (true, s); } catch { return (false, ""); }
    }
}
