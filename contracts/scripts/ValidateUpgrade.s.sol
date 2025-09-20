// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import 'forge-std/Script.sol';
import {Upgrades} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Options} from 'openzeppelin-foundry-upgrades/Options.sol';

contract ValidateUpgrade is Script {
  function run() external {
    // Proxy address (for context/logging only). Do not hard-fail on invalid env.
    address proxy = address(0);
    string memory proxyEnv = _tryEnv("TOKEN_ADDRESS");
    if (bytes(proxyEnv).length != 0) {
      // parseAddress(string) may revert; call defensively.
      bytes4 sel = bytes4(keccak256("parseAddress(string)"));
      (bool ok, bytes memory ret) = address(vm).staticcall(abi.encodeWithSelector(sel, proxyEnv));
      if (ok) {
        proxy = abi.decode(ret, (address));
      } else {
        console2.log("WARN: TOKEN_ADDRESS invalid; proceeding with 0x0 context");
      }
    }

    // New implementation contract to validate, provided as an artifact name/path.
    // Examples: "contracts/src/YansTokenUUPSV2.sol:YansTokenUUPSV2" or "YansTokenUUPSV3.sol:YansTokenUUPSV3"
    string memory newImplContract = vm.envString("NEW_IMPL_CONTRACT");
    newImplContract = _normalizeArtifact(newImplContract);

    // Optional: reference contract for storage/layout comparison (artifact name/path).
    // If not provided, the library will try to use @custom:oz-upgrades-from annotation in the new contract.
    Options memory opts;
    string memory ref = _tryEnv("REFERENCE_CONTRACT");
    if (bytes(ref).length != 0) {
      opts.referenceContract = _normalizeArtifact(ref);
    }

    Upgrades.validateUpgrade(newImplContract, opts);

    console2.log("Upgrade validated");
    console2.log("Proxy (for context):", proxy);
    console2.log("New impl contract:", newImplContract);
    if (bytes(opts.referenceContract).length != 0) {
      console2.log("Reference contract:", opts.referenceContract);
    }

    // Back-compat note if an address was supplied in IMPL_NEW (not used by validateUpgrade)
    string memory maybeAddr = _tryEnv("IMPL_NEW");
    if (bytes(maybeAddr).length != 0 && _looksLikeAddress(maybeAddr)) {
      console2.log("Note: IMPL_NEW was provided as an address and ignored by validateUpgrade.");
      console2.log("      Pass artifact name in NEW_IMPL_CONTRACT instead.");
    }
  }

  // Helper: attempt to read an env var as string without reverting, via direct cheatcode call.
  function _tryEnv(string memory key) internal view returns (string memory val) {
    // Use explicit selector to avoid overload ambiguity on Vm.envString
    bytes4 sel = bytes4(keccak256("envString(string)"));
    (bool ok, bytes memory ret) = address(vm).staticcall(abi.encodeWithSelector(sel, key));
    if (ok) return abi.decode(ret, (string));
    return "";
  }

  function _looksLikeAddress(string memory s) internal pure returns (bool) {
    bytes memory b = bytes(s);
    if (b.length != 42) return false;
    if (b[0] != '0' || (b[1] != 'x' && b[1] != 'X')) return false;
    for (uint256 i = 2; i < 42; i++) {
      bytes1 c = b[i];
      bool isHex =
        (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
      if (!isHex) return false;
    }
    return true;
  }

  // Normalize artifact identifiers passed with an extra leading "contracts/" prefix
  // when the Foundry project root is already the contracts/ folder.
  function _normalizeArtifact(string memory name) internal pure returns (string memory) {
    bytes memory b = bytes(name);
    bytes memory pref = bytes("contracts/");
    if (b.length >= pref.length) {
      bool matchPref = true;
      for (uint256 i = 0; i < pref.length; i++) {
        if (b[i] != pref[i]) { matchPref = false; break; }
      }
      if (matchPref) {
        bytes memory out = new bytes(b.length - pref.length);
        for (uint256 j = 0; j < out.length; j++) {
          out[j] = b[j + pref.length];
        }
        return string(out);
      }
    }
    return name;
  }
}
