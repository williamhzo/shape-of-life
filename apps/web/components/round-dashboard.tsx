"use client";

import { KeeperFeed } from "@/components/keeper-feed";
import { ParticipantList } from "@/components/participant-list";
import { RoundLivePanel } from "@/components/round-live-panel";
import { RoundWalletPanel } from "@/components/round-wallet-panel";
import { useRoundLive } from "@/hooks/use-round-live";

export function RoundDashboard() {
  const { payload, error } = useRoundLive();

  return (
    <>
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
