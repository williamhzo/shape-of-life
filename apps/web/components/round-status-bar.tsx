"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { RoundLivePayload } from "@/lib/round-live";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<number, string> = {
  0: "Setup",
  1: "Commit",
  2: "Simulating",
  3: "Complete",
};

function phaseBadgeVariant(phase: number): "default" | "secondary" | "destructive" {
  if (phase === 3) return "default";
  if (phase === 2) return "destructive";
  return "secondary";
}

export function RoundStatusBar({
  payload,
  error,
  isFetching,
  onViewResults,
}: {
  payload: RoundLivePayload | null;
  error: string | null;
  isFetching: boolean;
  onViewResults?: () => void;
}) {
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/50 p-3 text-sm">
        <Badge variant="destructive">Error</Badge>
        <span className="text-destructive">{error}</span>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">{isFetching ? "Loading round state..." : "Waiting for contract state..."}</span>
      </div>
    );
  }

  const { phase, gen, maxGen, finalized } = payload.round;
  const phaseLabel = PHASE_LABELS[phase] ?? `Phase ${phase}`;
  const genProgress = maxGen > 0 ? Math.round((gen / maxGen) * 100) : 0;
  const participantCount = payload.participants.length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      <Badge variant={phaseBadgeVariant(phase)}>{phaseLabel}</Badge>

      <div className="flex min-w-[120px] flex-1 items-center gap-2">
        <Progress value={genProgress} className="h-2" />
        <span className="text-muted-foreground whitespace-nowrap tabular-nums text-xs">
          {gen}/{maxGen}
        </span>
      </div>

      <span className="text-muted-foreground tabular-nums text-xs">
        {participantCount} player{participantCount !== 1 ? "s" : ""}
      </span>

      <span className={cn("size-2 rounded-full", isFetching ? "bg-yellow-500" : "bg-green-500")} />

      {finalized && onViewResults ? (
        <Button variant="outline" size="sm" onClick={onViewResults}>
          View Results
        </Button>
      ) : null}
    </div>
  );
}
