import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GET } from "../app/api/round/live/route";

describe("GET /api/round/live", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }

    delete process.env.INDEXER_READ_MODEL_PATH;
  });

  it("returns normalized spectator payload from persisted indexer model", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "shape-of-life-round-live-"));
    const modelPath = join(tempDir, "round-read-model.latest.json");
    process.env.INDEXER_READ_MODEL_PATH = modelPath;

    writeFileSync(
      modelPath,
      JSON.stringify(
        {
          version: "v1",
          chainId: 11011,
          roundAddress: "0x1111111111111111111111111111111111111111",
          syncedAt: "2026-02-12T16:30:00.000Z",
          cursor: {
            fromBlock: { __bigint__: "100" },
            toBlock: { __bigint__: "120" },
          },
          phase: 3,
          gen: 4,
          maxGen: 256,
          maxBatch: 16,
          lifecycle: {
            finalized: true,
            finalGen: 4,
            winnerPoolFinal: { __bigint__: "8" },
          },
          eventCounts: {
            stepped: 2,
            finalized: 1,
            claimed: 1,
          },
          accounting: {
            totalFunded: { __bigint__: "11" },
            winnerPaid: { __bigint__: "6" },
            keeperPaid: { __bigint__: "2" },
            treasuryDust: { __bigint__: "3" },
            derivedKeeperPaid: { __bigint__: "2" },
            accountedTotal: { __bigint__: "11" },
            invariantHolds: true,
            reconciliationStatus: "ok",
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
      round: {
        roundAddress: string;
        chainId: number;
      };
      accounting: {
        totalFunded: string;
        invariantHolds: boolean | null;
      };
      source: {
        path: string;
      };
    };

    expect(body.round.roundAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(body.round.chainId).toBe(11011);
    expect(body.accounting.totalFunded).toBe("11");
    expect(body.accounting.invariantHolds).toBe(true);
    expect(body.source.path).toBe(modelPath);
  });

  it("returns 503 when read model file is missing", async () => {
    process.env.INDEXER_READ_MODEL_PATH = join(tmpdir(), "shape-of-life-missing-round-live.json");

    const response = await GET();
    expect(response.status).toBe(503);

    const body = (await response.json()) as {
      error: string;
      status: string;
    };

    expect(body.status).toBe("unavailable");
    expect(body.error).toContain("read model");
  });
});
