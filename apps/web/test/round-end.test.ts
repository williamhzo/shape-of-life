import { describe, expect, it } from "vitest";
import {
  deriveWinCondition,
  deriveWinnerAnnouncement,
  deriveClaimEligibility,
  derivePayoutSummary,
} from "../lib/round-end";
import type { RoundLivePayload } from "../lib/round-live";
import type { ParticipantEntry } from "../lib/round-feeds";

type Scoring = NonNullable<RoundLivePayload["scoring"]>;

function baseScoring(overrides: Partial<Scoring> = {}): Scoring {
  return {
    winnerTeam: 0,
    scoreBlue: 438,
    scoreRed: 312,
    finalBluePopulation: 120,
    finalRedPopulation: 80,
    finalBlueInvasion: 39,
    finalRedInvasion: 36,
    payoutPerClaim: "3000000000000000000",
    blueExtinct: false,
    redExtinct: false,
    ...overrides,
  };
}

function participant(overrides: Partial<ParticipantEntry> = {}): ParticipantEntry {
  return {
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    team: 0,
    slotIndex: 3,
    committed: true,
    revealed: true,
    claimedAmount: null,
    ...overrides,
  };
}

describe("deriveWinCondition", () => {
  it("returns extinction when red is extinct", () => {
    expect(deriveWinCondition(baseScoring({ redExtinct: true }))).toBe("extinction");
  });

  it("returns extinction when blue is extinct", () => {
    expect(deriveWinCondition(baseScoring({ blueExtinct: true }))).toBe("extinction");
  });

  it("returns score when neither extinct and scores differ", () => {
    expect(deriveWinCondition(baseScoring())).toBe("score");
  });

  it("returns draw when scores are equal", () => {
    expect(deriveWinCondition(baseScoring({ scoreBlue: 300, scoreRed: 300, winnerTeam: 2 }))).toBe("draw");
  });

  it("returns draw when both extinct", () => {
    expect(deriveWinCondition(baseScoring({ blueExtinct: true, redExtinct: true, winnerTeam: 2 }))).toBe("draw");
  });
});

describe("deriveWinnerAnnouncement", () => {
  it("announces blue wins by extinction", () => {
    const result = deriveWinnerAnnouncement(baseScoring({ redExtinct: true }));
    expect(result.winnerTeam).toBe(0);
    expect(result.winCondition).toBe("extinction");
    expect(result.label).toContain("Blue");
    expect(result.label).toContain("extinction");
  });

  it("announces red wins by score", () => {
    const scoring = baseScoring({ winnerTeam: 1, scoreBlue: 200, scoreRed: 400 });
    const result = deriveWinnerAnnouncement(scoring);
    expect(result.winnerTeam).toBe(1);
    expect(result.winCondition).toBe("score");
    expect(result.label).toContain("Red");
    expect(result.label).toContain("400");
    expect(result.label).toContain("200");
  });

  it("announces draw", () => {
    const scoring = baseScoring({ winnerTeam: 2, scoreBlue: 300, scoreRed: 300 });
    const result = deriveWinnerAnnouncement(scoring);
    expect(result.winnerTeam).toBe(2);
    expect(result.winCondition).toBe("draw");
    expect(result.label).toContain("Draw");
  });
});

describe("deriveClaimEligibility", () => {
  it("returns ineligible when no address", () => {
    const result = deriveClaimEligibility({
      address: undefined,
      scoring: baseScoring(),
      participants: [participant()],
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Connect wallet");
  });

  it("returns ineligible when not a participant", () => {
    const result = deriveClaimEligibility({
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scoring: baseScoring(),
      participants: [participant()],
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("not a participant");
  });

  it("returns ineligible for losing team", () => {
    const result = deriveClaimEligibility({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoring: baseScoring({ winnerTeam: 1 }),
      participants: [participant({ team: 0 })],
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("losing team");
  });

  it("returns ineligible when not revealed", () => {
    const result = deriveClaimEligibility({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoring: baseScoring(),
      participants: [participant({ revealed: false })],
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("not revealed");
  });

  it("returns ineligible when already claimed", () => {
    const result = deriveClaimEligibility({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoring: baseScoring(),
      participants: [participant({ claimedAmount: "5000" })],
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("already claimed");
  });

  it("returns eligible for winning team, revealed, unclaimed", () => {
    const result = deriveClaimEligibility({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoring: baseScoring({ winnerTeam: 0 }),
      participants: [participant({ team: 0, revealed: true })],
    });
    expect(result.eligible).toBe(true);
    expect(result.slotIndex).toBe(3);
  });

  it("returns eligible for both teams on draw", () => {
    const scoring = baseScoring({ winnerTeam: 2 });

    const blueResult = deriveClaimEligibility({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      scoring,
      participants: [participant({ team: 0 })],
    });
    expect(blueResult.eligible).toBe(true);

    const redResult = deriveClaimEligibility({
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      scoring,
      participants: [participant({ address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", team: 1, slotIndex: 35 })],
    });
    expect(redResult.eligible).toBe(true);
    expect(redResult.slotIndex).toBe(35);
  });
});

describe("derivePayoutSummary", () => {
  it("counts eligible and claimed for blue win", () => {
    const scoring = baseScoring({ winnerTeam: 0, payoutPerClaim: "3000000000000000000" });
    const participants = [
      participant({ address: "0xaa", team: 0, revealed: true, claimedAmount: null }),
      participant({ address: "0xbb", team: 0, revealed: true, claimedAmount: "3000000000000000000" }),
      participant({ address: "0xcc", team: 1, revealed: true, claimedAmount: null }),
      participant({ address: "0xdd", team: 0, revealed: false, claimedAmount: null }),
    ];
    const accounting = { totalFunded: "10000000000000000000", winnerPaid: "3000000000000000000", keeperPaid: "0", treasuryDust: "0" };

    const result = derivePayoutSummary({ scoring, accounting, participants });
    expect(result.eligibleCount).toBe(2);
    expect(result.claimedCount).toBe(1);
    expect(result.perWinnerShare).toBe("3000000000000000000");
  });

  it("counts both teams for draw", () => {
    const scoring = baseScoring({ winnerTeam: 2, payoutPerClaim: "1500000000000000000" });
    const participants = [
      participant({ address: "0xaa", team: 0, revealed: true }),
      participant({ address: "0xbb", team: 1, revealed: true }),
      participant({ address: "0xcc", team: 0, revealed: false }),
    ];
    const accounting = { totalFunded: "10000000000000000000", winnerPaid: "0", keeperPaid: "0", treasuryDust: "0" };

    const result = derivePayoutSummary({ scoring, accounting, participants });
    expect(result.eligibleCount).toBe(2);
    expect(result.claimedCount).toBe(0);
  });
});
