"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RoundLivePayload } from "@/lib/round-live";

function formatAge(ageMs: number): string {
  if (!Number.isFinite(ageMs)) {
    return "unknown";
  }

  return `${Math.floor(ageMs / 1000)}s`;
}

export function RoundLivePanel({
  payload,
  error,
}: {
  payload: RoundLivePayload | null;
  error: string | null;
}) {
  const freshnessBadge = useMemo(() => {
    if (!payload) {
      return null;
    }

    if (payload.source.stale) {
      return <Badge variant="destructive">Stale</Badge>;
    }

    return <Badge variant="secondary">Live</Badge>;
  }, [payload]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Round Live State</CardTitle>
          <p className="text-sm text-muted-foreground">Polling persisted indexer read model.</p>
        </div>
        {freshnessBadge}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {!payload ? <p className="text-muted-foreground">Waiting for round snapshot...</p> : null}
        {payload ? (
          <>
            <p>Round: {payload.round.roundAddress}</p>
            <p>
              Phase {payload.round.phase}, generation {payload.round.gen}/{payload.round.maxGen}
            </p>
            <p>
              Synced {formatAge(payload.source.ageMs)} ago ({payload.source.syncedAt})
            </p>
            <Separator />
            <p>
              Events: stepped {payload.events.stepped}, finalized {payload.events.finalized}, claimed {payload.events.claimed}
            </p>
            <p>
              Accounting: funded {payload.accounting.totalFunded}, paid winners {payload.accounting.winnerPaid}, paid keepers {payload.accounting.keeperPaid}, dust {payload.accounting.treasuryDust}
            </p>
            <p>
              Reconciliation: {payload.accounting.reconciliationStatus}
              {payload.accounting.invariantHolds === null
                ? ""
                : payload.accounting.invariantHolds
                  ? " (invariant holds)"
                  : " (invariant violated)"}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
