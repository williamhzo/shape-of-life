// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function expectEmit(bool, bool, bool, bool) external;
    function deal(address account, uint256 newBalance) external;
}

contract ConwayArenaRoundEventsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Committed(address player, uint8 team, uint8 slotIndex);
    event Revealed(address player, uint8 team, uint8 slotIndex);
    event Initialized();
    event Stepped(uint16 fromGen, uint16 toGen, address keeper, uint256 reward);
    event Finalized(uint16 finalGen, uint256 winnerPoolFinal, uint256 keeperPaid, uint256 treasuryDust);
    event Claimed(uint256 distributed, uint256 cumulativeWinnerPaid, uint256 treasuryDust, uint256 remainingWinnerPool);
    event PlayerClaimed(address player, uint8 slotIndex, uint256 amount);

    ConwayArenaRound internal round;

    receive() external payable {}

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
        vm.deal(address(round), 11);
        round.configureAccounting(11, 1);

        vm.warp(111);
        round.beginReveal();

        vm.warp(122);
        round.initialize();
    }

    function testCommitEmitsCommitted() public {
        ConwayArenaRound commitRound = new ConwayArenaRound(10, 10, 4, 2);
        bytes32 commitHash = commitRound.hashCommit(1, address(this), 0, 2, 0x3, bytes32("c-event"));

        vm.expectEmit(false, false, false, true);
        emit Committed(address(this), 0, 2);
        commitRound.commit(0, 2, commitHash);
    }

    function testRevealEmitsRevealed() public {
        ConwayArenaRound revRound = new ConwayArenaRound(10, 10, 4, 2);
        bytes32 salt = bytes32("r-event");
        uint64 seedBits = 0x3;
        bytes32 commitHash = revRound.hashCommit(1, address(this), 0, 1, seedBits, salt);
        revRound.commit(0, 1, commitHash);

        vm.warp(133);
        revRound.beginReveal();

        vm.expectEmit(false, false, false, true);
        emit Revealed(address(this), 0, 1);
        revRound.reveal(1, 0, 1, seedBits, salt);
    }

    function testInitializeEmitsInitialized() public {
        ConwayArenaRound initRound = new ConwayArenaRound(10, 10, 4, 2);
        vm.warp(133);
        initRound.beginReveal();
        vm.warp(144);

        vm.expectEmit(false, false, false, true);
        emit Initialized();
        initRound.initialize();
    }

    function testStepBatchEmitsStepped() public {
        vm.expectEmit(false, false, false, true);
        emit Stepped(0, 2, address(this), 2);
        round.stepBatch(2);
    }

    function testFinalizeEmitsFinalized() public {
        round.stepBatch(2);
        round.stepBatch(2);

        vm.expectEmit(false, false, false, true);
        emit Finalized(4, 0, 2, 9);
        round.finalize();
    }

    function testClaimEmitsPlayerClaimedWithPayout() public {
        ConwayArenaRound paidRound = new ConwayArenaRound(10, 10, 4, 2);
        vm.deal(address(paidRound), 10 ether);
        paidRound.configureAccounting(10 ether, 0);

        bytes32 salt = bytes32("claim-event");
        uint64 seedBits = 0x3;
        bytes32 commitHash = paidRound.hashCommit(1, address(this), 0, 1, seedBits, salt);
        paidRound.commit(0, 1, commitHash);

        vm.warp(133);
        paidRound.beginReveal();
        paidRound.reveal(1, 0, 1, seedBits, salt);

        vm.warp(144);
        paidRound.initialize();
        paidRound.finalize();

        vm.expectEmit(false, false, false, true);
        emit PlayerClaimed(address(this), 1, 10 ether);
        paidRound.claim(1);
    }

    function testClaimEmitsPlayerClaimedWithZeroPayout() public {
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();

        ConwayArenaRound nonAccRound = new ConwayArenaRound(10, 10, 4, 2);
        bytes32 salt = bytes32("zero-event");
        uint64 seedBits = 0x1;
        bytes32 commitHash = nonAccRound.hashCommit(1, address(this), 0, 0, seedBits, salt);
        nonAccRound.commit(0, 0, commitHash);

        vm.warp(155);
        nonAccRound.beginReveal();
        nonAccRound.reveal(1, 0, 0, seedBits, salt);

        vm.warp(166);
        nonAccRound.initialize();
        nonAccRound.finalize();

        vm.expectEmit(false, false, false, true);
        emit PlayerClaimed(address(this), 0, 0);
        nonAccRound.claim(0);
    }

    function testSettleWinnerClaimsEmitsClaimed() public {
        ConwayArenaRound legacy = new ConwayArenaRound(10, 10, 4, 2);
        vm.warp(133);
        legacy.beginReveal();
        vm.warp(144);
        legacy.initialize();
        legacy.finalize();

        vm.expectEmit(false, false, false, true);
        emit Claimed(0, 0, 0, 0);
        legacy.settleWinnerClaims(0);
    }
}
