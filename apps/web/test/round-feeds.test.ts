import { describe, expect, it } from "vitest";

import {
  buildParticipantRoster,
  buildKeeperLeaderboard,
  type CommittedEvent,
  type RevealedEvent,
  type PlayerClaimedEvent,
  type SteppedEvent,
} from "@/lib/round-feeds";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CAROL = "0xcccccccccccccccccccccccccccccccccccccccc";
const KEEPER_A = "0x1111111111111111111111111111111111111111";
const KEEPER_B = "0x2222222222222222222222222222222222222222";

describe("buildParticipantRoster", () => {
  it("returns empty roster for empty events", () => {
    const roster = buildParticipantRoster({
      committed: [],
      revealed: [],
      playerClaimed: [],
    });
    expect(roster).toEqual([]);
  });

  it("builds roster from committed events only (pre-reveal phase)", () => {
    const committed: CommittedEvent[] = [
      { player: ALICE, team: 0, slotIndex: 3 },
      { player: BOB, team: 1, slotIndex: 36 },
    ];

    const roster = buildParticipantRoster({
      committed,
      revealed: [],
      playerClaimed: [],
    });

    expect(roster).toHaveLength(2);
    expect(roster[0]).toEqual({
      address: ALICE,
      team: 0,
      slotIndex: 3,
      committed: true,
      revealed: false,
      claimedAmount: null,
    });
    expect(roster[1]).toEqual({
      address: BOB,
      team: 1,
      slotIndex: 36,
      committed: true,
      revealed: false,
      claimedAmount: null,
    });
  });

  it("marks revealed participants", () => {
    const committed: CommittedEvent[] = [
      { player: ALICE, team: 0, slotIndex: 3 },
      { player: BOB, team: 1, slotIndex: 36 },
    ];
    const revealed: RevealedEvent[] = [
      { player: ALICE, team: 0, slotIndex: 3 },
    ];

    const roster = buildParticipantRoster({
      committed,
      revealed,
      playerClaimed: [],
    });

    expect(roster[0].revealed).toBe(true);
    expect(roster[1].revealed).toBe(false);
  });

  it("attaches claimed amounts from playerClaimed events", () => {
    const committed: CommittedEvent[] = [
      { player: ALICE, team: 0, slotIndex: 3 },
      { player: BOB, team: 0, slotIndex: 5 },
      { player: CAROL, team: 1, slotIndex: 36 },
    ];
    const revealed: RevealedEvent[] = [
      { player: ALICE, team: 0, slotIndex: 3 },
      { player: BOB, team: 0, slotIndex: 5 },
      { player: CAROL, team: 1, slotIndex: 36 },
    ];
    const playerClaimed: PlayerClaimedEvent[] = [
      { player: ALICE, slotIndex: 3, amount: 5000n },
      { player: BOB, slotIndex: 5, amount: 5000n },
    ];

    const roster = buildParticipantRoster({
      committed,
      revealed,
      playerClaimed,
    });

    expect(roster[0].claimedAmount).toBe("5000");
    expect(roster[1].claimedAmount).toBe("5000");
    expect(roster[2].claimedAmount).toBeNull();
  });

  it("sorts roster by team then slotIndex", () => {
    const committed: CommittedEvent[] = [
      { player: CAROL, team: 1, slotIndex: 36 },
      { player: BOB, team: 0, slotIndex: 5 },
      { player: ALICE, team: 0, slotIndex: 3 },
    ];

    const roster = buildParticipantRoster({
      committed,
      revealed: [],
      playerClaimed: [],
    });

    expect(roster[0].address).toBe(ALICE);
    expect(roster[1].address).toBe(BOB);
    expect(roster[2].address).toBe(CAROL);
  });
});

describe("buildKeeperLeaderboard", () => {
  it("returns empty leaderboard for empty events", () => {
    const leaderboard = buildKeeperLeaderboard([]);
    expect(leaderboard).toEqual([]);
  });

  it("aggregates single keeper across multiple step events", () => {
    const stepped: SteppedEvent[] = [
      { keeper: KEEPER_A, fromGen: 0, toGen: 16, reward: 100n },
      { keeper: KEEPER_A, fromGen: 16, toGen: 32, reward: 100n },
    ];

    const leaderboard = buildKeeperLeaderboard(stepped);

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0]).toEqual({
      address: KEEPER_A,
      totalReward: "200",
      stepCount: 2,
      gensAdvanced: 32,
    });
  });

  it("ranks keepers by total reward descending", () => {
    const stepped: SteppedEvent[] = [
      { keeper: KEEPER_B, fromGen: 0, toGen: 16, reward: 300n },
      { keeper: KEEPER_A, fromGen: 16, toGen: 48, reward: 100n },
      { keeper: KEEPER_B, fromGen: 48, toGen: 64, reward: 300n },
    ];

    const leaderboard = buildKeeperLeaderboard(stepped);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0].address).toBe(KEEPER_B);
    expect(leaderboard[0].totalReward).toBe("600");
    expect(leaderboard[0].stepCount).toBe(2);
    expect(leaderboard[0].gensAdvanced).toBe(32);
    expect(leaderboard[1].address).toBe(KEEPER_A);
    expect(leaderboard[1].totalReward).toBe("100");
    expect(leaderboard[1].gensAdvanced).toBe(32);
  });

  it("handles single step event", () => {
    const stepped: SteppedEvent[] = [
      { keeper: KEEPER_A, fromGen: 0, toGen: 8, reward: 50n },
    ];

    const leaderboard = buildKeeperLeaderboard(stepped);

    expect(leaderboard).toEqual([
      {
        address: KEEPER_A,
        totalReward: "50",
        stepCount: 1,
        gensAdvanced: 8,
      },
    ]);
  });
});
