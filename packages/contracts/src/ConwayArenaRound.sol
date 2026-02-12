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
    error InvalidTeam(uint8 team);
    error InvalidSlotIndex(uint8 slotIndex);
    error SlotOutOfTerritory(uint8 team, uint8 slotIndex);
    error SlotAlreadyReserved(uint8 slotIndex);
    error SlotNotReserved(uint8 slotIndex);
    error SlotNotRevealed(uint8 slotIndex);
    error AddressAlreadyCommitted(address player);
    error NotSlotOwner(address expected, address caller);
    error AlreadyRevealed(uint8 slotIndex);
    error AlreadyClaimed(uint8 slotIndex);
    error CommitHashMismatch();
    error SeedBudgetExceeded(uint8 liveCells, uint8 seedBudget);
    error NoKeeperCredit(address keeper);
    error TransferFailed();
    error ManualSettlementDisabled();
    error ZeroSteps();
    error RoundNotTerminal();
    error AccountingAlreadyConfigured();
    error ClaimsAlreadySettled();
    error ReentrancyBlocked();
    error InsufficientRoundBalance(uint256 required, uint256 available);

    uint16 public constant WINNER_BPS = 8000;
    uint16 public constant KEEPER_BPS = 2000;
    uint16 public constant BPS_DENOMINATOR = 10000;
    uint8 public constant TEAM_BLUE = 0;
    uint8 public constant TEAM_RED = 1;
    uint8 public constant WINNER_DRAW = 2;
    uint8 public constant SLOT_COUNT = 64;
    uint8 public constant TEAM_SLOT_COUNT = 32;
    uint8 public constant SEED_BUDGET = 12;

    event Stepped(uint16 fromGen, uint16 toGen, address keeper, uint256 reward);
    event Finalized(uint16 finalGen, uint256 winnerPoolFinal, uint256 keeperPaid, uint256 treasuryDust);
    event Claimed(uint256 distributed, uint256 cumulativeWinnerPaid, uint256 treasuryDust, uint256 remainingWinnerPool);
    event KeeperCreditWithdrawn(address keeper, uint256 amount);

    struct SlotData {
        address player;
        uint8 team;
        bytes32 commitHash;
        uint64 seedBits;
        bool revealed;
        bool claimed;
    }

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
    bool public payoutLocked;
    bool private reentrancyLock;
    uint8 public winnerTeam;
    uint8 public revealedBlueCount;
    uint8 public revealedRedCount;
    uint256 public totalFunded;
    uint256 public rewardPerGen;
    uint256 public payoutPerClaim;
    uint256 public winnerPool;
    uint256 public keeperPoolRemaining;
    uint256 public keeperPaid;
    uint256 public winnerPaid;
    uint256 public treasuryDust;
    mapping(address keeper => uint256 credit) public keeperCredits;
    mapping(uint8 slotIndex => SlotData slot) public slots;
    mapping(address player => bool reserved) public hasReservedSlot;

    receive() external payable {}

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
        requireCommitOpen();
    }

    function commit(uint8 team, uint8 slotIndex, bytes32 commitHash) external {
        requireCommitOpen();
        validateTeam(team);
        validateSlotForTeam(team, slotIndex);

        SlotData storage slot = slots[slotIndex];
        if (slot.player != address(0)) {
            revert SlotAlreadyReserved(slotIndex);
        }
        if (hasReservedSlot[msg.sender]) {
            revert AddressAlreadyCommitted(msg.sender);
        }

        slot.player = msg.sender;
        slot.team = team;
        slot.commitHash = commitHash;
        hasReservedSlot[msg.sender] = true;
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
        requireRevealOpen();
    }

    function reveal(uint256 roundId, uint8 team, uint8 slotIndex, uint64 seedBits, bytes32 salt) external {
        requireRevealOpen();
        validateTeam(team);
        validateSlotForTeam(team, slotIndex);

        SlotData storage slot = slots[slotIndex];
        if (slot.player == address(0)) {
            revert SlotNotReserved(slotIndex);
        }
        if (slot.player != msg.sender) {
            revert NotSlotOwner(slot.player, msg.sender);
        }
        if (slot.revealed) {
            revert AlreadyRevealed(slotIndex);
        }

        uint8 liveCells = popcount(seedBits);
        if (liveCells > SEED_BUDGET) {
            revert SeedBudgetExceeded(liveCells, SEED_BUDGET);
        }

        bytes32 expectedCommit = computeCommitHash(roundId, msg.sender, team, slotIndex, seedBits, salt);
        if (slot.commitHash != expectedCommit) {
            revert CommitHashMismatch();
        }

        slot.seedBits = seedBits;
        slot.revealed = true;
        if (team == TEAM_BLUE) {
            unchecked {
                revealedBlueCount += 1;
            }
        } else {
            unchecked {
                revealedRedCount += 1;
            }
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

        uint16 fromGen = gen;
        uint16 remaining = maxGen - gen;
        uint16 actualSteps = requestedSteps;
        if (actualSteps > maxBatch) {
            actualSteps = maxBatch;
        }
        if (actualSteps > remaining) {
            actualSteps = remaining;
        }

        gen += actualSteps;

        uint256 keeperReward;
        if (rewardPerGen > 0 && actualSteps > 0) {
            keeperReward = uint256(actualSteps) * rewardPerGen;
            if (keeperReward > keeperPoolRemaining) {
                keeperReward = keeperPoolRemaining;
            }

            if (keeperReward > 0) {
                keeperPoolRemaining -= keeperReward;
                keeperPaid += keeperReward;
                keeperCredits[msg.sender] += keeperReward;
            }
        }

        emit Stepped(fromGen, gen, msg.sender, keeperReward);
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
        winnerTeam = resolveWinnerTeam();

        if (accountingConfigured && eligibleClaimCount() == 0) {
            payoutLocked = true;
            payoutPerClaim = 0;
            treasuryDust += winnerPool;
            winnerPool = 0;
        }

        phase = Phase.Claim;

        emit Finalized(gen, winnerPool, keeperPaid, treasuryDust);
    }

    function claim() external view {
        requirePhase(Phase.Claim);
    }

    function claim(uint8 slotIndex) external nonReentrant returns (uint256 amount) {
        requirePhase(Phase.Claim);

        if (slotIndex >= SLOT_COUNT) {
            revert InvalidSlotIndex(slotIndex);
        }

        SlotData storage slot = slots[slotIndex];
        if (slot.player == address(0)) {
            revert SlotNotReserved(slotIndex);
        }
        if (!slot.revealed) {
            revert SlotNotRevealed(slotIndex);
        }
        if (slot.player != msg.sender) {
            revert NotSlotOwner(slot.player, msg.sender);
        }
        if (slot.claimed) {
            revert AlreadyClaimed(slotIndex);
        }

        slot.claimed = true;

        if (!accountingConfigured || winnerClaimsSettled) {
            return 0;
        }

        lockPayoutIfNeeded();
        if (payoutPerClaim == 0 || !isPayoutEligible(slot.team)) {
            return 0;
        }

        amount = payoutPerClaim;
        winnerPool -= amount;
        winnerPaid += amount;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    function configureAccounting(uint256 totalFunded_, uint256 rewardPerGen_) external {
        requirePhase(Phase.Commit);
        if (accountingConfigured) {
            revert AccountingAlreadyConfigured();
        }
        if (address(this).balance < totalFunded_) {
            revert InsufficientRoundBalance(totalFunded_, address(this).balance);
        }

        accountingConfigured = true;
        totalFunded = totalFunded_;
        rewardPerGen = rewardPerGen_;
    }

    function withdrawKeeperCredit() external nonReentrant returns (uint256 amount) {
        amount = keeperCredits[msg.sender];
        if (amount == 0) {
            revert NoKeeperCredit(msg.sender);
        }

        keeperCredits[msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit KeeperCreditWithdrawn(msg.sender, amount);
    }

    function hashCommit(
        uint256 roundId,
        address player,
        uint8 team,
        uint8 slotIndex,
        uint64 seedBits,
        bytes32 salt
    ) external view returns (bytes32) {
        return computeCommitHash(roundId, player, team, slotIndex, seedBits, salt);
    }

    function settleWinnerClaims(uint256 eligibleWinners) external {
        requirePhase(Phase.Claim);
        if (accountingConfigured) {
            revert ManualSettlementDisabled();
        }
        if (winnerClaimsSettled) {
            revert ClaimsAlreadySettled();
        }

        winnerClaimsSettled = true;
        uint256 distributed;

        if (eligibleWinners == 0) {
            treasuryDust += winnerPool;
            winnerPool = 0;
            emit Claimed(distributed, winnerPaid, treasuryDust, winnerPool);
            return;
        }

        uint256 payoutPerWinner = winnerPool / eligibleWinners;
        distributed = payoutPerWinner * eligibleWinners;
        winnerPaid += distributed;
        treasuryDust += winnerPool - distributed;
        winnerPool = 0;

        emit Claimed(distributed, winnerPaid, treasuryDust, winnerPool);
    }

    function requirePhase(Phase expected) internal view {
        if (phase != expected) {
            revert InvalidPhase(expected, phase);
        }
    }

    function requireCommitOpen() internal view {
        requirePhase(Phase.Commit);
        if (block.timestamp > commitEnd) {
            revert CommitWindowClosed();
        }
    }

    function requireRevealOpen() internal view {
        requirePhase(Phase.Reveal);
        if (block.timestamp > revealEnd) {
            revert RevealWindowClosed();
        }
    }

    function validateTeam(uint8 team) internal pure {
        if (team != TEAM_BLUE && team != TEAM_RED) {
            revert InvalidTeam(team);
        }
    }

    function validateSlotForTeam(uint8 team, uint8 slotIndex) internal pure {
        if (slotIndex >= SLOT_COUNT) {
            revert InvalidSlotIndex(slotIndex);
        }

        if (team == TEAM_BLUE && slotIndex >= TEAM_SLOT_COUNT) {
            revert SlotOutOfTerritory(team, slotIndex);
        }
        if (team == TEAM_RED && slotIndex < TEAM_SLOT_COUNT) {
            revert SlotOutOfTerritory(team, slotIndex);
        }
    }

    function computeCommitHash(
        uint256 roundId,
        address player,
        uint8 team,
        uint8 slotIndex,
        uint64 seedBits,
        bytes32 salt
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(roundId, block.chainid, address(this), player, team, slotIndex, seedBits, salt));
    }

    function popcount(uint64 value) internal pure returns (uint8 count) {
        uint64 bits = value;
        while (bits != 0) {
            bits &= bits - 1;
            unchecked {
                count += 1;
            }
        }
    }

    function resolveWinnerTeam() internal view returns (uint8) {
        if (blueExtinct && !redExtinct) {
            return TEAM_RED;
        }
        if (redExtinct && !blueExtinct) {
            return TEAM_BLUE;
        }
        return WINNER_DRAW;
    }

    function lockPayoutIfNeeded() internal {
        if (payoutLocked) {
            return;
        }

        payoutLocked = true;
        uint256 eligibleClaims = eligibleClaimCount();
        if (eligibleClaims == 0) {
            treasuryDust += winnerPool;
            winnerPool = 0;
            payoutPerClaim = 0;
            return;
        }

        payoutPerClaim = winnerPool / eligibleClaims;
        uint256 distributablePool = payoutPerClaim * eligibleClaims;
        treasuryDust += winnerPool - distributablePool;
        winnerPool = distributablePool;
    }

    function eligibleClaimCount() internal view returns (uint256) {
        if (winnerTeam == TEAM_BLUE) {
            return revealedBlueCount;
        }
        if (winnerTeam == TEAM_RED) {
            return revealedRedCount;
        }
        return uint256(revealedBlueCount) + uint256(revealedRedCount);
    }

    function isPayoutEligible(uint8 slotTeam) internal view returns (bool) {
        if (winnerTeam == WINNER_DRAW) {
            return true;
        }
        return slotTeam == winnerTeam;
    }

    modifier nonReentrant() {
        if (reentrancyLock) {
            revert ReentrancyBlocked();
        }

        reentrancyLock = true;
        _;
        reentrancyLock = false;
    }
}
