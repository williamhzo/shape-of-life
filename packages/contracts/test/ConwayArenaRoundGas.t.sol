// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
}

contract ConwayArenaRoundGasTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testGasCommit() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
        round.commit();
    }

    function testGasReveal() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
        vm.warp(111);
        round.beginReveal();
        round.reveal();
    }

    function testGasStepBatch() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
        round.configureAccounting(12, 1);

        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();

        round.stepBatch(10);
    }

    function testGasFinalize() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();

        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
    }

    function testGasClaim() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
        round.claim();
    }
}
