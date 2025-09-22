// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import 'forge-std/Script.sol';
import {Upgrades} from 'openzeppelin-foundry-upgrades/Upgrades.sol';
import {Options} from 'openzeppelin-foundry-upgrades/Options.sol';

contract ValidateUpgrade is Script {
  function run() external {
    string memory newImpl = _normalizeArtifact(vm.envString("NEW_IMPL_CONTRACT"));

    Options memory opts;
    string memory referenceFqn = _tryEnv("REFERENCE_CONTRACT");
    if (bytes(referenceFqn).length != 0) {
      opts.referenceContract = _normalizeArtifact(referenceFqn);
    }

    Upgrades.validateUpgrade(newImpl, opts);

    console2.log("Upgrade validated");
    console2.log("New impl contract:", newImpl);
    if (bytes(opts.referenceContract).length != 0) {
      console2.log("Reference contract:", opts.referenceContract);
    }
  }

  function _tryEnv(string memory key) internal view returns (string memory val) {
    bytes4 sel = bytes4(keccak256("envString(string)"));
    (bool ok, bytes memory ret) = address(vm).staticcall(abi.encodeWithSelector(sel, key));
    if (ok) return abi.decode(ret, (string));
    return "";
  }

  function _normalizeArtifact(string memory name) internal pure returns (string memory) {
    bytes memory b = bytes(name);
    string[2] memory prefixes = ["contracts/", "src/"];
    for (uint256 p = 0; p < prefixes.length; p++) {
      bytes memory pref = bytes(prefixes[p]);
      if (b.length >= pref.length) {
        bool matches = true;
        for (uint256 i = 0; i < pref.length; i++) {
          if (b[i] != pref[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          bytes memory out = new bytes(b.length - pref.length);
          for (uint256 j = 0; j < out.length; j++) {
            out[j] = b[j + pref.length];
          }
          return string(out);
        }
      }
    }
    return name;
  }
}
