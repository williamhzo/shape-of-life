// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArenaRegistry} from "../src/ArenaRegistry.sol";

interface Vm {
    function prank(address caller) external;
    function expectEmit(bool, bool, bool, bool) external;
}

contract ArenaRegistryTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ArenaRegistry internal registry;

    address private constant ROUND_A = address(0xA);
    address private constant ROUND_B = address(0xB);
    address private constant ROUND_C = address(0xC);
    address private constant STRANGER = address(0xDEAD);

    event CurrentRoundUpdated(address indexed previousRound, address indexed newRound);
    event SeasonMetadataHashUpdated(bytes32 previousHash, bytes32 newHash);

    function setUp() public {
        registry = new ArenaRegistry();
    }

    function testOwnerIsDeployer() public view {
        require(registry.owner() == address(this), "owner mismatch");
    }

    function testCurrentRoundStartsZero() public view {
        require(registry.currentRound() == address(0), "expected zero");
    }

    function testPastRoundsStartsEmpty() public view {
        require(registry.pastRoundCount() == 0, "expected empty");
    }

    function testSetCurrentRound() public {
        registry.setCurrentRound(ROUND_A);
        require(registry.currentRound() == ROUND_A, "expected ROUND_A");
        require(registry.pastRoundCount() == 0, "first set should not push to past");
    }

    function testSetCurrentRoundPushesPrevious() public {
        registry.setCurrentRound(ROUND_A);
        registry.setCurrentRound(ROUND_B);
        require(registry.currentRound() == ROUND_B, "expected ROUND_B");
        require(registry.pastRoundCount() == 1, "expected 1 past round");
        require(registry.pastRounds(0) == ROUND_A, "expected ROUND_A in past");
    }

    function testSetCurrentRoundThreeRotations() public {
        registry.setCurrentRound(ROUND_A);
        registry.setCurrentRound(ROUND_B);
        registry.setCurrentRound(ROUND_C);
        require(registry.currentRound() == ROUND_C, "expected ROUND_C");
        require(registry.pastRoundCount() == 2, "expected 2 past rounds");
        require(registry.pastRounds(0) == ROUND_A, "past[0] should be ROUND_A");
        require(registry.pastRounds(1) == ROUND_B, "past[1] should be ROUND_B");
    }

    function testSetCurrentRoundRevertsZeroAddress() public {
        expectRevertSelector(ArenaRegistry.ZeroAddress.selector, abi.encodeCall(ArenaRegistry.setCurrentRound, (address(0))));
    }

    function testSetCurrentRoundRevertsSameAddress() public {
        registry.setCurrentRound(ROUND_A);
        expectRevertSelector(ArenaRegistry.RoundAlreadyCurrent.selector, abi.encodeCall(ArenaRegistry.setCurrentRound, (ROUND_A)));
    }

    function testSetCurrentRoundRevertsNonOwner() public {
        vm.prank(STRANGER);
        expectRevertSelector(ArenaRegistry.NotOwner.selector, abi.encodeCall(ArenaRegistry.setCurrentRound, (ROUND_A)));
    }

    function testSetCurrentRoundEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CurrentRoundUpdated(address(0), ROUND_A);
        registry.setCurrentRound(ROUND_A);
    }

    function testSetCurrentRoundEmitsEventWithPrevious() public {
        registry.setCurrentRound(ROUND_A);
        vm.expectEmit(true, true, false, true);
        emit CurrentRoundUpdated(ROUND_A, ROUND_B);
        registry.setCurrentRound(ROUND_B);
    }

    function testSetSeasonMetadataHash() public {
        bytes32 hash = keccak256("season-1");
        registry.setSeasonMetadataHash(hash);
        require(registry.seasonMetadataHash() == hash, "hash mismatch");
    }

    function testSetSeasonMetadataHashEmitsEvent() public {
        bytes32 hash = keccak256("season-1");
        vm.expectEmit(false, false, false, true);
        emit SeasonMetadataHashUpdated(bytes32(0), hash);
        registry.setSeasonMetadataHash(hash);
    }

    function testSetSeasonMetadataHashRevertsNonOwner() public {
        vm.prank(STRANGER);
        expectRevertSelector(ArenaRegistry.NotOwner.selector, abi.encodeCall(ArenaRegistry.setSeasonMetadataHash, (bytes32("x"))));
    }

    function testTransferOwnership() public {
        registry.transferOwnership(STRANGER);
        require(registry.owner() == STRANGER, "owner should be STRANGER");
    }

    function testTransferOwnershipRevertsZero() public {
        expectRevertSelector(ArenaRegistry.ZeroAddress.selector, abi.encodeCall(ArenaRegistry.transferOwnership, (address(0))));
    }

    function testTransferOwnershipRevertsNonOwner() public {
        vm.prank(STRANGER);
        expectRevertSelector(ArenaRegistry.NotOwner.selector, abi.encodeCall(ArenaRegistry.transferOwnership, (ROUND_A)));
    }

    function testNewOwnerCanSetRound() public {
        registry.transferOwnership(STRANGER);
        vm.prank(STRANGER);
        registry.setCurrentRound(ROUND_A);
        require(registry.currentRound() == ROUND_A, "new owner should set round");
    }

    function testAllPastRounds() public {
        registry.setCurrentRound(ROUND_A);
        registry.setCurrentRound(ROUND_B);
        registry.setCurrentRound(ROUND_C);
        address[] memory past = registry.allPastRounds();
        require(past.length == 2, "expected 2");
        require(past[0] == ROUND_A, "past[0]");
        require(past[1] == ROUND_B, "past[1]");
    }

    function expectRevertSelector(bytes4 selector, bytes memory callData) internal {
        (bool ok, bytes memory ret) = address(registry).call(callData);
        require(!ok, "expected revert");
        bytes4 got;
        assembly { got := mload(add(ret, 0x20)) }
        require(got == selector, "wrong error selector");
    }
}
