"use client";

import { useMemo, useState } from "react";
import { type Address, isAddress } from "viem";
import { useAccount, useConnect, useConnectors, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { TARGET_CHAIN } from "@/lib/wagmi-config";
import { deriveWalletOnboardingState } from "@/lib/wallet-onboarding";
import {
  SEED_BUDGET,
  SLOT_COUNT,
  TEAM_BLUE,
  TEAM_RED,
  countLiveSeedCells,
  isSeedCellAlive,
  isSlotIndexInTeamTerritory,
  slotIndexToGrid,
  toggleSeedCell,
} from "@/lib/wallet-ux";
import { buildWalletWriteRequest, normalizeWalletWriteError } from "@/lib/wallet-signing";

type TxKind = "commit" | "reveal" | "claim";

type WalletDraft = {
  roundId: string;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: string;
  claimSlotIndex: string;
};

type OnboardingMessage = {
  badge: "secondary" | "outline" | "destructive";
  label: string;
  status: string;
};

function isRoundAddressConfigured(roundAddress: string): roundAddress is Address {
  return isAddress(roundAddress);
}

function getOnboardingMessage(stage: ReturnType<typeof deriveWalletOnboardingState>["stage"]): OnboardingMessage {
  if (stage === "missing-round") {
    return {
      badge: "destructive",
      label: "Missing Round Address",
      status: "Configure NEXT_PUBLIC_ROUND_ADDRESS to enable signup and transaction signing.",
    };
  }

  if (stage === "connect-wallet") {
    return {
      badge: "outline",
      label: "Connect Wallet",
      status: "Connect a wallet to begin signup for this round.",
    };
  }

  if (stage === "switch-network") {
    return {
      badge: "outline",
      label: "Wrong Network",
      status: `Switch wallet network to ${TARGET_CHAIN.name} before signing transactions.`,
    };
  }

  return {
    badge: "secondary",
    label: "Ready To Sign",
    status: "Signup complete. You can now send commit, reveal, and claim transactions.",
  };
}

function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function RoundWalletPanel() {
  const roundAddress = process.env.NEXT_PUBLIC_ROUND_ADDRESS ?? "";
  const { address: account, chainId, isConnected } = useAccount();
  const connectors = useConnectors();
  const { connectAsync, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [draft, setDraft] = useState<WalletDraft>({
    roundId: "1",
    team: TEAM_BLUE,
    slotIndex: 0,
    seedBits: 0n,
    salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
    claimSlotIndex: "0",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TxKind | null>(null);

  const ready = useMemo(() => isRoundAddressConfigured(roundAddress), [roundAddress]);
  const liveCells = useMemo(() => countLiveSeedCells(draft.seedBits), [draft.seedBits]);
  const onboarding = useMemo(
    () =>
      deriveWalletOnboardingState({
        roundConfigured: ready,
        connected: isConnected,
        chainId,
        targetChainId: TARGET_CHAIN.id,
      }),
    [chainId, isConnected, ready],
  );
  const onboardingMessage = useMemo(() => getOnboardingMessage(onboarding.stage), [onboarding.stage]);
  const displayedStatus = status ?? onboardingMessage.status;

  function updateDraft<K extends keyof WalletDraft>(key: K, value: WalletDraft[K]): void {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function handleTeamSelect(team: number): void {
    setDraft((previous) => {
      const slotIndex = isSlotIndexInTeamTerritory(team, previous.slotIndex)
        ? previous.slotIndex
        : team === TEAM_BLUE
          ? 0
          : 32;

      return {
        ...previous,
        team,
        slotIndex,
      };
    });
  }

  function handleSeedCellToggle(x: number, y: number): void {
    const currentlyAlive = isSeedCellAlive(draft.seedBits, x, y);
    if (!currentlyAlive && liveCells >= SEED_BUDGET) {
      setStatus(`Seed budget reached (${SEED_BUDGET} cells)`);
      return;
    }

    const next = toggleSeedCell(draft.seedBits, x, y);
    updateDraft("seedBits", next);
  }

  async function connectWallet(connector: (typeof connectors)[number]): Promise<void> {
    try {
      setStatus(`Connecting ${connector.name}...`);
      await connectAsync({ connector });
      setStatus(`Connected ${connector.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to connect wallet");
    }
  }

  async function switchToTargetNetwork(): Promise<void> {
    try {
      setStatus(`Switching to ${TARGET_CHAIN.name}...`);
      await switchChainAsync({ chainId: TARGET_CHAIN.id });
      setStatus(`Connected to ${TARGET_CHAIN.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to switch network");
    }
  }

  async function sendTransaction(kind: TxKind): Promise<void> {
    if (!onboarding.canSubmitTx) {
      setStatus(onboardingMessage.status);
      return;
    }
    if (!account) {
      setStatus("Connect wallet first");
      return;
    }

    const targetRoundAddress = roundAddress as Address;

    try {
      setPendingAction(kind);
      setStatus(`${kind} simulation pending...`);

      const request = buildWalletWriteRequest({
        action: kind,
        chainId: TARGET_CHAIN.id,
        account,
        roundAddress: targetRoundAddress,
        draft: {
          action: kind,
          roundId: draft.roundId,
          team: draft.team,
          slotIndex: draft.slotIndex,
          seedBits: draft.seedBits,
          salt: draft.salt,
          claimSlotIndex: draft.claimSlotIndex,
        },
      });

      if (!publicClient) {
        throw new Error("public client unavailable for selected chain");
      }

      const simulation = await publicClient.simulateContract(
        request as Parameters<typeof publicClient.simulateContract>[0],
      );
      setStatus(`${kind} signature requested in wallet...`);

      const txHash = await writeContractAsync(simulation.request);
      setLastTxHash(txHash);
      setStatus(`${kind} submitted (${txHash.slice(0, 10)}...), awaiting confirmation...`);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status !== "success") {
        throw new Error(`${kind} transaction reverted onchain`);
      }

      setStatus(`${kind} confirmed in block ${receipt.blockNumber.toString()}`);
    } catch (error) {
      setStatus(normalizeWalletWriteError(error));
    } finally {
      setPendingAction(null);
    }
  }

  const txControlsDisabled = !onboarding.canSubmitTx || pendingAction !== null || isWritePending;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Wallet Journey</CardTitle>
          <Badge variant={onboardingMessage.badge}>{onboardingMessage.label}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Signup flow + transaction signing with team-aware slot picker, seed editor, and optimistic submit feedback.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <Label>Sign Up Flow</Label>
          <div className="flex flex-wrap items-center gap-2">
            {!isConnected
              ? connectors.map((connector) => (
                  <Button
                    key={connector.uid}
                    type="button"
                    variant="outline"
                    disabled={isConnectPending}
                    onClick={() => void connectWallet(connector)}
                  >
                    {isConnectPending ? `Connecting ${connector.name}...` : `Connect ${connector.name}`}
                  </Button>
                ))
              : null}
            {!isConnected && connectors.length === 0 ? (
              <p className="text-muted-foreground">No compatible injected wallet was discovered in this browser.</p>
            ) : null}
            {isConnected ? (
              <>
                <Button type="button" variant="outline" onClick={() => disconnect()}>
                  Disconnect
                </Button>
                <p className="text-muted-foreground">
                  {account ? shortenAddress(account) : "Connected"} on chain {chainId ?? "unknown"}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No wallet connected</p>
            )}
            {onboarding.stage === "switch-network" ? (
              <Button type="button" variant="secondary" disabled={isSwitchPending} onClick={() => void switchToTargetNetwork()}>
                {isSwitchPending ? `Switching to ${TARGET_CHAIN.name}...` : `Switch to ${TARGET_CHAIN.name}`}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="roundId">Round ID</Label>
            <Input id="roundId" value={draft.roundId} onChange={(event) => updateDraft("roundId", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="salt">Salt (bytes32 hex)</Label>
            <Input id="salt" value={draft.salt} onChange={(event) => updateDraft("salt", event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Team</Label>
          <div className="flex gap-2">
            <Button type="button" variant={draft.team === TEAM_BLUE ? "default" : "outline"} onClick={() => handleTeamSelect(TEAM_BLUE)}>
              Blue
            </Button>
            <Button type="button" variant={draft.team === TEAM_RED ? "default" : "outline"} onClick={() => handleTeamSelect(TEAM_RED)}>
              Red
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Slot Picker ({draft.team === TEAM_BLUE ? "blue territory" : "red territory"})</Label>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: SLOT_COUNT }, (_, slotIndex) => {
              const allowed = isSlotIndexInTeamTerritory(draft.team, slotIndex);
              const selected = slotIndex === draft.slotIndex;

              return (
                <Button
                  key={slotIndex}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  disabled={!allowed}
                  className="h-8 px-0 text-xs"
                  onClick={() => updateDraft("slotIndex", slotIndex)}
                >
                  {slotIndex}
                </Button>
              );
            })}
          </div>
          <p className="text-muted-foreground">
            Selected slot {draft.slotIndex} at tile ({slotIndexToGrid(draft.slotIndex).tileX}, {slotIndexToGrid(draft.slotIndex).tileY})
          </p>
        </div>

        <div className="space-y-2">
          <Label>Seed Editor (8x8, max {SEED_BUDGET} live cells)</Label>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 64 }, (_, index) => {
              const x = index % 8;
              const y = Math.floor(index / 8);
              const alive = isSeedCellAlive(draft.seedBits, x, y);

              return (
                <Toggle
                  key={`${x}-${y}`}
                  variant="outline"
                  size="sm"
                  pressed={alive}
                  aria-label={`seed-${x}-${y}`}
                  onPressedChange={() => handleSeedCellToggle(x, y)}
                  className="h-7 min-w-7 p-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <span className="sr-only">{alive ? "alive" : "dead"}</span>
                </Toggle>
              );
            })}
          </div>
          <p className="text-muted-foreground">
            Live cells: {liveCells}/{SEED_BUDGET} | seedBits(dec): {draft.seedBits.toString()}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="button" onClick={() => void sendTransaction("commit")} disabled={txControlsDisabled}>
            Send Commit
          </Button>
          <Button type="button" onClick={() => void sendTransaction("reveal")} disabled={txControlsDisabled}>
            Send Reveal
          </Button>
          <Button type="button" onClick={() => void sendTransaction("claim")} disabled={txControlsDisabled}>
            Send Claim
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="claimSlotIndex">Claim Slot Index (0-63)</Label>
          <Input
            id="claimSlotIndex"
            value={draft.claimSlotIndex}
            onChange={(event) => updateDraft("claimSlotIndex", event.target.value)}
          />
        </div>

        <p>Status: {displayedStatus}</p>
        {pendingAction ? <p className="text-muted-foreground">Optimistic status: {pendingAction} pending confirmation...</p> : null}
        {lastTxHash ? <p className="break-all text-muted-foreground">Last tx: {lastTxHash}</p> : null}
      </CardContent>
    </Card>
  );
}
