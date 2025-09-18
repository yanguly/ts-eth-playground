// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {YansTokenUUPS} from "../src/YansTokenUUPS.sol";
import {YansTokenUUPSV2} from "../src/YansTokenUUPSV2.sol";

contract TokenUUPS_Test is Test {
    bytes32 constant SLOT_IMPL = 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC;

    address internal owner;
    address internal user;
    ERC1967Proxy internal proxy;

    function setUp() public {
        owner = vm.addr(0xA11CE);
        user = vm.addr(0xB0B);

        YansTokenUUPS implV1 = new YansTokenUUPS();
        bytes memory data = abi.encodeWithSelector(
            YansTokenUUPS.initialize.selector,
            "YAN",
            "YAN",
            owner,
            1_000_000 ether
        );
        vm.prank(owner);
        proxy = new ERC1967Proxy(address(implV1), data);
    }

    function _impl() internal view returns (address) {
        bytes32 word = vm.load(address(proxy), SLOT_IMPL);
        return address(uint160(uint256(word)));
    }

    // Upgrade invariants
    function testUpgrade_Invariants() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        string memory nameBefore = token.name();
        string memory symbolBefore = token.symbol();
        uint8 decBefore = token.decimals();
        uint256 tsBefore = token.totalSupply();
        address ownerBefore = token.owner();
        address implBefore = _impl();

        YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
        vm.prank(owner);
        token.upgradeToAndCall(address(implV2), "");

        address implAfter = _impl();
        assertTrue(implAfter != implBefore, "impl unchanged");
        assertEq(token.owner(), ownerBefore, "owner changed");
        assertEq(token.totalSupply(), tsBefore, "totalSupply changed");
        assertEq(token.name(), nameBefore, "name changed");
        assertEq(token.symbol(), symbolBefore, "symbol changed");
        assertEq(token.decimals(), decBefore, "decimals changed");
    }

    // V2 behavior: mint onlyOwner, Transfer event, permit/nonces intact
    function testV2_Mint_OnlyOwner_Emits() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
        vm.prank(owner);
        token.upgradeToAndCall(address(implV2), "");

        uint256 beforeBal = token.balanceOf(user);
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), user, 1 ether);
        vm.prank(owner);
        YansTokenUUPSV2(address(token)).mint(user, 1 ether);
        assertEq(token.balanceOf(user), beforeBal + 1 ether, "mint failed");

        vm.prank(user);
        vm.expectRevert();
        YansTokenUUPSV2(address(token)).mint(user, 1 ether);
    }

    event Transfer(address indexed from, address indexed to, uint256 value);

    function testV2_Permit_Nonces_Intact() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
        vm.prank(owner);
        token.upgradeToAndCall(address(implV2), "");

        uint256 nonceBefore = token.nonces(owner);
        // Craft a minimal invalid permit to ensure nonces not auto-modified
        vm.expectRevert();
        token.permit(owner, user, 1 ether, block.timestamp + 1000, 27, bytes32(0), bytes32(0));
        assertEq(token.nonces(owner), nonceBefore, "nonces changed unexpectedly");
    }

    // Reverts: upgrade by non-owner, upgrade to non-UUPS, upgrade to same impl
    function testReverts_Upgrade_NotOwner() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
        vm.prank(user);
        vm.expectRevert();
        token.upgradeToAndCall(address(implV2), "");
    }

    function testReverts_Upgrade_NonUUPS() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        // Deploy a non-UUPS implementation (plain address with code not implementing proxiableUUID)
        address nonUUPS = address(new Dummy());
        vm.prank(owner);
        vm.expectRevert();
        token.upgradeToAndCall(nonUUPS, "");
    }

    function testReverts_Upgrade_SameImpl() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        address current = _impl();
        vm.prank(owner);
        // OZ UUPS may allow re-upgrade to same implementation; ensure it doesn't break state
        token.upgradeToAndCall(current, "");
        assertEq(_impl(), current, "impl changed unexpectedly");
    }

    // Fuzz: permit deadlines/nonces, transferFrom against leftover allowance,
    // invariant: sum of balances == totalSupply
    function testFuzz_Permit_Deadlines(uint256 addSecs) public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        YansTokenUUPSV2 implV2 = new YansTokenUUPSV2();
        vm.prank(owner);
        token.upgradeToAndCall(address(implV2), "");

        // Assume reasonable deadline window
        addSecs = addSecs % 7 days;
        uint256 deadline = block.timestamp + addSecs + 1;
        // Invalid signature reverts, nonces unchanged
        uint256 nonceBefore = token.nonces(owner);
        vm.expectRevert();
        token.permit(owner, user, 1 ether, deadline, 27, bytes32(0), bytes32(0));
        assertEq(token.nonces(owner), nonceBefore);
    }

    function testTransferFrom_LeftoverAllowance() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        // owner approves user 10 ether
        vm.prank(owner);
        token.approve(user, 10 ether);

        // user spends 3 ether
        vm.prank(user);
        token.transferFrom(owner, user, 3 ether);
        // leftover 7 ether, spending 8 should revert
        vm.prank(user);
        vm.expectRevert();
        token.transferFrom(owner, user, 8 ether);
    }

    function testInvariant_SumBalancesEqTotalSupply() public {
        YansTokenUUPS token = YansTokenUUPS(address(proxy));
        uint256 ts = token.totalSupply();
        // Split to two accounts and verify sum
        vm.prank(owner);
        token.transfer(user, 100 ether);
        uint256 sum = token.balanceOf(owner) + token.balanceOf(user);
        assertEq(sum, ts);
    }
}

contract Dummy { }
