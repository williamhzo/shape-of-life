"use client";

import { Suspense, useCallback, useRef, useSyncExternalStore } from "react";
import type { Address } from "viem";

import { BoardCanvas, type BoardCanvasMode } from "@/components/board-canvas";
import { DebugPanel } from "@/components/debug-panel";
import { JoinSheet } from "@/components/join/join-sheet";
import { RoundEndDialog } from "@/components/round-end-card";
import { RoundInfoCollapsible } from "@/components/round-info-collapsible";
import { RoundStatusBar } from "@/components/round-status-bar";
import { useBoardState } from "@/hooks/use-board-state";
import { useRoundLive } from "@/hooks/use-round-live";

function useDialogDismissed() {
  const dismissed = useRef(false);
  const listeners = useRef(new Set<() => void>());

  const subscribe = useCallback((cb: () => void) => {
    listeners.current.add(cb);
    return () => { listeners.current.delete(cb); };
  }, []);

  const getSnapshot = useCallback(() => dismissed.current, []);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    listeners.current.forEach((cb) => cb());
  }, []);

  const reopen = useCallback(() => {
    dismissed.current = false;
    listeners.current.forEach((cb) => cb());
  }, []);

  return { dismissed: value, dismiss, reopen };
}

export function RoundDashboard() {
  const { payload, error, isFetching } = useRoundLive();
  const { dismissed, dismiss, reopen } = useDialogDismissed();

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

  const finalized = payload?.round.finalized && payload.scoring;
  const dialogOpen = !!finalized && !dismissed;

  return (
    <>
      <BoardCanvas mode={boardMode} />

      <RoundStatusBar
        payload={payload}
        error={error}
        isFetching={isFetching}
        onViewResults={finalized ? reopen : undefined}
      />

      <RoundInfoCollapsible
        participants={payload?.participants ?? []}
        keepers={payload?.keepers ?? []}
      />

      <JoinSheet participants={payload?.participants ?? []} />

      {finalized ? (
        <RoundEndDialog
          open={dialogOpen}
          onOpenChange={(open) => { if (!open) dismiss(); }}
          scoring={payload.scoring!}
          accounting={payload.accounting}
          participants={payload.participants}
          roundAddress={payload.round.roundAddress}
        />
      ) : null}

      <Suspense>
        <DebugPanel payload={payload} />
      </Suspense>
    </>
  );
}
