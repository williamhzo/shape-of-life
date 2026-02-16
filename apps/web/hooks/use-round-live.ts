"use client";

import { useMemo } from "react";
import type { RoundLivePayload, RoundLiveState } from "@/lib/round-live";
import {
  buildParticipantRoster,
  buildKeeperLeaderboard,
} from "@/lib/round-feeds";
import { TARGET_CHAIN } from "@/lib/wagmi-config";
import { useCurrentRound } from "./use-current-round";
import { useRoundState } from "./use-round-state";
import { useRoundEvents } from "./use-round-events";

const PHASE_CLAIM = 3;

export function useRoundLive(): RoundLiveState {
  const { roundAddress } = useCurrentRound();
  const stateResult = useRoundState(roundAddress);
  const eventsResult = useRoundEvents(roundAddress);

  const payload = useMemo((): RoundLivePayload | null => {
    if (!stateResult.data || !roundAddress) return null;

    const d = stateResult.data;
    if (d.some((r) => r.status === "failure")) return null;

    const phase = Number(d[0].result);
    const gen = Number(d[1].result);
    const maxGen = Number(d[2].result);
    const maxBatch = Number(d[3].result);
    const totalFunded = d[4].result as bigint;
    const winnerPaid = d[5].result as bigint;
    const keeperPaid = d[6].result as bigint;
    const treasuryDust = d[7].result as bigint;
    const winnerTeam = Number(d[8].result);
    const scoreBlue = Number(d[9].result);
    const scoreRed = Number(d[10].result);
    const finalBluePopulation = Number(d[11].result);
    const finalRedPopulation = Number(d[12].result);
    const finalBlueInvasion = Number(d[13].result);
    const finalRedInvasion = Number(d[14].result);
    const payoutPerClaim = d[15].result as bigint;
    const blueExtinct = d[16].result as boolean;
    const redExtinct = d[17].result as boolean;

    const finalized = phase === PHASE_CLAIM;

    const eventData = eventsResult.data;

    const committed = eventData?.committed ?? [];
    const revealed = eventData?.revealed ?? [];
    const stepped = eventData?.stepped ?? [];
    const playerClaimed = eventData?.playerClaimed ?? [];

    const participants = buildParticipantRoster({
      committed: committed.map((l) => ({
        player: l.args.player!,
        team: Number(l.args.team!),
        slotIndex: Number(l.args.slotIndex!),
      })),
      revealed: revealed.map((l) => ({
        player: l.args.player!,
        team: Number(l.args.team!),
        slotIndex: Number(l.args.slotIndex!),
      })),
      playerClaimed: playerClaimed.map((l) => ({
        player: l.args.player!,
        slotIndex: Number(l.args.slotIndex!),
        amount: l.args.amount!,
      })),
    });

    const keepers = buildKeeperLeaderboard(
      stepped.map((l) => ({
        keeper: l.args.keeper!,
        fromGen: Number(l.args.fromGen!),
        toGen: Number(l.args.toGen!),
        reward: l.args.reward!,
      })),
    );

    return {
      round: {
        chainId: TARGET_CHAIN.id,
        roundAddress,
        phase,
        gen,
        maxGen,
        maxBatch,
        finalized,
        finalGen: finalized ? gen : null,
      },
      events: {
        stepped: stepped.length,
        finalized: finalized ? 1 : 0,
        claimed: playerClaimed.length,
      },
      accounting: {
        totalFunded: totalFunded.toString(),
        winnerPaid: winnerPaid.toString(),
        keeperPaid: keeperPaid.toString(),
        treasuryDust: treasuryDust.toString(),
      },
      scoring: finalized
        ? {
            winnerTeam,
            scoreBlue,
            scoreRed,
            finalBluePopulation,
            finalRedPopulation,
            finalBlueInvasion,
            finalRedInvasion,
            payoutPerClaim: payoutPerClaim.toString(),
            blueExtinct,
            redExtinct,
          }
        : null,
      participants,
      keepers,
    };
  }, [roundAddress, stateResult.data, eventsResult.data]);

  return {
    payload,
    error:
      stateResult.error?.message ?? eventsResult.error?.message ?? null,
    isFetching: stateResult.isFetching || eventsResult.isFetching,
  };
}
