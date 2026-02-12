"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RoundLivePayload } from "@/lib/round-live";

type RoundLiveState = {
  payload: RoundLivePayload | null;
  error: string | null;
};

const POLL_MS = 5000;

function formatAge(ageMs: number): string {
  if (!Number.isFinite(ageMs)) {
    return "unknown";
  }

  return `${Math.floor(ageMs / 1000)}s`;
}

export function RoundLivePanel() {
  const [state, setState] = useState<RoundLiveState>({ payload: null, error: null });

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/round/live", { cache: "no-store" });
        if (!response.ok) {
          const failure = (await response.json()) as { error?: string };
          throw new Error(failure.error ?? `request failed (${response.status})`);
        }

        const payload = (await response.json()) as RoundLivePayload;
        if (!cancelled) {
          setState({ payload, error: null });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (!cancelled) {
          setState((previous) => ({ payload: previous.payload, error: message }));
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const freshnessBadge = useMemo(() => {
    if (!state.payload) {
      return null;
    }

    if (state.payload.source.stale) {
      return <Badge variant="destructive">Stale</Badge>;
    }

    return <Badge variant="secondary">Live</Badge>;
  }, [state.payload]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Round Live State</CardTitle>
          <p className="text-sm text-muted-foreground">Polling persisted indexer read model every {POLL_MS / 1000}s.</p>
        </div>
        {freshnessBadge}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {state.error ? <p className="text-destructive">{state.error}</p> : null}
        {!state.payload ? <p className="text-muted-foreground">Waiting for round snapshot...</p> : null}
        {state.payload ? (
          <>
            <p>Round: {state.payload.round.roundAddress}</p>
            <p>
              Phase {state.payload.round.phase}, generation {state.payload.round.gen}/{state.payload.round.maxGen}
            </p>
            <p>
              Synced {formatAge(state.payload.source.ageMs)} ago ({state.payload.source.syncedAt})
            </p>
            <Separator />
            <p>
              Events: stepped {state.payload.events.stepped}, finalized {state.payload.events.finalized}, claimed {state.payload.events.claimed}
            </p>
            <p>
              Accounting: funded {state.payload.accounting.totalFunded}, paid winners {state.payload.accounting.winnerPaid}, paid keepers {state.payload.accounting.keeperPaid}, dust {state.payload.accounting.treasuryDust}
            </p>
            <p>
              Reconciliation: {state.payload.accounting.reconciliationStatus}
              {state.payload.accounting.invariantHolds === null
                ? ""
                : state.payload.accounting.invariantHolds
                  ? " (invariant holds)"
                  : " (invariant violated)"}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
