// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ConwayArenaRound {
    enum Phase {
        Commit,
        Reveal,
        Sim,
        Claim
    }

    error InvalidPhase(Phase expected, Phase actual);
    error InvalidConfiguration();
    error CommitWindowOpen();
    error CommitWindowClosed();
    error RevealWindowOpen();
    error RevealWindowClosed();
    error ZeroSteps();
    error RoundNotTerminal();

    Phase public phase;
    uint64 public commitEnd;
    uint64 public revealEnd;
    uint64 public immutable revealDuration;
    uint16 public gen;
    uint16 public immutable maxGen;
    uint16 public immutable maxBatch;
    bool public blueExtinct;
    bool public redExtinct;

    constructor(uint64 commitDuration, uint64 revealDuration_, uint16 maxGen_, uint16 maxBatch_) {
        if (maxGen_ == 0 || maxBatch_ == 0 || maxBatch_ > maxGen_) {
            revert InvalidConfiguration();
        }

        phase = Phase.Commit;
        commitEnd = uint64(block.timestamp) + commitDuration;
        revealDuration = revealDuration_;
        maxGen = maxGen_;
        maxBatch = maxBatch_;
    }

    function commit() external view {
        requirePhase(Phase.Commit);
        if (block.timestamp > commitEnd) {
            revert CommitWindowClosed();
        }
    }

    function beginReveal() external {
        requirePhase(Phase.Commit);
        if (block.timestamp <= commitEnd) {
            revert CommitWindowOpen();
        }

        phase = Phase.Reveal;
        revealEnd = uint64(block.timestamp) + revealDuration;
    }

    function reveal() external view {
        requirePhase(Phase.Reveal);
        if (block.timestamp > revealEnd) {
            revert RevealWindowClosed();
        }
    }

    function initialize() external {
        requirePhase(Phase.Reveal);
        if (block.timestamp <= revealEnd) {
            revert RevealWindowOpen();
        }

        phase = Phase.Sim;
    }

    function stepBatch(uint16 requestedSteps) external {
        requirePhase(Phase.Sim);
        if (requestedSteps == 0) {
            revert ZeroSteps();
        }

        uint16 remaining = maxGen - gen;
        uint16 actualSteps = requestedSteps;
        if (actualSteps > maxBatch) {
            actualSteps = maxBatch;
        }
        if (actualSteps > remaining) {
            actualSteps = remaining;
        }

        gen += actualSteps;
    }

    function setExtinction(bool blueIsExtinct, bool redIsExtinct) external {
        blueExtinct = blueIsExtinct;
        redExtinct = redIsExtinct;
    }

    function finalize() external {
        requirePhase(Phase.Sim);
        if (gen != maxGen && !blueExtinct && !redExtinct) {
            revert RoundNotTerminal();
        }

        phase = Phase.Claim;
    }

    function claim() external view {
        requirePhase(Phase.Claim);
    }

    function requirePhase(Phase expected) internal view {
        if (phase != expected) {
            revert InvalidPhase(expected, phase);
        }
    }
}
