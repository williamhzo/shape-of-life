// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
}

contract ConwayArenaRoundE2ETest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testLocalRoundFlowCommitRevealStepFinalizeClaim() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
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
        round.settleWinnerClaims(2);

        require(round.phase() == ConwayArenaRound.Phase.Claim, "expected claim phase");
        require(round.gen() == 4, "expected max gen");
        require(round.winnerPaid() + round.keeperPaid() + round.treasuryDust() == round.totalFunded(), "funds mismatch");
    }
}
