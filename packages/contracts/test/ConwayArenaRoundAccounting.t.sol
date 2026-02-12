// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
}

contract ConwayArenaRoundAccountingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConwayArenaRound internal round;

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testKeeperShortfallClampPreventsOverpay() public {
        round.configureAccounting(11, 5);
        transitionToSim();

        round.stepBatch(10);

        require(round.winnerPool() == 8, "winner pool mismatch");
        require(round.keeperPaid() == 2, "keeper should be clamped by pool");
        require(round.keeperPoolRemaining() == 0, "keeper pool should be exhausted");
        require(round.keeperCredits(address(this)) == 2, "keeper credit mismatch");
        require(round.treasuryDust() == 1, "bps split dust mismatch");
    }

    function testAccountingInvariantHoldsAfterClaimRoundingDust() public {
        round.configureAccounting(11, 1);
        transitionToSim();

        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
        round.settleWinnerClaims(3);

        uint256 totalDistributed = round.winnerPaid() + round.keeperPaid() + round.treasuryDust();
        require(totalDistributed <= round.totalFunded(), "accounting invariant violated");
        require(totalDistributed == round.totalFunded(), "expected fully accounted funds");
    }

    function testZeroEligibleWinnersRoutesWinnerPoolToDust() public {
        round.configureAccounting(10, 0);
        transitionToSim();

        round.setExtinction(true, false);
        round.finalize();
        round.settleWinnerClaims(0);

        require(round.winnerPaid() == 0, "winner payout should be zero");
        require(round.treasuryDust() == 10, "winner pool should route to dust");
        require(round.winnerPaid() + round.keeperPaid() + round.treasuryDust() == round.totalFunded(), "funds mismatch");
    }

    function transitionToSim() internal {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
    }
}
