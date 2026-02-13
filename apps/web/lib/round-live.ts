import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildParticipantRoster,
  buildKeeperLeaderboard,
  type ParticipantEntry,
  type KeeperEntry,
} from "./round-feeds";

type BigIntRecord = {
  __bigint__: string;
};

type IndexerCommittedEvent = { player: string; team: number; slotIndex: number };
type IndexerRevealedEvent = { player: string; team: number; slotIndex: number };
type IndexerPlayerClaimedEvent = { player: string; slotIndex: number; amount: bigint };
type IndexerSteppedEvent = { keeper: string; fromGen: number; toGen: number; reward: bigint };

type IndexerRoundReadModel = {
  version: "v1";
  chainId: number;
  roundAddress: string;
  syncedAt: string;
  cursor: {
    fromBlock: bigint;
    toBlock: bigint;
  };
  phase: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  lifecycle: {
    finalized: boolean;
    finalGen: number | null;
    winnerPoolFinal: bigint | null;
  };
  events?: {
    committed?: IndexerCommittedEvent[];
    revealed?: IndexerRevealedEvent[];
    playerClaimed?: IndexerPlayerClaimedEvent[];
    stepped?: IndexerSteppedEvent[];
  };
  eventCounts: {
    stepped: number;
    finalized: number;
    claimed: number;
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

export type RoundLivePayload = {
  source: {
    path: string;
    syncedAt: string;
    ageMs: number;
    stale: boolean;
  };
  round: {
    chainId: number;
    roundAddress: string;
    phase: number;
    gen: number;
    maxGen: number;
    maxBatch: number;
    finalized: boolean;
    finalGen: number | null;
  };
  events: {
    stepped: number;
    finalized: number;
    claimed: number;
  };
  accounting: {
    totalFunded: string;
    winnerPaid: string;
    keeperPaid: string;
    treasuryDust: string;
    derivedKeeperPaid: string | null;
    accountedTotal: string | null;
    invariantHolds: boolean | null;
    reconciliationStatus: "ok" | "pending-finalize";
  };
  participants: ParticipantEntry[];
  keepers: KeeperEntry[];
};

const DEFAULT_STALE_AGE_MS = 30_000;

function isBigIntRecord(value: unknown): value is BigIntRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 1 && typeof candidate.__bigint__ === "string";
}

export function resolveReadModelPath(explicitPath?: string): string {
  if (explicitPath) {
    return resolve(explicitPath);
  }

  const candidates = [
    resolve(process.cwd(), "packages/indexer/data/round-read-model.latest.json"),
    resolve(process.cwd(), "../../packages/indexer/data/round-read-model.latest.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function parseReadModel(raw: string): IndexerRoundReadModel {
  return JSON.parse(raw, (_, value) => {
    if (isBigIntRecord(value)) {
      return BigInt(value.__bigint__);
    }

    return value;
  }) as IndexerRoundReadModel;
}

function bigintToString(value: bigint | null): string | null {
  return value === null ? null : value.toString();
}

export function readRoundLivePayload(path?: string): RoundLivePayload {
  const resolvedPath = resolveReadModelPath(path);
  const model = parseReadModel(readFileSync(resolvedPath, "utf8"));

  const now = Date.now();
  const syncedAtMs = Date.parse(model.syncedAt);
  const ageMs = Number.isNaN(syncedAtMs) ? Number.POSITIVE_INFINITY : Math.max(0, now - syncedAtMs);

  return {
    source: {
      path: resolvedPath,
      syncedAt: model.syncedAt,
      ageMs,
      stale: ageMs > DEFAULT_STALE_AGE_MS,
    },
    round: {
      chainId: model.chainId,
      roundAddress: model.roundAddress,
      phase: model.phase,
      gen: model.gen,
      maxGen: model.maxGen,
      maxBatch: model.maxBatch,
      finalized: model.lifecycle.finalized,
      finalGen: model.lifecycle.finalGen,
    },
    events: model.eventCounts,
    accounting: {
      totalFunded: model.accounting.totalFunded.toString(),
      winnerPaid: model.accounting.winnerPaid.toString(),
      keeperPaid: model.accounting.keeperPaid.toString(),
      treasuryDust: model.accounting.treasuryDust.toString(),
      derivedKeeperPaid: bigintToString(model.accounting.derivedKeeperPaid),
      accountedTotal: bigintToString(model.accounting.accountedTotal),
      invariantHolds: model.accounting.invariantHolds,
      reconciliationStatus: model.accounting.reconciliationStatus,
    },
    participants: buildParticipantRoster({
      committed: model.events?.committed ?? [],
      revealed: model.events?.revealed ?? [],
      playerClaimed: model.events?.playerClaimed ?? [],
    }),
    keepers: buildKeeperLeaderboard(model.events?.stepped ?? []),
  };
}
