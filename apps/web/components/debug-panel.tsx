"use client";

import { useSearchParams } from "next/navigation";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { RoundLivePayload } from "@/lib/round-live";

export function DebugPanel({ payload }: { payload: RoundLivePayload | null }) {
  const searchParams = useSearchParams();

  const showDebug = process.env.NODE_ENV === "development" || searchParams.has("debug");
  if (!showDebug || !payload) return null;

  const { round, events, accounting } = payload;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="debug">
        <AccordionTrigger className="text-muted-foreground text-xs">Debug</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 break-all font-mono text-xs text-muted-foreground">
            <p>Round: {round.roundAddress}</p>
            <p>Chain: {round.chainId}</p>
            <p>Phase: {round.phase} | Gen: {round.gen}/{round.maxGen} | MaxBatch: {round.maxBatch}</p>
            <p>Finalized: {round.finalized ? "yes" : "no"}{round.finalGen !== null ? ` at gen ${round.finalGen}` : ""}</p>
            <p>Events: stepped={events.stepped} finalized={events.finalized} claimed={events.claimed}</p>
            <p>Accounting: funded={accounting.totalFunded} winnerPaid={accounting.winnerPaid} keeperPaid={accounting.keeperPaid} dust={accounting.treasuryDust}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
