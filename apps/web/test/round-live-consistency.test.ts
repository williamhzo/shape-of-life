import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GET } from "../app/api/round/live/route";

describe("round live route consistency", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }

    delete process.env.INDEXER_READ_MODEL_PATH;
  });

  it("marks stale snapshots and preserves reconciliation status for spectator UI", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "shape-of-life-round-consistency-"));
    const modelPath = join(tempDir, "round-read-model.latest.json");
    process.env.INDEXER_READ_MODEL_PATH = modelPath;

    writeFileSync(
      modelPath,
      JSON.stringify(
        {
          version: "v1",
          chainId: 11011,
          roundAddress: "0x1111111111111111111111111111111111111111",
          syncedAt: "2020-01-01T00:00:00.000Z",
          cursor: {
            fromBlock: { __bigint__: "100" },
            toBlock: { __bigint__: "120" },
          },
          phase: 2,
          gen: 120,
          maxGen: 256,
          maxBatch: 16,
          lifecycle: {
            finalized: false,
            finalGen: null,
            winnerPoolFinal: null,
          },
          events: {
            stepped: [],
            finalized: [],
            claimed: [],
          },
          eventCounts: {
            stepped: 40,
            finalized: 0,
            claimed: 0,
          },
          accounting: {
            totalFunded: { __bigint__: "11" },
            winnerPaid: { __bigint__: "0" },
            keeperPaid: { __bigint__: "2" },
            treasuryDust: { __bigint__: "0" },
            derivedKeeperPaid: null,
            accountedTotal: null,
            invariantHolds: null,
            reconciliationStatus: "pending-finalize",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const response = await GET();
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      source: { stale: boolean; ageMs: number };
      accounting: {
        reconciliationStatus: string;
        invariantHolds: boolean | null;
        accountedTotal: string | null;
      };
      round: { finalized: boolean };
    };

    expect(body.source.stale).toBe(true);
    expect(body.source.ageMs).toBeGreaterThan(30_000);
    expect(body.round.finalized).toBe(false);
    expect(body.accounting.reconciliationStatus).toBe("pending-finalize");
    expect(body.accounting.invariantHolds).toBeNull();
    expect(body.accounting.accountedTotal).toBeNull();
  });
});
