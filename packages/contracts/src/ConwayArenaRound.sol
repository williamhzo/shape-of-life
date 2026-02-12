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
    error AccountingAlreadyConfigured();
    error ClaimsAlreadySettled();

    uint16 public constant WINNER_BPS = 8000;
    uint16 public constant KEEPER_BPS = 2000;
    uint16 public constant BPS_DENOMINATOR = 10000;

    Phase public phase;
    uint64 public commitEnd;
    uint64 public revealEnd;
    uint64 public immutable revealDuration;
    uint16 public gen;
    uint16 public immutable maxGen;
    uint16 public immutable maxBatch;
    bool public blueExtinct;
    bool public redExtinct;
    bool public accountingConfigured;
    bool public winnerClaimsSettled;
    uint256 public totalFunded;
    uint256 public rewardPerGen;
    uint256 public winnerPool;
    uint256 public keeperPoolRemaining;
    uint256 public keeperPaid;
    uint256 public winnerPaid;
    uint256 public treasuryDust;
    mapping(address keeper => uint256 credit) public keeperCredits;

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

        if (accountingConfigured) {
            uint256 baseWinnerPool = (totalFunded * WINNER_BPS) / BPS_DENOMINATOR;
            uint256 baseKeeperPool = (totalFunded * KEEPER_BPS) / BPS_DENOMINATOR;

            winnerPool = baseWinnerPool;
            keeperPoolRemaining = baseKeeperPool;
            treasuryDust += totalFunded - baseWinnerPool - baseKeeperPool;
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

        if (rewardPerGen > 0 && actualSteps > 0) {
            uint256 keeperReward = uint256(actualSteps) * rewardPerGen;
            if (keeperReward > keeperPoolRemaining) {
                keeperReward = keeperPoolRemaining;
            }

            if (keeperReward > 0) {
                keeperPoolRemaining -= keeperReward;
                keeperPaid += keeperReward;
                keeperCredits[msg.sender] += keeperReward;
            }
        }
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

        winnerPool += keeperPoolRemaining;
        keeperPoolRemaining = 0;
        phase = Phase.Claim;
    }

    function claim() external view {
        requirePhase(Phase.Claim);
    }

    function configureAccounting(uint256 totalFunded_, uint256 rewardPerGen_) external {
        requirePhase(Phase.Commit);
        if (accountingConfigured) {
            revert AccountingAlreadyConfigured();
        }

        accountingConfigured = true;
        totalFunded = totalFunded_;
        rewardPerGen = rewardPerGen_;
    }

    function settleWinnerClaims(uint256 eligibleWinners) external {
        requirePhase(Phase.Claim);
        if (winnerClaimsSettled) {
            revert ClaimsAlreadySettled();
        }

        winnerClaimsSettled = true;

        if (eligibleWinners == 0) {
            treasuryDust += winnerPool;
            winnerPool = 0;
            return;
        }

        uint256 payoutPerWinner = winnerPool / eligibleWinners;
        uint256 distributed = payoutPerWinner * eligibleWinners;
        winnerPaid += distributed;
        treasuryDust += winnerPool - distributed;
        winnerPool = 0;
    }

    function requirePhase(Phase expected) internal view {
        if (phase != expected) {
            revert InvalidPhase(expected, phase);
        }
    }
}
