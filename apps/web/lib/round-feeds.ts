export type CommittedEvent = {
  player: string;
  team: number;
  slotIndex: number;
};

export type RevealedEvent = {
  player: string;
  team: number;
  slotIndex: number;
};

export type PlayerClaimedEvent = {
  player: string;
  slotIndex: number;
  amount: bigint;
};

export type SteppedEvent = {
  keeper: string;
  fromGen: number;
  toGen: number;
  reward: bigint;
};

export type ParticipantEntry = {
  address: string;
  team: number;
  slotIndex: number;
  committed: boolean;
  revealed: boolean;
  claimedAmount: string | null;
};

export type KeeperEntry = {
  address: string;
  totalReward: string;
  stepCount: number;
  gensAdvanced: number;
};

export function buildParticipantRoster(events: {
  committed: CommittedEvent[];
  revealed: RevealedEvent[];
  playerClaimed: PlayerClaimedEvent[];
}): ParticipantEntry[] {
  const byPlayer = new Map<string, ParticipantEntry>();

  for (const c of events.committed) {
    const key = c.player.toLowerCase();
    byPlayer.set(key, {
      address: c.player,
      team: c.team,
      slotIndex: c.slotIndex,
      committed: true,
      revealed: false,
      claimedAmount: null,
    });
  }

  for (const r of events.revealed) {
    const entry = byPlayer.get(r.player.toLowerCase());
    if (entry) {
      entry.revealed = true;
    }
  }

  for (const pc of events.playerClaimed) {
    const entry = byPlayer.get(pc.player.toLowerCase());
    if (entry) {
      entry.claimedAmount = pc.amount.toString();
    }
  }

  return Array.from(byPlayer.values()).sort((a, b) => {
    if (a.team !== b.team) return a.team - b.team;
    return a.slotIndex - b.slotIndex;
  });
}

export function buildKeeperLeaderboard(stepped: SteppedEvent[]): KeeperEntry[] {
  const byKeeper = new Map<string, { totalReward: bigint; stepCount: number; gensAdvanced: number }>();

  for (const s of stepped) {
    const key = s.keeper.toLowerCase();
    const existing = byKeeper.get(key);
    if (existing) {
      existing.totalReward += s.reward;
      existing.stepCount += 1;
      existing.gensAdvanced += s.toGen - s.fromGen;
    } else {
      byKeeper.set(key, {
        totalReward: s.reward,
        stepCount: 1,
        gensAdvanced: s.toGen - s.fromGen,
      });
    }
  }

  return Array.from(byKeeper.entries())
    .sort(([, a], [, b]) => (b.totalReward > a.totalReward ? 1 : b.totalReward < a.totalReward ? -1 : 0))
    .map(([address, data]) => ({
      address: stepped.find((s) => s.keeper.toLowerCase() === address)!.keeper,
      totalReward: data.totalReward.toString(),
      stepCount: data.stepCount,
      gensAdvanced: data.gensAdvanced,
    }));
}
