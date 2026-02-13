// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address account, uint256 newBalance) external;
}

contract ConwayArenaRoundE2ETest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testLocalRoundFlowCommitRevealStepFinalizeClaim() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
        vm.deal(address(round), 12);
        round.configureAccounting(12, 1);

        round.commit();

        vm.warp(111);
        round.beginReveal();
        round.reveal();

        vm.warp(122);
        round.initialize();

        round.stepBatch(10);
        round.stepBatch(10);
        round.finalize();
        round.claim();

        require(round.phase() == ConwayArenaRound.Phase.Claim, "expected claim phase");
        require(round.gen() == 4, "expected max gen");
        require(round.winnerPool() + round.winnerPaid() + round.keeperPaid() + round.treasuryDust() == round.totalFunded(), "funds mismatch");
    }

    function testGetBoardStateMatchesIndividualReads() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        vm.warp(111);
        round.beginReveal();

        vm.warp(122);
        round.initialize();

        (uint64[64] memory blue, uint64[64] memory red) = round.getBoardState();
        for (uint8 y = 0; y < 64; y++) {
            require(blue[y] == round.blueRows(y), "blue mismatch after init");
            require(red[y] == round.redRows(y), "red mismatch after init");
        }

        round.stepBatch(2);

        (uint64[64] memory blueAfter, uint64[64] memory redAfter) = round.getBoardState();
        for (uint8 y = 0; y < 64; y++) {
            require(blueAfter[y] == round.blueRows(y), "blue mismatch after step");
            require(redAfter[y] == round.redRows(y), "red mismatch after step");
        }
    }
}
