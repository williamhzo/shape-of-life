// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
}

contract ConwayArenaRoundStateMachineTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConwayArenaRound internal round;

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testCommitAllowedDuringCommitPhase() public {
        round.commit();
    }

    function testCommitRevertsWhenCommitWindowClosed() public {
        vm.warp(111);
        expectRevertSelector(ConwayArenaRound.CommitWindowClosed.selector, abi.encodeCall(ConwayArenaRound.commit, ()));
    }

    function testBeginRevealRevertsBeforeCommitWindowClosed() public {
        expectRevertSelector(ConwayArenaRound.CommitWindowOpen.selector, abi.encodeCall(ConwayArenaRound.beginReveal, ()));
    }

    function testBeginRevealTransitionsToRevealPhase() public {
        vm.warp(111);
        round.beginReveal();
        require(round.phase() == ConwayArenaRound.Phase.Reveal, "expected reveal phase");
    }

    function testRevealRevertsOutsideRevealPhase() public {
        expectRevertSelector(
            ConwayArenaRound.InvalidPhase.selector,
            abi.encodeCall(ConwayArenaRound.reveal, ())
        );
    }

    function testRevealAllowedDuringRevealWindow() public {
        vm.warp(111);
        round.beginReveal();
        round.reveal();
    }

    function testRevealRevertsWhenRevealWindowClosed() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        expectRevertSelector(ConwayArenaRound.RevealWindowClosed.selector, abi.encodeCall(ConwayArenaRound.reveal, ()));
    }

    function testInitializeRevertsBeforeRevealWindowClosed() public {
        vm.warp(111);
        round.beginReveal();
        expectRevertSelector(ConwayArenaRound.RevealWindowOpen.selector, abi.encodeCall(ConwayArenaRound.initialize, ()));
    }

    function testInitializeTransitionsToSimPhase() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        require(round.phase() == ConwayArenaRound.Phase.Sim, "expected sim phase");
    }

    function testStepBatchRevertsOutsideSimPhase() public {
        expectRevertSelector(
            ConwayArenaRound.InvalidPhase.selector,
            abi.encodeCall(ConwayArenaRound.stepBatch, (1))
        );
    }

    function testStepBatchRevertsForZeroSteps() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        expectRevertSelector(ConwayArenaRound.ZeroSteps.selector, abi.encodeCall(ConwayArenaRound.stepBatch, (0)));
    }

    function testStepBatchClampsToMaxBatchThenRemainingToMaxGen() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();

        round.stepBatch(10);
        require(round.gen() == 2, "expected maxBatch clamp");

        round.stepBatch(10);
        require(round.gen() == 4, "expected remaining clamp to maxGen");
    }

    function testFinalizeRevertsOutsideSimPhase() public {
        expectRevertSelector(
            ConwayArenaRound.InvalidPhase.selector,
            abi.encodeCall(ConwayArenaRound.finalize, ())
        );
    }

    function testFinalizeRevertsWhenRoundNotTerminal() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        expectRevertSelector(ConwayArenaRound.RoundNotTerminal.selector, abi.encodeCall(ConwayArenaRound.finalize, ()));
    }

    function testFinalizeTransitionsToClaimAtMaxGen() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();

        require(round.phase() == ConwayArenaRound.Phase.Claim, "expected claim phase");
    }

    function testClaimRevertsOutsideClaimPhase() public {
        expectRevertSelector(
            ConwayArenaRound.InvalidPhase.selector,
            abi.encodeCall(ConwayArenaRound.claim, ())
        );
    }

    function testClaimAllowedInClaimPhase() public {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
        round.claim();
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
