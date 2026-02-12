// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function expectEmit(bool, bool, bool, bool) external;
}

contract ConwayArenaRoundEventsTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Stepped(uint16 fromGen, uint16 toGen, address keeper, uint256 reward);
    event Finalized(uint16 finalGen, uint256 winnerPoolFinal, uint256 keeperPaid, uint256 treasuryDust);
    event Claimed(uint256 distributed, uint256 cumulativeWinnerPaid, uint256 treasuryDust, uint256 remainingWinnerPool);

    ConwayArenaRound internal round;

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
        round.configureAccounting(11, 1);

        vm.warp(111);
        round.beginReveal();

        vm.warp(122);
        round.initialize();
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
        emit Finalized(4, 8, 2, 1);
        round.finalize();
    }

    function testSettleWinnerClaimsEmitsClaimed() public {
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();

        vm.expectEmit(false, false, false, true);
        emit Claimed(6, 6, 3, 0);
        round.settleWinnerClaims(3);
    }
}
