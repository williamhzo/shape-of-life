// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
}

contract ConwayArenaRoundSimulationTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant RED_PLAYER = address(0xCAFE);

    function testInitializeMaterializesRevealedSeedIntoBoard() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        uint64 seedBits = 0x0000000000000403;
        bytes32 salt = bytes32("materialize");

        commitFor(round, address(this), 0, 0, seedBits, salt);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 0, seedBits, salt);

        vm.warp(122);
        round.initialize();

        require(round.blueRows(0) == 0x03, "row 0 materialization mismatch");
        require(round.blueRows(1) == 0x04, "row 1 materialization mismatch");
        require(round.redRows(0) == 0, "unexpected red row state");
    }

    function testStepBatchRunsEngineOverMaterializedBoard() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 2, 1);

        uint64 seedBits = 0x0000000000000700;
        bytes32 salt = bytes32("blinker");

        commitFor(round, address(this), 0, 0, seedBits, salt);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 0, seedBits, salt);

        vm.warp(122);
        round.initialize();
        round.stepBatch(1);

        require(round.blueRows(0) == 0x02, "row 0 blinker mismatch");
        require(round.blueRows(1) == 0x02, "row 1 blinker mismatch");
        require(round.blueRows(2) == 0x02, "row 2 blinker mismatch");
        require(round.finalBluePopulation() == 3, "blue population mismatch");
        require(round.finalRedPopulation() == 0, "red population mismatch");
    }

    function testFinalizeUsesBoardDerivedWinnerAtMaxGen() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 1, 1);

        uint64 blueSeed = 0x0000000000000303;
        uint64 redSeed = 0x0000000000000001;
        bytes32 blueSalt = bytes32("blue-block");
        bytes32 redSalt = bytes32("red-single");

        commitFor(round, address(this), 0, 0, blueSeed, blueSalt);
        commitFor(round, RED_PLAYER, 1, 4, redSeed, redSalt);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 0, blueSeed, blueSalt);
        vm.prank(RED_PLAYER);
        round.reveal(1, 1, 4, redSeed, redSalt);

        vm.warp(122);
        round.initialize();
        round.stepBatch(1);
        round.finalize();

        require(round.winnerTeam() == round.TEAM_BLUE(), "expected blue winner");
        require(round.finalBluePopulation() == 4, "blue final population mismatch");
        require(round.finalRedPopulation() == 0, "red final population mismatch");
        require(round.redExtinct(), "expected red extinction");
    }

    function testFinalizeUsesWeightedPopulationAndInvasionScoring() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 1, 1);

        uint64 blueSeed = 0x2460064000108300;
        uint64 redSeed = 0x080A40A0020810B0;
        bytes32 blueSalt = bytes32("blue-score");
        bytes32 redSalt = bytes32("red-score");

        commitFor(round, address(this), 0, 0, blueSeed, blueSalt);
        commitFor(round, RED_PLAYER, 1, 36, redSeed, redSalt);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 0, blueSeed, blueSalt);
        vm.prank(RED_PLAYER);
        round.reveal(1, 1, 36, redSeed, redSalt);

        vm.warp(122);
        round.initialize();
        round.stepBatch(1);
        round.finalize();

        require(round.finalBluePopulation() == 8, "blue population mismatch");
        require(round.finalRedPopulation() == 9, "red population mismatch");
        require(round.scoreBlue() == 24, "blue score mismatch");
        require(round.scoreRed() == 27, "red score mismatch");
        require(round.winnerTeam() == round.TEAM_RED(), "red should win on population when no invasion");
        require(!round.blueExtinct(), "blue should survive");
        require(!round.redExtinct(), "red should survive");
    }

    function testFinalizeSetsDrawWhenWeightedScoresMatch() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 1, 1);

        uint64 blueSeed = 0x0000000000000303;
        uint64 redSeed = 0x0000000000000303;
        bytes32 blueSalt = bytes32("blue-draw");
        bytes32 redSalt = bytes32("red-draw");

        commitFor(round, address(this), 0, 0, blueSeed, blueSalt);
        commitFor(round, RED_PLAYER, 1, 4, redSeed, redSalt);

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 0, blueSeed, blueSalt);
        vm.prank(RED_PLAYER);
        round.reveal(1, 1, 4, redSeed, redSalt);

        vm.warp(122);
        round.initialize();
        round.stepBatch(1);
        round.finalize();

        require(round.finalBluePopulation() == 4, "blue population mismatch");
        require(round.finalRedPopulation() == 4, "red population mismatch");
        require(round.scoreBlue() == 12, "blue score mismatch");
        require(round.scoreRed() == 12, "red score mismatch");
        require(round.winnerTeam() == round.WINNER_DRAW(), "expected draw winner");
        require(!round.blueExtinct(), "blue should survive");
        require(!round.redExtinct(), "red should survive");
    }

    function commitFor(
        ConwayArenaRound round,
        address player,
        uint8 team,
        uint8 slotIndex,
        uint64 seedBits,
        bytes32 salt
    ) internal {
        bytes32 commitHash = round.hashCommit(1, player, team, slotIndex, seedBits, salt);

        if (player == address(this)) {
            round.commit(team, slotIndex, commitHash);
            return;
        }

        vm.prank(player);
        round.commit(team, slotIndex, commitHash);
    }
}
