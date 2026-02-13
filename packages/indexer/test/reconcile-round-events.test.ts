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
      playerClaimed: [],
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
        playerClaimed: [],
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
        playerClaimed: [],
      }),
    ).toThrow("missing finalized event");
  });

  it("derives winnerPaid from playerClaimed when no bulk Claimed events exist", () => {
    const result = reconcileRoundEvents({
      totalFunded: 10n,
      stepped: [{ fromGen: 0, toGen: 4, reward: 1n }],
      finalized: {
        finalGen: 4,
        winnerPoolFinal: 9n,
        keeperPaid: 1n,
        treasuryDust: 0n,
      },
      claimed: [],
      playerClaimed: [
        { player: "0xaaa", slotIndex: 0, amount: 3n },
        { player: "0xbbb", slotIndex: 1, amount: 3n },
        { player: "0xccc", slotIndex: 2, amount: 3n },
      ],
    });

    expect(result.derivedKeeperPaid).toBe(1n);
    expect(result.accountedTotal).toBe(10n);
    expect(result.invariantHolds).toBe(true);
  });
});
