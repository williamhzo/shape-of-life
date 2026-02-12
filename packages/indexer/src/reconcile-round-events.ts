export type SteppedEvent = {
  fromGen: number;
  toGen: number;
  reward: bigint;
};

export type FinalizedEvent = {
  finalGen: number;
  winnerPoolFinal: bigint;
  keeperPaid: bigint;
  treasuryDust: bigint;
};

export type ClaimedEvent = {
  distributed: bigint;
  cumulativeWinnerPaid: bigint;
  treasuryDust: bigint;
  remainingWinnerPool: bigint;
};

export type RoundEventStream = {
  totalFunded: bigint;
  stepped: SteppedEvent[];
  finalized: FinalizedEvent | null;
  claimed: ClaimedEvent[];
};

export type ReconciliationResult = {
  derivedKeeperPaid: bigint;
  accountedTotal: bigint;
  invariantHolds: boolean;
};

export function reconcileRoundEvents(stream: RoundEventStream): ReconciliationResult {
  if (stream.finalized === null) {
    throw new Error("missing finalized event");
  }

  const derivedKeeperPaid = stream.stepped.reduce((acc, event) => acc + event.reward, 0n);
  if (derivedKeeperPaid !== stream.finalized.keeperPaid) {
    throw new Error("keeper paid mismatch");
  }

  const lastClaim = stream.claimed.length === 0 ? null : stream.claimed[stream.claimed.length - 1];
  const winnerPaid = lastClaim?.cumulativeWinnerPaid ?? 0n;
  const treasuryDust = lastClaim?.treasuryDust ?? stream.finalized.treasuryDust;
  const accountedTotal = winnerPaid + stream.finalized.keeperPaid + treasuryDust;

  return {
    derivedKeeperPaid,
    accountedTotal,
    invariantHolds: accountedTotal <= stream.totalFunded,
  };
}
