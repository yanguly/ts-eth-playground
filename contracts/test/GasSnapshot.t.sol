// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';
import {YansTokenUUPSV3} from '../src/YansTokenUUPSv3.sol';

contract GasSnapshot is Test {
  address internal owner;
  ERC1967Proxy internal proxy;

  function setUp() public {
    owner = vm.addr(0xA11CE);
    YansTokenUUPS impl = new YansTokenUUPS();
    bytes memory data = abi.encodeWithSelector(
      YansTokenUUPS.initialize.selector,
      'YAN',
      'YAN',
      owner,
      1_000_000 ether
    );
    vm.prank(owner);
    proxy = new ERC1967Proxy(address(impl), data);
  }

  function testGas_Upgrade_V1_to_V2() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    YansTokenUUPSV2 v2 = new YansTokenUUPSV2();
    vm.prank(owner);
    token.upgradeToAndCall(address(v2), '');
  }

  function testGas_Upgrade_V2_to_V3_withInit() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    // Ensure we are owner
    assertEq(token.owner(), owner, 'unexpected owner');

    // Do both upgrades from the owner context
    vm.startPrank(owner);
    token.upgradeToAndCall(address(new YansTokenUUPSV2()), '');
    YansTokenUUPSV3 v3 = new YansTokenUUPSV3();
    token.upgradeToAndCall(
      address(v3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, owner)
    );
    vm.stopPrank();
  }
}
