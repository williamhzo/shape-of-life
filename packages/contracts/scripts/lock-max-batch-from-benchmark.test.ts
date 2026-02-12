import { describe, expect, test } from "bun:test";
import { parseBenchmarkArtifact, withLockedMaxBatch } from "./lock-max-batch-from-benchmark";

describe("lock max batch from benchmark utilities", () => {
  test("parses benchmark artifact with locked max batch", () => {
    const parsed = parseBenchmarkArtifact(
      JSON.stringify({
        roundAddress: "0xabc",
        measuredAt: "2026-02-12T00:00:00.000Z",
        lockedMaxBatch: 24,
      })
    );

    expect(parsed.lockedMaxBatch).toBe(24);
    expect(parsed.roundAddress).toBe("0xabc");
  });

  test("rejects benchmark payload missing locked max batch", () => {
    expect(() =>
      parseBenchmarkArtifact(
        JSON.stringify({
          roundAddress: "0xabc",
          measuredAt: "2026-02-12T00:00:00.000Z",
        })
      )
    ).toThrow("benchmark artifact missing valid lockedMaxBatch");
  });

  test("updates shape sepolia ignition params with locked max batch", () => {
    const next = withLockedMaxBatch(
      JSON.stringify({
        ConwayArenaRoundModule: {
          commitDuration: 90,
          revealDuration: 60,
          maxGen: 256,
          maxBatch: 16,
        },
      }),
      20
    );

    const parsed = JSON.parse(next) as {
      ConwayArenaRoundModule: { maxBatch: number };
    };

    expect(parsed.ConwayArenaRoundModule.maxBatch).toBe(20);
  });
});
