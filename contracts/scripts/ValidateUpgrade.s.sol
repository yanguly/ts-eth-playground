// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import 'forge-std/Script.sol';
import {Upgrades} from 'openzeppelin-foundry-upgrades/Upgrades.sol';

contract ValidateUpgrade is Script {
  function run() external {
    address proxy = vm.parseAddress(vm.envString('TOKEN_ADDRESS'));
    address impl = vm.envAddress('IMPL_NEW');
    Upgrades.validateUpgrade(proxy, impl);
    console2.log('Upgrade validated for proxy:', proxy);
    console2.log('New implementation:', impl);
  }
}
