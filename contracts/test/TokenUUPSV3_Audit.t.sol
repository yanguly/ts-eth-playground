// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';
import {YansTokenUUPSV3} from '../src/YansTokenUUPSv3.sol';

contract TokenUUPSV3_Audit is Test {
  uint256 internal OWNER_PK = 0xA11CE;
  address internal owner;
  address internal spender;
  ERC1967Proxy internal proxy;

  function setUp() public {
    owner = vm.addr(OWNER_PK);
    spender = vm.addr(0xB0B);
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

  function testOnlyProxy_RevertsOnImplementationCall_V3() public {
    YansTokenUUPSV3 impl = new YansTokenUUPSV3();
    vm.expectRevert();
    impl.upgradeToAndCall(address(impl), '');
  }

  function testUpgradeToV3_WithData_Init_RunsOnce() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    YansTokenUUPSV3 implV3 = new YansTokenUUPSV3();
    vm.prank(owner);
    token.upgradeToAndCall(
      address(implV3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, owner)
    );
    // roles set
    assertTrue(
      YansTokenUUPSV3(address(token)).hasRole(
        YansTokenUUPSV3(address(token)).DEFAULT_ADMIN_ROLE(),
        owner
      )
    );
    assertTrue(
      YansTokenUUPSV3(address(token)).hasRole(YansTokenUUPSV3(address(token)).PAUSER_ROLE(), owner)
    );
    // second init reverts
    vm.prank(owner);
    vm.expectRevert(abi.encodeWithSignature('InvalidInitialization()'));
    YansTokenUUPSV3(address(token)).initializeV3(owner);
  }

  function testStorageLayout_Preserved_V3_and_MintStillWorks() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    uint256 tsBefore = token.totalSupply();
    address ownerBefore = token.owner();
    uint256 ownerBalBefore = token.balanceOf(owner);

    // upgrade to v3
    YansTokenUUPSV3 implV3 = new YansTokenUUPSV3();
    vm.prank(owner);
    token.upgradeToAndCall(
      address(implV3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, owner)
    );

    assertEq(token.totalSupply(), tsBefore);
    assertEq(token.owner(), ownerBefore);
    assertEq(token.balanceOf(owner), ownerBalBefore);

    // v2's mint still available (onlyOwner)
    vm.prank(owner);
    YansTokenUUPSV2(address(token)).mint(spender, 1 ether);
    assertEq(token.balanceOf(spender), 1 ether);
  }

  function testV3_Pause_Unpause() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    vm.prank(owner);
    token.transfer(spender, 10 ether);
    // upgrade + init
    YansTokenUUPSV3 implV3 = new YansTokenUUPSV3();
    vm.prank(owner);
    token.upgradeToAndCall(
      address(implV3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, owner)
    );

    // owner has pauser role
    vm.prank(owner);
    YansTokenUUPSV3(address(token)).pause();
    vm.prank(spender);
    vm.expectRevert();
    YansTokenUUPSV3(address(token)).transfer(owner, 1 ether);

    vm.prank(owner);
    YansTokenUUPSV3(address(token)).unpause();
    vm.prank(spender);
    YansTokenUUPSV3(address(token)).transfer(owner, 1 ether);
  }

  function testPermit_PositiveFlow_AfterV3() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    // upgrade to v3
    YansTokenUUPSV3 implV3 = new YansTokenUUPSV3();
    vm.prank(owner);
    token.upgradeToAndCall(
      address(implV3),
      abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, owner)
    );

    uint256 value = 5 ether;
    uint256 nonce = token.nonces(owner);
    uint256 deadline = block.timestamp + 1 days;

    bytes32 TYPEHASH = keccak256(
      'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
    );
    bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
    bytes32 structHash = keccak256(abi.encode(TYPEHASH, owner, spender, value, nonce, deadline));
    bytes32 digest = keccak256(abi.encodePacked('\x19\x01', domainSeparator, structHash));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, digest);

    token.permit(owner, spender, value, deadline, v, r, s);
    assertEq(token.allowance(owner, spender), value);
    assertEq(token.nonces(owner), nonce + 1);
  }
}
