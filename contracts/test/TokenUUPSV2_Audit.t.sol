// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';

contract V2_WithReinit is YansTokenUUPSV2 {
  uint256 public extra;
  function migrateV2() external reinitializer(2) {
    extra = 42;
  }
}

contract V2_WithStorage is YansTokenUUPSV2 {
  uint256 public foo;
  function setFoo(uint256 v) external onlyOwner {
    foo = v;
  }
}

contract TokenUUPSV2_Audit is Test {
  bytes32 constant SLOT_IMPL = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;
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

  function _impl() internal view returns (address) {
    bytes32 word = vm.load(address(proxy), SLOT_IMPL);
    return address(uint160(uint256(word)));
  }

  function testOnlyProxy_RevertsOnImplementationCall_V2() public {
    YansTokenUUPSV2 impl = new YansTokenUUPSV2();
    vm.expectRevert();
    impl.upgradeToAndCall(address(impl), '');
  }

  function testReinitialize_Reverts_OnProxy() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    vm.prank(owner);
    vm.expectRevert(abi.encodeWithSignature('InvalidInitialization()'));
    token.initialize('YAN', 'YAN', owner, 1);
  }

  function testUpgrade_WithData_Reinitializer2_runs_once() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    V2_WithReinit v2 = new V2_WithReinit();
    vm.prank(owner);
    token.upgradeToAndCall(address(v2), abi.encodeWithSelector(V2_WithReinit.migrateV2.selector));
    assertEq(V2_WithReinit(address(token)).extra(), 42);
    vm.prank(owner);
    vm.expectRevert();
    token.upgradeToAndCall(address(v2), abi.encodeWithSelector(V2_WithReinit.migrateV2.selector));
  }

  function testUpgrade_EOA_Reverts() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    address eoa = vm.addr(123);
    vm.prank(owner);
    vm.expectRevert();
    token.upgradeToAndCall(eoa, '');
  }

  function testStorageLayout_Preserved_V2() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    uint256 tsBefore = token.totalSupply();
    address ownerBefore = token.owner();
    uint256 ownerBalBefore = token.balanceOf(owner);

    V2_WithStorage v2 = new V2_WithStorage();
    vm.prank(owner);
    token.upgradeToAndCall(address(v2), '');

    vm.prank(owner);
    V2_WithStorage(address(token)).setFoo(777);
    assertEq(V2_WithStorage(address(token)).foo(), 777);

    assertEq(token.totalSupply(), tsBefore);
    assertEq(token.owner(), ownerBefore);
    assertEq(token.balanceOf(owner), ownerBalBefore);
  }

  function testPermit_PositiveFlow_AfterV2() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
    vm.prank(owner);
    token.upgradeToAndCall(address(implV2), '');

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

  function testV2_Mint_OnlyOwner() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
    vm.prank(owner);
    token.upgradeToAndCall(address(implV2), '');

    uint256 beforeBal = token.balanceOf(spender);
    vm.prank(owner);
    YansTokenUUPSV2(address(token)).mint(spender, 1 ether);
    assertEq(token.balanceOf(spender), beforeBal + 1 ether);

    vm.prank(spender);
    vm.expectRevert();
    YansTokenUUPSV2(address(token)).mint(spender, 1 ether);
  }
}
