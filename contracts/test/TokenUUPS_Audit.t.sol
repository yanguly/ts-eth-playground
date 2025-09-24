// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from 'forge-std/Test.sol';
import {ERC1967Proxy} from '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

import {YansTokenUUPS} from '../src/YansTokenUUPS.sol';
import {YansTokenUUPSV2} from '../src/YansTokenUUPSV2.sol';

contract V2WithReinit is YansTokenUUPS {
  uint256 public extra;
  function migrate() external reinitializer(2) {
    extra = 42;
  }
}

contract V2WithStorage is YansTokenUUPS {
  uint256 public foo;
  function setFoo(uint256 v) external onlyOwner {
    foo = v;
  }
}

contract TokenUUPS_Audit is Test {
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

  function testOnlyProxy_RevertsOnImplementationCall() public {
    YansTokenUUPS impl = new YansTokenUUPS();
    // Direct call to upgrade on the implementation (not via proxy) should revert (onlyProxy)
    vm.expectRevert();
    impl.upgradeToAndCall(address(impl), '');
  }

  function testReinitialize_Reverts() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    vm.prank(owner);
    vm.expectRevert(abi.encodeWithSignature('InvalidInitialization()'));
    token.initialize('YAN', 'YAN', owner, 1);
  }

  function testUpgrade_WithData_Reinitializer_runs_once() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    V2WithReinit v2 = new V2WithReinit();
    vm.prank(owner);
    token.upgradeToAndCall(address(v2), abi.encodeWithSelector(V2WithReinit.migrate.selector));
    assertEq(V2WithReinit(address(token)).extra(), 42);
    // Second attempt should revert (already initialized v2 reinitializer(2))
    vm.prank(owner);
    vm.expectRevert();
    token.upgradeToAndCall(address(v2), abi.encodeWithSelector(V2WithReinit.migrate.selector));
  }

  function testUpgrade_EOA_Reverts() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    address eoa = vm.addr(123);
    vm.prank(owner);
    vm.expectRevert();
    token.upgradeToAndCall(eoa, '');
  }

  function testStorageLayout_Preserved() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
    uint256 tsBefore = token.totalSupply();
    address ownerBefore = token.owner();
    uint256 ownerBalBefore = token.balanceOf(owner);

    V2WithStorage v2 = new V2WithStorage();
    vm.prank(owner);
    token.upgradeToAndCall(address(v2), '');

    vm.prank(owner);
    V2WithStorage(address(token)).setFoo(777);
    assertEq(V2WithStorage(address(token)).foo(), 777);
    // Check previous state preserved
    assertEq(token.totalSupply(), tsBefore);
    assertEq(token.owner(), ownerBefore);
    assertEq(token.balanceOf(owner), ownerBalBefore);
  }

  // Positive EIP-2612 permit flow
  function testPermit_PositiveFlow() public {
    YansTokenUUPS token = YansTokenUUPS(address(proxy));
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

    // Spend part of the allowance
    vm.prank(spender);
    token.transferFrom(owner, spender, 2 ether);
    assertEq(token.allowance(owner, spender), value - 2 ether);
  }
}
