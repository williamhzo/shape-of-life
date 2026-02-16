"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type Address, formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ParticipantEntry } from "@/lib/round-feeds";
import type { RoundLivePayload } from "@/lib/round-live";
import { ROUND_ABI } from "@/lib/round-tx";
import { TEAM_BLUE, TEAM_RED } from "@/lib/round-rules";
import { TARGET_CHAIN } from "@/lib/wagmi-config";
import {
  deriveWinnerAnnouncement,
  deriveClaimEligibility,
  derivePayoutSummary,
} from "@/lib/round-end";
import { cn } from "@/lib/utils";

type Scoring = NonNullable<RoundLivePayload["scoring"]>;

function teamColorClass(team: number): string {
  if (team === TEAM_BLUE) return "text-blue-400";
  if (team === TEAM_RED) return "text-red-400";
  return "text-muted-foreground";
}

function teamBadgeVariant(team: number): "default" | "secondary" | "destructive" {
  if (team === TEAM_BLUE) return "default";
  if (team === TEAM_RED) return "destructive";
  return "secondary";
}

export function RoundEndDialog({
  open,
  onOpenChange,
  scoring,
  accounting,
  participants,
  roundAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoring: Scoring;
  accounting: RoundLivePayload["accounting"];
  participants: ParticipantEntry[];
  roundAddress: string;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const announcement = useMemo(() => deriveWinnerAnnouncement(scoring), [scoring]);
  const eligibility = useMemo(
    () => deriveClaimEligibility({ address, scoring, participants }),
    [address, scoring, participants],
  );
  const payout = useMemo(
    () => derivePayoutSummary({ scoring, accounting, participants }),
    [scoring, accounting, participants],
  );

  async function handleClaim(): Promise<void> {
    if (!eligibility.eligible || eligibility.slotIndex === undefined) return;
    if (!publicClient) return;

    try {
      setClaimStatus("Simulating...");
      const simulation = await publicClient.simulateContract({
        address: roundAddress as Address,
        abi: ROUND_ABI,
        functionName: "claim",
        args: [eligibility.slotIndex],
        account: address,
      });

      setClaimStatus("Waiting for signature...");
      const txHash = await writeContractAsync(simulation.request);

      setClaimStatus("Confirming...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error("Claim transaction reverted");
      }

      setClaimStatus("Claimed successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim failed";
      setClaimStatus(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Round Complete</DialogTitle>
            <Badge variant={teamBadgeVariant(announcement.winnerTeam)}>{announcement.label}</Badge>
          </div>
          <DialogDescription>Final scores and prize distribution.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className={cn("font-medium", teamColorClass(TEAM_BLUE))}>Blue</p>
              <p>Population: {scoring.finalBluePopulation}{scoring.blueExtinct ? " (extinct)" : ""}</p>
              <p>Invasion: {scoring.finalBlueInvasion}</p>
              <p>Score: {scoring.scoreBlue}</p>
            </div>
            <div className="space-y-1">
              <p className={cn("font-medium", teamColorClass(TEAM_RED))}>Red</p>
              <p>Population: {scoring.finalRedPopulation}{scoring.redExtinct ? " (extinct)" : ""}</p>
              <p>Invasion: {scoring.finalRedInvasion}</p>
              <p>Score: {scoring.scoreRed}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1 tabular-nums">
            <p>Prize pool: {formatEther(BigInt(payout.prizePool))} ETH</p>
            <p>Per winner: {formatEther(BigInt(payout.perWinnerShare))} ETH</p>
            <p>Claimed: {payout.claimedCount}/{payout.eligibleCount} eligible</p>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-3">
            {eligibility.eligible ? (
              <Button onClick={() => void handleClaim()} disabled={isPending}>
                {isPending ? "Claiming\u2026" : "Claim Prize"}
              </Button>
            ) : (
              <p className="text-muted-foreground">{eligibility.reason}</p>
            )}
            <Button variant="outline" asChild>
              <Link href="/replay">View Replay</Link>
            </Button>
          </div>

          <p className="text-muted-foreground" aria-live="polite">{claimStatus ?? ""}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
