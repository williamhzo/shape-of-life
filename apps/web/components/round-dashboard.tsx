"use client";

import { KeeperFeed } from "@/components/keeper-feed";
import { ParticipantList } from "@/components/participant-list";
import { RoundEndCard } from "@/components/round-end-card";
import { RoundLivePanel } from "@/components/round-live-panel";
import { RoundWalletPanel } from "@/components/round-wallet-panel";
import { useRoundLive } from "@/hooks/use-round-live";

export function RoundDashboard() {
  const { payload, error } = useRoundLive();

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
