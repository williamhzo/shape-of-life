"use client";

import type { Address } from "viem";

import { BoardCanvas, type BoardCanvasMode } from "@/components/board-canvas";
import { KeeperFeed } from "@/components/keeper-feed";
import { ParticipantList } from "@/components/participant-list";
import { RoundEndCard } from "@/components/round-end-card";
import { RoundLivePanel } from "@/components/round-live-panel";
import { RoundWalletPanel } from "@/components/round-wallet-panel";
import { useBoardState } from "@/hooks/use-board-state";
import { useRoundLive } from "@/hooks/use-round-live";

export function RoundDashboard() {
  const { payload, error } = useRoundLive();

  const roundAddress = payload?.round.roundAddress as Address | undefined;
  const phase = payload?.round.phase ?? null;
  const onchainGen = payload?.round.gen ?? null;
  const maxGen = payload?.round.maxGen ?? 0;

  const { board } = useBoardState(
    phase === 2 || phase === 3 ? roundAddress ?? null : null,
    onchainGen,
  );

  let boardMode: BoardCanvasMode | undefined;
  if (phase === 2 && board) {
    boardMode = { kind: "live", board, checkpointGen: onchainGen!, maxGen };
  } else if (phase === 3 && board) {
    boardMode = { kind: "final", board, maxGen };
  }

  const showEndScreen = payload?.round.finalized && payload.scoring;

  return (
    <>
      {showEndScreen ? (
        <RoundEndCard
          scoring={payload.scoring!}
          accounting={payload.accounting}
          participants={payload.participants}
          roundAddress={payload.round.roundAddress}
        />
      ) : null}

      <BoardCanvas mode={boardMode} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RoundLivePanel payload={payload} error={error} />
        <RoundWalletPanel />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ParticipantList participants={payload?.participants ?? []} />
        <KeeperFeed keepers={payload?.keepers ?? []} />
      </div>
    </>
  );
}
