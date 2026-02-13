import { afterEach, describe, expect, it } from "vitest";
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
          events: {
            committed: [
              { player: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", team: 0, slotIndex: 3 },
            ],
            revealed: [
              { player: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", team: 0, slotIndex: 3 },
            ],
            playerClaimed: [
              { player: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", slotIndex: 3, amount: { __bigint__: "5000" } },
            ],
            stepped: [
              { keeper: "0x1111111111111111111111111111111111111111", fromGen: 0, toGen: 2, reward: { __bigint__: "100" } },
              { keeper: "0x1111111111111111111111111111111111111111", fromGen: 2, toGen: 4, reward: { __bigint__: "100" } },
            ],
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
          scoring: {
            winnerTeam: 0,
            scoreBlue: 438,
            scoreRed: 312,
            finalBluePopulation: 120,
            finalRedPopulation: 80,
            finalBlueInvasion: 39,
            finalRedInvasion: 36,
            payoutPerClaim: { __bigint__: "3" },
            blueExtinct: false,
            redExtinct: false,
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
      scoring: {
        winnerTeam: number;
        scoreBlue: number;
        scoreRed: number;
        finalBluePopulation: number;
        finalRedPopulation: number;
        finalBlueInvasion: number;
        finalRedInvasion: number;
        payoutPerClaim: string;
        blueExtinct: boolean;
        redExtinct: boolean;
      } | null;
      participants: Array<{
        address: string;
        team: number;
        slotIndex: number;
        committed: boolean;
        revealed: boolean;
        claimedAmount: string | null;
      }>;
      keepers: Array<{
        address: string;
        totalReward: string;
        stepCount: number;
        gensAdvanced: number;
      }>;
    };

    expect(body.round.roundAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(body.round.chainId).toBe(11011);
    expect(body.accounting.totalFunded).toBe("11");
    expect(body.accounting.invariantHolds).toBe(true);
    expect(body.source.path).toBe(modelPath);

    expect(body.participants).toHaveLength(1);
    expect(body.participants[0].address).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(body.participants[0].revealed).toBe(true);
    expect(body.participants[0].claimedAmount).toBe("5000");

    expect(body.keepers).toHaveLength(1);
    expect(body.keepers[0].address).toBe("0x1111111111111111111111111111111111111111");
    expect(body.keepers[0].totalReward).toBe("200");
    expect(body.keepers[0].stepCount).toBe(2);
    expect(body.keepers[0].gensAdvanced).toBe(4);

    expect(body.scoring).not.toBeNull();
    expect(body.scoring!.winnerTeam).toBe(0);
    expect(body.scoring!.scoreBlue).toBe(438);
    expect(body.scoring!.scoreRed).toBe(312);
    expect(body.scoring!.payoutPerClaim).toBe("3");
    expect(body.scoring!.blueExtinct).toBe(false);
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
