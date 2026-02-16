"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JoinFlowReturn } from "@/hooks/use-join-flow";

type TransactionActionsProps = Pick<
  JoinFlowReturn,
  | "draft"
  | "updateDraft"
  | "editorDisabled"
  | "txControlsDisabled"
  | "txFeedback"
  | "txStageLabel"
  | "txBadgeVariant"
  | "pendingAction"
  | "displayedStatus"
  | "sendTransaction"
>;

export function TransactionActions({
  draft,
  updateDraft,
  editorDisabled,
  txControlsDisabled,
  txFeedback,
  txStageLabel,
  txBadgeVariant,
  pendingAction,
  displayedStatus,
  sendTransaction,
}: TransactionActionsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" size="sm" onClick={() => void sendTransaction("commit")} disabled={txControlsDisabled}>
          {pendingAction === "commit" ? "Committing\u2026" : "Commit"}
        </Button>
        <Button type="button" size="sm" onClick={() => void sendTransaction("reveal")} disabled={txControlsDisabled}>
          {pendingAction === "reveal" ? "Revealing\u2026" : "Reveal"}
        </Button>
        <Button type="button" size="sm" onClick={() => void sendTransaction("claim")} disabled={txControlsDisabled}>
          {pendingAction === "claim" ? "Claiming\u2026" : "Claim"}
        </Button>
      </div>

      {txFeedback.stage !== "idle" ? (
        <div className="space-y-1 rounded-md border p-2 text-xs" aria-live="polite">
          <div className="flex items-center justify-between">
            <Badge variant={txBadgeVariant(txFeedback.stage)} className="text-[10px]">
              {txStageLabel(txFeedback.stage)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{txFeedback.message}</p>
          {txFeedback.txHash ? (
            <p className="break-all text-muted-foreground">Tx: {txFeedback.txHash}</p>
          ) : null}
        </div>
      ) : null}

      {displayedStatus ? (
        <p className="text-muted-foreground text-xs">{displayedStatus}</p>
      ) : null}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground">
            {advancedOpen ? "Hide" : "Show"} Advanced
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="roundId" className="text-xs">Round ID</Label>
            <Input id="roundId" value={draft.roundId} disabled={editorDisabled} onChange={(e) => updateDraft("roundId", e.target.value)} autoComplete="off" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="salt" className="text-xs">Salt (bytes32)</Label>
            <Input id="salt" value={draft.salt} disabled={editorDisabled} onChange={(e) => updateDraft("salt", e.target.value)} autoComplete="off" spellCheck={false} className="h-8 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="claimSlotIndex" className="text-xs">Claim Slot Index</Label>
            <Input id="claimSlotIndex" value={draft.claimSlotIndex} disabled={editorDisabled} onChange={(e) => updateDraft("claimSlotIndex", e.target.value)} autoComplete="off" className="h-8 text-xs" />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
