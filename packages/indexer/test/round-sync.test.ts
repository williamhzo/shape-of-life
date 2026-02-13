import { describe, expect, it } from "bun:test";

import {
  buildRoundReadModel,
  type RoundIndexerClient,
  type RoundReadModel,
} from "../src/ingest-round-read-model";

function baseClient(overrides?: Partial<RoundIndexerClient>): RoundIndexerClient {
  const client: RoundIndexerClient = {
    async getChainId() {
      return 11011;
    },
    async readRoundState() {
      return {
        phase: 3,
        gen: 2,
        maxGen: 256,
        maxBatch: 16,
        totalFunded: 10n,
        winnerPaid: 0n,
        keeperPaid: 2n,
        treasuryDust: 0n,
      };
    },
    async getSteppedEvents() {
      return [{ blockNumber: 10n, logIndex: 0, fromGen: 0, toGen: 2, reward: 2n, keeper: "0x00000000000000000000000000000000000000aa" }];
    },
    async getFinalizedEvents() {
      return [
        {
          blockNumber: 12n,
          logIndex: 0,
          finalGen: 2,
          winnerPoolFinal: 8n,
          keeperPaid: 2n,
          treasuryDust: 0n,
        },
      ];
    },
    async getClaimedEvents() {
      return [];
    },
    async getPlayerClaimedEvents() {
      return [];
    },
    async getCommittedEvents() {
      return [];
    },
    async getRevealedEvents() {
      return [];
    },
  };

  return {
    ...client,
    ...overrides,
  };
}

describe("incremental round sync", () => {
  it("merges incremental logs with previous read model while preserving deterministic ordering", async () => {
    const roundAddress = "0x1111111111111111111111111111111111111111";
    const initial = await buildRoundReadModel({
      client: baseClient(),
      roundAddress,
      fromBlock: 0n,
      toBlock: 12n,
      syncedAt: "2026-02-12T17:00:00.000Z",
    });

    const incrementalClient = baseClient({
      async readRoundState() {
        return {
          phase: 3,
          gen: 4,
          maxGen: 256,
          maxBatch: 16,
          totalFunded: 10n,
          winnerPaid: 0n,
          keeperPaid: 3n,
          treasuryDust: 0n,
        };
      },
      async getSteppedEvents() {
        return [
          { blockNumber: 10n, logIndex: 0, fromGen: 0, toGen: 2, reward: 2n, keeper: "0x00000000000000000000000000000000000000aa" },
          { blockNumber: 13n, logIndex: 0, fromGen: 2, toGen: 4, reward: 1n, keeper: "0x00000000000000000000000000000000000000aa" },
        ];
      },
      async getFinalizedEvents() {
        return [
          {
            blockNumber: 14n,
            logIndex: 0,
            finalGen: 4,
            winnerPoolFinal: 7n,
            keeperPaid: 3n,
            treasuryDust: 0n,
          },
        ];
      },
      async getClaimedEvents() {
        return [];
      },
    });

    const merged = await buildRoundReadModel({
      client: incrementalClient,
      roundAddress,
      fromBlock: 10n,
      toBlock: 14n,
      previousModel: initial,
      syncedAt: "2026-02-12T17:05:00.000Z",
    });

    expect(merged.eventCounts.stepped).toBe(2);
    expect(merged.events.stepped.map((event) => event.toGen)).toEqual([2, 4]);
    expect(merged.lifecycle.finalGen).toBe(4);
    expect(merged.accounting.derivedKeeperPaid).toBe(3n);
    expect(merged.accounting.invariantHolds).toBe(true);
  });

  it("drops overlapped prior-window events so reorg replacements are reflected", async () => {
    const roundAddress = "0x1111111111111111111111111111111111111111";
    const initial = await buildRoundReadModel({
      client: baseClient(),
      roundAddress,
      fromBlock: 0n,
      toBlock: 12n,
      syncedAt: "2026-02-12T17:00:00.000Z",
    });

    const reorgClient = baseClient({
      async readRoundState() {
        return {
          phase: 3,
          gen: 2,
          maxGen: 256,
          maxBatch: 16,
          totalFunded: 10n,
          winnerPaid: 0n,
          keeperPaid: 4n,
          treasuryDust: 0n,
        };
      },
      async getSteppedEvents() {
        return [{ blockNumber: 10n, logIndex: 0, fromGen: 0, toGen: 2, reward: 4n, keeper: "0x00000000000000000000000000000000000000bb" }];
      },
      async getFinalizedEvents() {
        return [
          {
            blockNumber: 12n,
            logIndex: 0,
            finalGen: 2,
            winnerPoolFinal: 6n,
            keeperPaid: 4n,
            treasuryDust: 0n,
          },
        ];
      },
      async getClaimedEvents() {
        return [];
      },
    });

    const replaced = await buildRoundReadModel({
      client: reorgClient,
      roundAddress,
      fromBlock: 10n,
      toBlock: 12n,
      previousModel: initial,
      syncedAt: "2026-02-12T17:04:00.000Z",
    });

    expect(replaced.eventCounts.stepped).toBe(1);
    expect(replaced.events.stepped[0]?.reward).toBe(4n);
    expect(replaced.accounting.derivedKeeperPaid).toBe(4n);
    expect(replaced.accounting.invariantHolds).toBe(true);
  });
});

function _assertVersion(value: RoundReadModel): RoundReadModel {
  return value;
}

_assertVersion({
  version: "v1",
  chainId: 11011,
  roundAddress: "0x0000000000000000000000000000000000000000",
  syncedAt: "2026-02-12T17:00:00.000Z",
  cursor: { fromBlock: 0n, toBlock: 0n },
  phase: 0,
  gen: 0,
  maxGen: 256,
  maxBatch: 16,
  lifecycle: { finalized: false, finalGen: null, winnerPoolFinal: null },
  events: {
    stepped: [],
    finalized: [],
    claimed: [],
    playerClaimed: [],
    committed: [],
    revealed: [],
  },
  eventCounts: { stepped: 0, finalized: 0, claimed: 0, playerClaimed: 0, committed: 0, revealed: 0 },
  accounting: {
    totalFunded: 0n,
    winnerPaid: 0n,
    keeperPaid: 0n,
    treasuryDust: 0n,
    derivedKeeperPaid: null,
    accountedTotal: null,
    invariantHolds: null,
    reconciliationStatus: "pending-finalize",
  },
});
