import { describe, expect, it } from "bun:test";
import { reconcileRoundEvents } from "../src/reconcile-round-events";

describe("reconcileRoundEvents", () => {
  it("reconciles stepped/finalized/claimed accounting totals", () => {
    const result = reconcileRoundEvents({
      totalFunded: 11n,
      stepped: [
        { fromGen: 0, toGen: 2, reward: 2n },
        { fromGen: 2, toGen: 4, reward: 0n },
      ],
      finalized: {
        finalGen: 4,
        winnerPoolFinal: 8n,
        keeperPaid: 2n,
        treasuryDust: 1n,
      },
      claimed: [
        {
          distributed: 6n,
          cumulativeWinnerPaid: 6n,
          treasuryDust: 3n,
          remainingWinnerPool: 0n,
        },
      ],
    });

    expect(result.derivedKeeperPaid).toBe(2n);
    expect(result.accountedTotal).toBe(11n);
    expect(result.invariantHolds).toBe(true);
  });

  it("throws when stepped rewards diverge from finalized keeperPaid", () => {
    expect(() =>
      reconcileRoundEvents({
        totalFunded: 10n,
        stepped: [{ fromGen: 0, toGen: 1, reward: 1n }],
        finalized: {
          finalGen: 1,
          winnerPoolFinal: 8n,
          keeperPaid: 2n,
          treasuryDust: 0n,
        },
        claimed: [],
      }),
    ).toThrow("keeper paid mismatch");
  });

  it("throws when finalize event is missing", () => {
    expect(() =>
      reconcileRoundEvents({
        totalFunded: 10n,
        stepped: [],
        finalized: null,
        claimed: [],
      }),
    ).toThrow("missing finalized event");
  });
});
