// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';
import {YansTokenUUPSV3} from '../src/YansTokenUUPSv3.sol';

contract TokenUUPSv3_Test is Test {
  address internal owner;
  address internal user;
  ERC1967Proxy internal proxy;

  function setUp() public {
    owner = vm.addr(0xA11CE);
    user = vm.addr(0xB0B);

    YansTokenUUPS implV1 = new YansTokenUUPS();
    bytes memory data = abi.encodeWithSelector(
      YansTokenUUPS.initialize.selector,
      'YAN',
      'YAN',
      owner,
      1_000_000 ether
    );
    vm.prank(owner);
    proxy = new ERC1967Proxy(address(implV1), data);
  }

  function _asV1() internal view returns (YansTokenUUPS) {
    return YansTokenUUPS(address(proxy));
  }

  function _upgradeToV3AndInit(address admin) internal returns (YansTokenUUPSV3 v3) {
    YansTokenUUPS token = _asV1();
    YansTokenUUPSV3 implV3 = new YansTokenUUPSV3();
    vm.prank(owner);
    token.upgradeToAndCall(
      address(implV3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, admin)
    );
    v3 = YansTokenUUPSV3(address(token));
  }

  function testV3_UpgradeAndInit_Roles_PauseUnpause() public {
    YansTokenUUPS token = _asV1();
    // fund user to exercise transfers
    vm.prank(owner);
    token.transfer(user, 100 ether);

    YansTokenUUPSV3 v3 = _upgradeToV3AndInit(owner);

    // Roles set for admin
    assertTrue(v3.hasRole(v3.DEFAULT_ADMIN_ROLE(), owner));
    assertTrue(v3.hasRole(v3.PAUSER_ROLE(), owner));

    // Pause blocks transfers
    vm.prank(owner);
    v3.pause();
    vm.prank(owner);
    vm.expectRevert();
    v3.transfer(user, 1 ether);

    // Unpause restores transfers
    vm.prank(owner);
    v3.unpause();
    uint256 before = token.balanceOf(user);
    vm.prank(owner);
    v3.transfer(user, 1 ether);
    assertEq(token.balanceOf(user), before + 1 ether);
  }

  function testV3_Paused_Disallows_Transfer_Burn_BurnFrom() public {
    YansTokenUUPS token = _asV1();
    // prepare balances & allowance
    vm.prank(owner);
    token.transfer(user, 20 ether);

    YansTokenUUPSV3 v3 = _upgradeToV3AndInit(owner);

    vm.prank(owner);
    v3.pause();

    // transfer reverts when paused
    vm.prank(user);
    vm.expectRevert();
    v3.transfer(owner, 1 ether);

    // burn reverts when paused
    vm.prank(user);
    vm.expectRevert();
    v3.burn(1 ether);

    // burnFrom reverts when paused
    vm.prank(owner);
    v3.approve(user, 1 ether);
    vm.prank(user);
    vm.expectRevert();
    v3.burnFrom(owner, 1 ether);
  }

  function testV3_Burn_And_BurnFrom() public {
    YansTokenUUPS token = _asV1();
    // give user some tokens
    vm.prank(owner);
    token.transfer(user, 50 ether);

    YansTokenUUPSV3 v3 = _upgradeToV3AndInit(owner);

    // burn by holder
    uint256 tsBefore = token.totalSupply();
    uint256 userBefore = token.balanceOf(user);
    vm.prank(user);
    v3.burn(10 ether);
    assertEq(token.balanceOf(user), userBefore - 10 ether);
    assertEq(token.totalSupply(), tsBefore - 10 ether);

    // burnFrom with allowance
    vm.prank(owner);
    v3.approve(user, 5 ether);
    vm.prank(user);
    v3.burnFrom(owner, 5 ether);
    assertEq(token.balanceOf(owner), (1_000_000 ether - 50 ether) - 5 ether);
  }

  function testV3_Initialize_OnlyOnce() public {
    YansTokenUUPSV3 v3 = _upgradeToV3AndInit(owner);
    vm.prank(owner);
    vm.expectRevert(abi.encodeWithSignature('InvalidInitialization()'));
    v3.initializeV3(owner);
  }

  function testV3_OnlyPauserRole_CanPause() public {
    YansTokenUUPSV3 v3 = _upgradeToV3AndInit(owner);
    // user without role cannot pause
    vm.prank(user);
    vm.expectRevert();
    v3.pause();
  }
}
