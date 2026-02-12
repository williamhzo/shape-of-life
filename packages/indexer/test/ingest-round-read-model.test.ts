import { describe, expect, it } from "bun:test";
import {
  buildRoundReadModel,
  type RoundIndexerClient,
  type RoundReadModel,
} from "../src/ingest-round-read-model";
import { parseRoundReadModel, stringifyRoundReadModel } from "../src/round-read-model-store";

function completeClient(): RoundIndexerClient {
  return {
    async getChainId() {
      return 11011;
    },
    async readRoundState() {
      return {
        phase: 3,
        gen: 4,
        maxGen: 256,
        maxBatch: 16,
        totalFunded: 11n,
        winnerPaid: 6n,
        keeperPaid: 2n,
        treasuryDust: 3n,
      };
    },
    async getSteppedEvents() {
      return [
        {
          blockNumber: 120n,
          logIndex: 4,
          fromGen: 2,
          toGen: 4,
          reward: 0n,
          keeper: "0x00000000000000000000000000000000000000aa",
        },
        {
          blockNumber: 100n,
          logIndex: 2,
          fromGen: 0,
          toGen: 2,
          reward: 2n,
          keeper: "0x00000000000000000000000000000000000000aa",
        },
      ];
    },
    async getFinalizedEvents() {
      return [
        {
          blockNumber: 130n,
          logIndex: 0,
          finalGen: 4,
          winnerPoolFinal: 8n,
          keeperPaid: 2n,
          treasuryDust: 1n,
        },
      ];
    },
    async getClaimedEvents() {
      return [
        {
          blockNumber: 140n,
          logIndex: 1,
          distributed: 6n,
          cumulativeWinnerPaid: 6n,
          treasuryDust: 3n,
          remainingWinnerPool: 0n,
        },
      ];
    },
  };
}

describe("buildRoundReadModel", () => {
  it("builds deterministic accounting snapshot from chain state + events", async () => {
    const roundAddress = "0x1111111111111111111111111111111111111111";

    const model = await buildRoundReadModel({
      client: completeClient(),
      roundAddress,
      fromBlock: 95n,
      toBlock: 150n,
      syncedAt: "2026-02-12T16:00:00.000Z",
    });

    expect(model.roundAddress).toBe(roundAddress);
    expect(model.chainId).toBe(11011);
    expect(model.cursor.fromBlock).toBe(95n);
    expect(model.cursor.toBlock).toBe(150n);
    expect(model.eventCounts.stepped).toBe(2);
    expect(model.lifecycle.finalized).toBe(true);
    expect(model.lifecycle.finalGen).toBe(4);
    expect(model.accounting.totalFunded).toBe(11n);
    expect(model.accounting.accountedTotal).toBe(11n);
    expect(model.accounting.invariantHolds).toBe(true);

    const serialized = stringifyRoundReadModel(model);
    const parsed = parseRoundReadModel(serialized);
    expect(parsed).toEqual(model);
  });

  it("keeps reconciliation pending until finalize exists", async () => {
    const client: RoundIndexerClient = {
      async getChainId() {
        return 11011;
      },
      async readRoundState() {
        return {
          phase: 2,
          gen: 3,
          maxGen: 256,
          maxBatch: 16,
          totalFunded: 5n,
          winnerPaid: 0n,
          keeperPaid: 1n,
          treasuryDust: 0n,
        };
      },
      async getSteppedEvents() {
        return [{ blockNumber: 100n, logIndex: 0, fromGen: 0, toGen: 3, reward: 1n, keeper: "0x00000000000000000000000000000000000000bb" }];
      },
      async getFinalizedEvents() {
        return [];
      },
      async getClaimedEvents() {
        return [];
      },
    };

    const model = await buildRoundReadModel({
      client,
      roundAddress: "0x2222222222222222222222222222222222222222",
      fromBlock: 99n,
      toBlock: 111n,
    });

    expect(model.lifecycle.finalized).toBe(false);
    expect(model.accounting.accountedTotal).toBe(null);
    expect(model.accounting.invariantHolds).toBe(null);
    expect(model.accounting.reconciliationStatus).toBe("pending-finalize");
  });

  it("fails noisy on reconciliation divergence", async () => {
    const client: RoundIndexerClient = {
      ...completeClient(),
      async getFinalizedEvents() {
        return [
          {
            blockNumber: 130n,
            logIndex: 0,
            finalGen: 4,
            winnerPoolFinal: 8n,
            keeperPaid: 3n,
            treasuryDust: 1n,
          },
        ];
      },
    };

    await expect(
      buildRoundReadModel({
        client,
        roundAddress: "0x3333333333333333333333333333333333333333",
        fromBlock: 1n,
        toBlock: 200n,
      }),
    ).rejects.toThrow("keeper paid mismatch");
  });
});

function _assertRoundModelType(value: RoundReadModel): RoundReadModel {
  return value;
}

_assertRoundModelType({
  version: "v1",
  chainId: 11011,
  roundAddress: "0x0000000000000000000000000000000000000000",
  syncedAt: "2026-02-12T16:00:00.000Z",
  cursor: { fromBlock: 0n, toBlock: 0n },
  phase: 0,
  gen: 0,
  maxGen: 256,
  maxBatch: 16,
  lifecycle: { finalized: false, finalGen: null, winnerPoolFinal: null },
  eventCounts: { stepped: 0, finalized: 0, claimed: 0 },
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
