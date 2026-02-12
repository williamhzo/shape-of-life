import { describe, expect, it } from "bun:test";
import { parseCastEstimate, selectLockedMaxBatch } from "./max-batch-benchmark";

describe("max batch benchmark utilities", () => {
  it("selects highest measured step count under threshold", () => {
    const locked = selectLockedMaxBatch(
      [
        { steps: 8, gasUsed: 400000n },
        { steps: 16, gasUsed: 700000n },
        { steps: 24, gasUsed: 980000n },
        { steps: 32, gasUsed: 1300000n },
      ],
      1200000n,
      8500,
    );

    expect(locked).toBe(24);
  });

  it("throws when no measured step count fits threshold", () => {
    expect(() =>
      selectLockedMaxBatch(
        [
          { steps: 8, gasUsed: 600000n },
          { steps: 16, gasUsed: 1000000n },
        ],
        500000n,
        9000,
      ),
    ).toThrow("no safe maxBatch");
  });

  it("parses cast estimate output into bigint gas", () => {
    expect(parseCastEstimate("908150\n")).toBe(908150n);
    expect(parseCastEstimate("  763470  ")).toBe(763470n);
  });
});
