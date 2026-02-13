import type { RoundLivePayload } from "@/lib/round-live";
import type { ParticipantEntry } from "@/lib/round-feeds";
import { WINNER_DRAW } from "@/lib/round-rules";

type Scoring = NonNullable<RoundLivePayload["scoring"]>;

export type WinCondition = "extinction" | "score" | "draw";

export type WinnerAnnouncement = {
  winnerTeam: number;
  winCondition: WinCondition;
  label: string;
};

export type ClaimEligibility = {
  eligible: boolean;
  reason?: string;
  slotIndex?: number;
};

export type PayoutSummary = {
  prizePool: string;
  perWinnerShare: string;
  eligibleCount: number;
  claimedCount: number;
};

export function deriveWinCondition(scoring: Scoring): WinCondition {
  if (scoring.blueExtinct && scoring.redExtinct) return "draw";
  if (scoring.blueExtinct || scoring.redExtinct) return "extinction";
  if (scoring.winnerTeam === WINNER_DRAW) return "draw";
  return "score";
}

export function deriveWinnerAnnouncement(scoring: Scoring): WinnerAnnouncement {
  const winCondition = deriveWinCondition(scoring);

  if (winCondition === "draw") {
    return { winnerTeam: WINNER_DRAW, winCondition, label: `Draw (${scoring.scoreBlue}-${scoring.scoreRed})` };
  }

  const teamName = scoring.winnerTeam === 0 ? "Blue" : "Red";

  if (winCondition === "extinction") {
    return { winnerTeam: scoring.winnerTeam, winCondition, label: `${teamName} wins by extinction` };
  }

  const winnerScore = scoring.winnerTeam === 0 ? scoring.scoreBlue : scoring.scoreRed;
  const loserScore = scoring.winnerTeam === 0 ? scoring.scoreRed : scoring.scoreBlue;
  return { winnerTeam: scoring.winnerTeam, winCondition, label: `${teamName} wins ${winnerScore}-${loserScore}` };
}

export function deriveClaimEligibility(params: {
  address: string | undefined;
  scoring: Scoring;
  participants: ParticipantEntry[];
}): ClaimEligibility {
  if (!params.address) {
    return { eligible: false, reason: "Connect wallet" };
  }

  const entry = params.participants.find(
    (p) => p.address.toLowerCase() === params.address!.toLowerCase(),
  );

  if (!entry) {
    return { eligible: false, reason: "You are not a participant in this round" };
  }

  if (!entry.revealed) {
    return { eligible: false, reason: "Seed not revealed" };
  }

  if (entry.claimedAmount !== null) {
    return { eligible: false, reason: "Prize already claimed" };
  }

  const isDraw = params.scoring.winnerTeam === WINNER_DRAW;
  if (!isDraw && entry.team !== params.scoring.winnerTeam) {
    return { eligible: false, reason: "On the losing team" };
  }

  return { eligible: true, slotIndex: entry.slotIndex };
}

export function derivePayoutSummary(params: {
  scoring: Scoring;
  accounting: RoundLivePayload["accounting"];
  participants: ParticipantEntry[];
}): PayoutSummary {
  const isDraw = params.scoring.winnerTeam === WINNER_DRAW;

  const eligible = params.participants.filter(
    (p) => p.revealed && (isDraw || p.team === params.scoring.winnerTeam),
  );

  const claimed = eligible.filter((p) => p.claimedAmount !== null);

  return {
    prizePool: params.accounting.totalFunded,
    perWinnerShare: params.scoring.payoutPerClaim,
    eligibleCount: eligible.length,
    claimedCount: claimed.length,
  };
}
