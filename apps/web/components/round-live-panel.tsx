"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RoundLivePayload } from "@/lib/round-live";

export function RoundLivePanel({
  payload,
  error,
  isFetching,
}: {
  payload: RoundLivePayload | null;
  error: string | null;
  isFetching: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Round Live State</CardTitle>
          <p className="text-sm text-muted-foreground">Live contract state.</p>
        </div>
        {payload ? (
          <Badge variant="secondary">{isFetching ? "Fetching..." : "Live"}</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {!payload ? <p className="text-muted-foreground">Waiting for contract state\u2026</p> : null}
        {payload ? (
          <>
            <p className="break-all">Round: {payload.round.roundAddress}</p>
            <p>
              Phase {payload.round.phase}, generation {payload.round.gen}/{payload.round.maxGen}
            </p>
            <Separator />
            <p>
              Events: stepped {payload.events.stepped}, finalized {payload.events.finalized}, claimed {payload.events.claimed}
            </p>
            <p>
              Accounting: funded {payload.accounting.totalFunded}, paid winners {payload.accounting.winnerPaid}, paid keepers {payload.accounting.keeperPaid}, dust {payload.accounting.treasuryDust}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
