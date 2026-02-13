import { createPublicClient, http, parseAbi, parseAbiItem, type Address } from "viem";
import { reconcileRoundEvents } from "./reconcile-round-events";

export type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

export type RoundStateSnapshot = {
  phase: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  totalFunded: bigint;
  winnerPaid: bigint;
  keeperPaid: bigint;
  treasuryDust: bigint;
};

export type SteppedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  fromGen: number;
  toGen: number;
  keeper: Address;
  reward: bigint;
};

export type FinalizedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  finalGen: number;
  winnerPoolFinal: bigint;
  keeperPaid: bigint;
  treasuryDust: bigint;
};

export type ClaimedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  distributed: bigint;
  cumulativeWinnerPaid: bigint;
  treasuryDust: bigint;
  remainingWinnerPool: bigint;
};

export type PlayerClaimedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  player: Address;
  slotIndex: number;
  amount: bigint;
};

export type CommittedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  player: Address;
  team: number;
  slotIndex: number;
};

export type RevealedIndexedEvent = {
  blockNumber: bigint;
  logIndex: number;
  player: Address;
  team: number;
  slotIndex: number;
};

export type RoundIndexerClient = {
  getChainId(): Promise<number>;
  getLatestBlockNumber?(): Promise<bigint>;
  readRoundState(roundAddress: Address): Promise<RoundStateSnapshot>;
  getSteppedEvents(roundAddress: Address, range: BlockRange): Promise<SteppedIndexedEvent[]>;
  getFinalizedEvents(roundAddress: Address, range: BlockRange): Promise<FinalizedIndexedEvent[]>;
  getClaimedEvents(roundAddress: Address, range: BlockRange): Promise<ClaimedIndexedEvent[]>;
  getPlayerClaimedEvents(roundAddress: Address, range: BlockRange): Promise<PlayerClaimedIndexedEvent[]>;
  getCommittedEvents(roundAddress: Address, range: BlockRange): Promise<CommittedIndexedEvent[]>;
  getRevealedEvents(roundAddress: Address, range: BlockRange): Promise<RevealedIndexedEvent[]>;
};

export type RoundReadModel = {
  version: "v1";
  chainId: number;
  roundAddress: Address;
  syncedAt: string;
  cursor: BlockRange;
  phase: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  lifecycle: {
    finalized: boolean;
    finalGen: number | null;
    winnerPoolFinal: bigint | null;
  };
  events: {
    stepped: SteppedIndexedEvent[];
    finalized: FinalizedIndexedEvent[];
    claimed: ClaimedIndexedEvent[];
    playerClaimed: PlayerClaimedIndexedEvent[];
    committed: CommittedIndexedEvent[];
    revealed: RevealedIndexedEvent[];
  };
  eventCounts: {
    stepped: number;
    finalized: number;
    claimed: number;
    playerClaimed: number;
    committed: number;
    revealed: number;
  };
  accounting: {
    totalFunded: bigint;
    winnerPaid: bigint;
    keeperPaid: bigint;
    treasuryDust: bigint;
    derivedKeeperPaid: bigint | null;
    accountedTotal: bigint | null;
    invariantHolds: boolean | null;
    reconciliationStatus: "ok" | "pending-finalize";
  };
};

export type BuildRoundReadModelParams = {
  client: RoundIndexerClient;
  roundAddress: Address;
  fromBlock?: bigint;
  toBlock?: bigint;
  syncedAt?: string;
  previousModel?: RoundReadModel;
};

const ROUND_READ_ABI = parseAbi([
  "function phase() view returns (uint8)",
  "function gen() view returns (uint16)",
  "function maxGen() view returns (uint16)",
  "function maxBatch() view returns (uint16)",
  "function totalFunded() view returns (uint256)",
  "function winnerPaid() view returns (uint256)",
  "function keeperPaid() view returns (uint256)",
  "function treasuryDust() view returns (uint256)",
]);

const STEPPED_EVENT = parseAbiItem("event Stepped(uint16 fromGen, uint16 toGen, address keeper, uint256 reward)");
const FINALIZED_EVENT = parseAbiItem("event Finalized(uint16 finalGen, uint256 winnerPoolFinal, uint256 keeperPaid, uint256 treasuryDust)");
const CLAIMED_EVENT = parseAbiItem(
  "event Claimed(uint256 distributed, uint256 cumulativeWinnerPaid, uint256 treasuryDust, uint256 remainingWinnerPool)",
);
const PLAYER_CLAIMED_EVENT = parseAbiItem("event PlayerClaimed(address player, uint8 slotIndex, uint256 amount)");
const COMMITTED_EVENT = parseAbiItem("event Committed(address player, uint8 team, uint8 slotIndex)");
const REVEALED_EVENT = parseAbiItem("event Revealed(address player, uint8 team, uint8 slotIndex)");

function compareLogOrder(a: { blockNumber: bigint; logIndex: number }, b: { blockNumber: bigint; logIndex: number }): number {
  if (a.blockNumber === b.blockNumber) {
    return a.logIndex - b.logIndex;
  }

  return a.blockNumber < b.blockNumber ? -1 : 1;
}

function toNumber(value: bigint): number {
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    throw new Error(`value exceeds safe integer range: ${value}`);
  }

  return num;
}

function requireIndexedLog<T extends { blockNumber: bigint | null; logIndex: number | null }>(
  eventName: string,
  log: T,
): { blockNumber: bigint; logIndex: number } {
  if (log.blockNumber === null || log.logIndex === null) {
    throw new Error(`${eventName} log missing block/log index`);
  }

  return {
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
  };
}

async function resolveToBlock(client: RoundIndexerClient, requestedToBlock: bigint | undefined): Promise<bigint> {
  if (requestedToBlock !== undefined) {
    return requestedToBlock;
  }

  if (!client.getLatestBlockNumber) {
    throw new Error("toBlock is required when client does not expose getLatestBlockNumber");
  }

  return client.getLatestBlockNumber();
}

export async function buildRoundReadModel(params: BuildRoundReadModelParams): Promise<RoundReadModel> {
  const fromBlock = params.fromBlock ?? 0n;
  const toBlock = await resolveToBlock(params.client, params.toBlock);

  if (toBlock < fromBlock) {
    throw new Error(`invalid block range: fromBlock ${fromBlock} > toBlock ${toBlock}`);
  }

  const range: BlockRange = { fromBlock, toBlock };

  const [chainId, roundState, steppedUnsorted, finalizedUnsorted, claimedUnsorted, playerClaimedUnsorted, committedUnsorted, revealedUnsorted] = await Promise.all([
    params.client.getChainId(),
    params.client.readRoundState(params.roundAddress),
    params.client.getSteppedEvents(params.roundAddress, range),
    params.client.getFinalizedEvents(params.roundAddress, range),
    params.client.getClaimedEvents(params.roundAddress, range),
    params.client.getPlayerClaimedEvents(params.roundAddress, range),
    params.client.getCommittedEvents(params.roundAddress, range),
    params.client.getRevealedEvents(params.roundAddress, range),
  ]);

  if (params.previousModel && params.previousModel.roundAddress.toLowerCase() !== params.roundAddress.toLowerCase()) {
    throw new Error("previous model round address does not match target round");
  }
  if (params.previousModel && params.previousModel.chainId !== chainId) {
    throw new Error("previous model chain id does not match target chain");
  }

  const previousStepped = params.previousModel
    ? params.previousModel.events.stepped.filter((event) => event.blockNumber < fromBlock)
    : [];
  const previousFinalized = params.previousModel
    ? params.previousModel.events.finalized.filter((event) => event.blockNumber < fromBlock)
    : [];
  const previousClaimed = params.previousModel
    ? params.previousModel.events.claimed.filter((event) => event.blockNumber < fromBlock)
    : [];
  const previousPlayerClaimed = params.previousModel
    ? params.previousModel.events.playerClaimed.filter((event) => event.blockNumber < fromBlock)
    : [];
  const previousCommitted = params.previousModel
    ? params.previousModel.events.committed.filter((event) => event.blockNumber < fromBlock)
    : [];
  const previousRevealed = params.previousModel
    ? params.previousModel.events.revealed.filter((event) => event.blockNumber < fromBlock)
    : [];

  const stepped = [...previousStepped, ...steppedUnsorted].sort(compareLogOrder);
  const finalized = [...previousFinalized, ...finalizedUnsorted].sort(compareLogOrder);
  const claimed = [...previousClaimed, ...claimedUnsorted].sort(compareLogOrder);
  const playerClaimed = [...previousPlayerClaimed, ...playerClaimedUnsorted].sort(compareLogOrder);
  const committed = [...previousCommitted, ...committedUnsorted].sort(compareLogOrder);
  const revealed = [...previousRevealed, ...revealedUnsorted].sort(compareLogOrder);

  const finalizedEvent = finalized.length > 0 ? finalized[finalized.length - 1] : null;

  let derivedKeeperPaid: bigint | null = null;
  let accountedTotal: bigint | null = null;
  let invariantHolds: boolean | null = null;
  let reconciliationStatus: "ok" | "pending-finalize" = "pending-finalize";

  if (finalizedEvent !== null) {
    const reconciliation = reconcileRoundEvents({
      totalFunded: roundState.totalFunded,
      stepped: stepped.map((event) => ({
        fromGen: event.fromGen,
        toGen: event.toGen,
        reward: event.reward,
      })),
      finalized: {
        finalGen: finalizedEvent.finalGen,
        winnerPoolFinal: finalizedEvent.winnerPoolFinal,
        keeperPaid: finalizedEvent.keeperPaid,
        treasuryDust: finalizedEvent.treasuryDust,
      },
      claimed: claimed.map((event) => ({
        distributed: event.distributed,
        cumulativeWinnerPaid: event.cumulativeWinnerPaid,
        treasuryDust: event.treasuryDust,
        remainingWinnerPool: event.remainingWinnerPool,
      })),
      playerClaimed: playerClaimed.map((event) => ({
        player: event.player,
        slotIndex: event.slotIndex,
        amount: event.amount,
      })),
    });

    derivedKeeperPaid = reconciliation.derivedKeeperPaid;
    accountedTotal = reconciliation.accountedTotal;
    invariantHolds = reconciliation.invariantHolds;
    reconciliationStatus = "ok";
  }

  return {
    version: "v1",
    chainId,
    roundAddress: params.roundAddress,
    syncedAt: params.syncedAt ?? new Date().toISOString(),
    cursor: range,
    phase: roundState.phase,
    gen: roundState.gen,
    maxGen: roundState.maxGen,
    maxBatch: roundState.maxBatch,
    lifecycle: {
      finalized: finalizedEvent !== null,
      finalGen: finalizedEvent?.finalGen ?? null,
      winnerPoolFinal: finalizedEvent?.winnerPoolFinal ?? null,
    },
    events: {
      stepped,
      finalized,
      claimed,
      playerClaimed,
      committed,
      revealed,
    },
    eventCounts: {
      stepped: stepped.length,
      finalized: finalized.length,
      claimed: claimed.length,
      playerClaimed: playerClaimed.length,
      committed: committed.length,
      revealed: revealed.length,
    },
    accounting: {
      totalFunded: roundState.totalFunded,
      winnerPaid: roundState.winnerPaid,
      keeperPaid: roundState.keeperPaid,
      treasuryDust: roundState.treasuryDust,
      derivedKeeperPaid,
      accountedTotal,
      invariantHolds,
      reconciliationStatus,
    },
  };
}

export function createViemRoundIndexerClient(rpcUrl: string): RoundIndexerClient {
  const client = createPublicClient({ transport: http(rpcUrl) });

  return {
    async getChainId() {
      return client.getChainId();
    },
    async getLatestBlockNumber() {
      return client.getBlockNumber();
    },
    async readRoundState(roundAddress) {
      const [phase, gen, maxGen, maxBatch, totalFunded, winnerPaid, keeperPaid, treasuryDust] = await Promise.all([
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "phase" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "gen" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "maxGen" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "maxBatch" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "totalFunded" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "winnerPaid" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "keeperPaid" }),
        client.readContract({ address: roundAddress, abi: ROUND_READ_ABI, functionName: "treasuryDust" }),
      ]);

      return {
        phase: toNumber(phase),
        gen: toNumber(gen),
        maxGen: toNumber(maxGen),
        maxBatch: toNumber(maxBatch),
        totalFunded,
        winnerPaid,
        keeperPaid,
        treasuryDust,
      };
    },
    async getSteppedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: STEPPED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("Stepped", log);
        const args = log.args as {
          fromGen: bigint;
          toGen: bigint;
          keeper: Address;
          reward: bigint;
        };

        return {
          ...location,
          fromGen: toNumber(args.fromGen),
          toGen: toNumber(args.toGen),
          keeper: args.keeper,
          reward: args.reward,
        };
      });
    },
    async getFinalizedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: FINALIZED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("Finalized", log);
        const args = log.args as {
          finalGen: bigint;
          winnerPoolFinal: bigint;
          keeperPaid: bigint;
          treasuryDust: bigint;
        };

        return {
          ...location,
          finalGen: toNumber(args.finalGen),
          winnerPoolFinal: args.winnerPoolFinal,
          keeperPaid: args.keeperPaid,
          treasuryDust: args.treasuryDust,
        };
      });
    },
    async getClaimedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: CLAIMED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("Claimed", log);
        const args = log.args as {
          distributed: bigint;
          cumulativeWinnerPaid: bigint;
          treasuryDust: bigint;
          remainingWinnerPool: bigint;
        };

        return {
          ...location,
          distributed: args.distributed,
          cumulativeWinnerPaid: args.cumulativeWinnerPaid,
          treasuryDust: args.treasuryDust,
          remainingWinnerPool: args.remainingWinnerPool,
        };
      });
    },
    async getPlayerClaimedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: PLAYER_CLAIMED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("PlayerClaimed", log);
        const args = log.args as { player: Address; slotIndex: bigint; amount: bigint };

        return {
          ...location,
          player: args.player,
          slotIndex: toNumber(args.slotIndex),
          amount: args.amount,
        };
      });
    },
    async getCommittedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: COMMITTED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("Committed", log);
        const args = log.args as { player: Address; team: bigint; slotIndex: bigint };

        return {
          ...location,
          player: args.player,
          team: toNumber(args.team),
          slotIndex: toNumber(args.slotIndex),
        };
      });
    },
    async getRevealedEvents(roundAddress, range) {
      const logs = await client.getLogs({
        address: roundAddress,
        event: REVEALED_EVENT,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      });

      return logs.map((log) => {
        const location = requireIndexedLog("Revealed", log);
        const args = log.args as { player: Address; team: bigint; slotIndex: bigint };

        return {
          ...location,
          player: args.player,
          team: toNumber(args.team),
          slotIndex: toNumber(args.slotIndex),
        };
      });
    },
  };
}
