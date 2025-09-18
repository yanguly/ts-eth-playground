// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';

contract UpgradeInvariantsTest is Test {
  YansTokenUUPS implV1;
  ERC1967Proxy proxy;
  YansTokenUUPS token;
  address owner = address(0xA11CE);
  address user = address(0xB0B);

  function setUp() public {
    implV1 = new YansTokenUUPS();
    bytes memory init = abi.encodeWithSelector(
      YansTokenUUPS.initialize.selector,
      'YAN',
      'YAN',
      owner,
      1_000_000 ether
    );
    proxy = new ERC1967Proxy(address(implV1), init);
    token = YansTokenUUPS(address(proxy));
    vm.prank(owner);
    token.transfer(user, 100 ether);
  }

  function test_UpgradePreservesStateAndOwner_AndEnablesV2() public {
    uint256 ts = token.totalSupply();
    uint8 d = token.decimals();
    string memory n = token.name();
    string memory s = token.symbol();
    address o = token.owner();
    uint256 balUser = token.balanceOf(user);

    YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
    vm.prank(o);
    token.upgradeToAndCall(address(implV2), '');

    assertEq(token.totalSupply(), ts);
    assertEq(token.decimals(), d);
    assertEq(token.owner(), o);
    assertEq(keccak256(bytes(token.name())), keccak256(bytes(n)));
    assertEq(keccak256(bytes(token.symbol())), keccak256(bytes(s)));
    assertEq(token.balanceOf(user), balUser);

    vm.prank(o);
    YansTokenUUPSV2(address(token)).mint(user, 1 ether);
    assertEq(token.balanceOf(user), balUser + 1 ether);
  }
}
