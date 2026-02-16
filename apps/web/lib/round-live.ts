import type { ParticipantEntry, KeeperEntry } from "./round-feeds";

export type RoundLivePayload = {
  round: {
    chainId: number;
    roundAddress: string;
    phase: number;
    gen: number;
    maxGen: number;
    maxBatch: number;
    finalized: boolean;
    finalGen: number | null;
  };
  events: {
    stepped: number;
    finalized: number;
    claimed: number;
  };
  accounting: {
    totalFunded: string;
    winnerPaid: string;
    keeperPaid: string;
    treasuryDust: string;
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
  participants: ParticipantEntry[];
  keepers: KeeperEntry[];
};

export type RoundLiveState = {
  payload: RoundLivePayload | null;
  error: string | null;
  isFetching: boolean;
};
