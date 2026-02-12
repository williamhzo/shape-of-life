// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
}

contract ConwayArenaRoundCommitRevealTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConwayArenaRound internal round;

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testCommitPayloadReservesSlotForPlayer() public {
        bytes32 salt = keccak256("commit-payload-reserve");
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 3, 0x3F, salt);

        round.commit(0, 3, commitHash);

        (address player, uint8 team, bytes32 storedHash, uint64 seedBits, bool revealed, bool claimed) = round.slots(3);
        require(player == address(this), "slot player mismatch");
        require(team == 0, "slot team mismatch");
        require(storedHash == commitHash, "slot hash mismatch");
        require(seedBits == 0, "seed should be zero before reveal");
        require(!revealed, "slot should not be revealed");
        require(!claimed, "slot should not be claimed");
        require(round.hasReservedSlot(address(this)), "expected reserved slot marker");
    }

    function testCommitPayloadRevertsForTeamTerritoryMismatch() public {
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 40, 0x1, bytes32("salt"));

        expectRevertSelector(
            ConwayArenaRound.SlotOutOfTerritory.selector,
            abi.encodeWithSignature("commit(uint8,uint8,bytes32)", 0, 40, commitHash)
        );
    }

    function testCommitPayloadRevertsWhenAddressAlreadyReserved() public {
        bytes32 firstHash = round.hashCommit(1, address(this), 0, 2, 0x1, bytes32("first"));
        bytes32 secondHash = round.hashCommit(1, address(this), 0, 5, 0x2, bytes32("second"));

        round.commit(0, 2, firstHash);

        expectRevertSelector(
            ConwayArenaRound.AddressAlreadyCommitted.selector,
            abi.encodeWithSignature("commit(uint8,uint8,bytes32)", 0, 5, secondHash)
        );
    }

    function testRevealPayloadRevertsForWrongPlayer() public {
        bytes32 salt = bytes32("owner-check");
        uint64 seedBits = 0x3;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 7, seedBits, salt);

        round.commit(0, 7, commitHash);
        transitionToReveal();

        vm.prank(address(0xBEEF));
        expectRevertSelector(
            ConwayArenaRound.NotSlotOwner.selector,
            abi.encodeWithSignature("reveal(uint256,uint8,uint8,uint64,bytes32)", 1, 0, 7, seedBits, salt)
        );
    }

    function testRevealPayloadRevertsForCommitHashMismatch() public {
        bytes32 salt = bytes32("hash-mismatch");
        uint64 committedSeedBits = 0x3;
        uint64 revealedSeedBits = 0x7;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 4, committedSeedBits, salt);

        round.commit(0, 4, commitHash);
        transitionToReveal();

        expectRevertSelector(
            ConwayArenaRound.CommitHashMismatch.selector,
            abi.encodeWithSignature("reveal(uint256,uint8,uint8,uint64,bytes32)", 1, 0, 4, revealedSeedBits, salt)
        );
    }

    function testRevealPayloadRevertsWhenSeedBudgetExceeded() public {
        bytes32 salt = bytes32("budget");
        uint64 overBudgetSeedBits = 0x1FFF;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 9, overBudgetSeedBits, salt);

        round.commit(0, 9, commitHash);
        transitionToReveal();

        expectRevertSelector(
            ConwayArenaRound.SeedBudgetExceeded.selector,
            abi.encodeWithSignature("reveal(uint256,uint8,uint8,uint64,bytes32)", 1, 0, 9, overBudgetSeedBits, salt)
        );
    }

    function testRevealPayloadAllowsExactBudgetAndBlocksSecondReveal() public {
        bytes32 salt = bytes32("double-reveal");
        uint64 exactBudgetSeedBits = 0xFFF;
        bytes32 commitHash = round.hashCommit(1, address(this), 0, 10, exactBudgetSeedBits, salt);

        round.commit(0, 10, commitHash);
        transitionToReveal();

        round.reveal(1, 0, 10, exactBudgetSeedBits, salt);
        (, , , uint64 storedSeedBits, bool revealed, bool claimed) = round.slots(10);
        require(revealed, "expected slot revealed");
        require(!claimed, "slot should not be claimed");
        require(storedSeedBits == exactBudgetSeedBits, "stored seed bits mismatch");

        expectRevertSelector(
            ConwayArenaRound.AlreadyRevealed.selector,
            abi.encodeWithSignature("reveal(uint256,uint8,uint8,uint64,bytes32)", 1, 0, 10, exactBudgetSeedBits, salt)
        );
    }

    function transitionToReveal() internal {
        vm.warp(111);
        round.beginReveal();
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
