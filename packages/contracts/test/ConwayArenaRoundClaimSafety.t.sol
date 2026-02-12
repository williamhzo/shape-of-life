// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
}

contract ConwayArenaRoundClaimSafetyTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConwayArenaRound internal round;

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testClaimSlotAllowsRevealedOwnerAndBlocksSecondClaim() public {
        bytes32 salt = bytes32("claim-once");
        uint64 seedBits = 0x3;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 5, seedBits, salt);

        round.commit(0, 5, commitHash);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 5, seedBits, salt);

        vm.warp(122);
        round.initialize();
        round.setExtinction(true, false);
        round.finalize();

        round.claim(5);
        (, , , , bool revealed, bool claimed) = round.slots(5);
        require(revealed, "expected revealed slot");
        require(claimed, "expected claimed slot");

        expectRevertSelector(ConwayArenaRound.AlreadyClaimed.selector, abi.encodeWithSignature("claim(uint8)", 5));
    }

    function testClaimSlotRevertsForNonOwner() public {
        bytes32 salt = bytes32("claim-owner");
        uint64 seedBits = 0x1;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 8, seedBits, salt);

        round.commit(0, 8, commitHash);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 8, seedBits, salt);

        vm.warp(122);
        round.initialize();
        round.setExtinction(true, false);
        round.finalize();

        vm.prank(address(0xCAFE));
        expectRevertSelector(ConwayArenaRound.NotSlotOwner.selector, abi.encodeWithSignature("claim(uint8)", 8));
    }

    function testClaimSlotRevertsWhenSlotNotRevealed() public {
        bytes32 salt = bytes32("claim-reveal-required");
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 9, 0x1, salt);

        round.commit(0, 9, commitHash);

        vm.warp(111);
        round.beginReveal();

        vm.warp(122);
        round.initialize();
        round.setExtinction(true, false);
        round.finalize();

        expectRevertSelector(ConwayArenaRound.SlotNotRevealed.selector, abi.encodeWithSignature("claim(uint8)", 9));
    }

    function expectRevertSelector(bytes4 expectedSelector, bytes memory callData) internal {
        (bool success, bytes memory revertData) = address(round).call(callData);
        require(!success, "expected revert");
        require(revertData.length >= 4, "missing selector");

        bytes4 actualSelector;
        assembly {
            actualSelector := mload(add(revertData, 32))
        }

        require(actualSelector == expectedSelector, "unexpected selector");
    }
}
