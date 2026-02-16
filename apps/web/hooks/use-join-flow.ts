"use client";

import { useMemo, useState } from "react";
import { type Address, isAddress } from "viem";
import { useAccount, useConnect, useConnectors, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { useCurrentRound } from "@/hooks/use-current-round";
import { TARGET_CHAIN } from "@/lib/wagmi-config";
import { deriveWalletOnboardingState } from "@/lib/wallet-onboarding";
import { createTxFeedback, txBadgeVariant, type TxFeedback, type TxStage } from "@/lib/wallet-tx-feedback";
import {
  SEED_PRESETS,
  SEED_BUDGET,
  TEAM_BLUE,
  applySeedTransform,
  countLiveSeedCells,
  getSeedPresetById,
  isSeedCellAlive,
  isSlotIndexInTeamTerritory,
  toggleSeedCell,
} from "@/lib/seed";
import { buildWalletWriteRequest, normalizeWalletWriteError } from "@/lib/wallet-signing";

type TxKind = "commit" | "reveal" | "claim";

export type WalletDraft = {
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

function getOnboardingMessage(stage: ReturnType<typeof deriveWalletOnboardingState>["stage"]): OnboardingMessage {
  if (stage === "missing-round") {
    return {
      badge: "destructive",
      label: "Missing Round",
      status: "Configure NEXT_PUBLIC_ROUND_ADDRESS or NEXT_PUBLIC_ARENA_REGISTRY_ADDRESS to enable signup.",
    };
  }
  if (stage === "connect-wallet") {
    return {
      badge: "outline",
      label: "Connect Wallet",
      status: "Connect a wallet to begin.",
    };
  }
  if (stage === "switch-network") {
    return {
      badge: "outline",
      label: "Wrong Network",
      status: `Switch to ${TARGET_CHAIN.name} before signing.`,
    };
  }
  return {
    badge: "secondary",
    label: "Ready",
    status: "You can now send commit, reveal, and claim transactions.",
  };
}

function txStageLabel(stage: TxStage): string {
  if (stage === "idle") return "Idle";
  if (stage === "sign") return "Sign";
  if (stage === "pending") return "Pending";
  if (stage === "confirming") return "Confirming";
  if (stage === "success") return "Success";
  return "Error";
}

function shortenAddress(address: Address): string {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

export function useJoinFlow() {
  const { roundAddress: resolvedRound } = useCurrentRound();
  const roundAddress = resolvedRound ?? "";
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
  const [txFeedback, setTxFeedback] = useState<TxFeedback>(() => createTxFeedback({ action: null, stage: "idle" }));
  const [pendingAction, setPendingAction] = useState<TxKind | null>(null);

  const ready = useMemo(() => isAddress(roundAddress), [roundAddress]);
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
  const budgetProgress = Math.min(100, Math.round((liveCells / SEED_BUDGET) * 100));

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
      return { ...previous, team, slotIndex };
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

  function applySeedMutation(mutate: (seedBits: bigint) => bigint, successMessage: string): void {
    setDraft((previous) => ({ ...previous, seedBits: mutate(previous.seedBits) }));
    setStatus(successMessage);
  }

  function applyPreset(presetId: string): void {
    const preset = getSeedPresetById(presetId);
    if (!preset) return;
    updateDraft("seedBits", preset.seedBits);
    setStatus(`Applied preset ${preset.name}`);
  }

  function transformSeed(kind: "rotate-90" | "rotate-180" | "rotate-270" | "mirror-x" | "mirror-y"): void {
    applySeedMutation((seedBits) => applySeedTransform(seedBits, kind), `Applied transform ${kind}`);
  }

  function translateSeed(dx: number, dy: number): void {
    applySeedMutation((seedBits) => applySeedTransform(seedBits, "translate", { dx, dy }), `Translated seed (${dx}, ${dy})`);
  }

  async function connectWallet(connector: (typeof connectors)[number]): Promise<void> {
    try {
      setStatus(`Connecting ${connector.name}\u2026`);
      await connectAsync({ connector });
      setStatus(`Connected ${connector.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to connect wallet");
    }
  }

  async function switchToTargetNetwork(): Promise<void> {
    try {
      setStatus(`Switching to ${TARGET_CHAIN.name}\u2026`);
      await switchChainAsync({ chainId: TARGET_CHAIN.id });
      setStatus(`Connected to ${TARGET_CHAIN.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to switch network");
    }
  }

  async function sendTransaction(kind: TxKind): Promise<void> {
    if (!onboarding.canSubmitTx) {
      setStatus(onboardingMessage.status);
      setTxFeedback(createTxFeedback({ action: kind, stage: "error", error: onboardingMessage.status }));
      return;
    }
    if (!account) {
      setStatus("Connect wallet first");
      setTxFeedback(createTxFeedback({ action: kind, stage: "error", error: "Connect wallet first" }));
      return;
    }

    const targetRoundAddress = roundAddress as Address;

    try {
      setPendingAction(kind);
      setTxFeedback(createTxFeedback({ action: kind, stage: "pending" }));

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
      setTxFeedback(createTxFeedback({ action: kind, stage: "sign" }));

      const txHash = await writeContractAsync(simulation.request);
      setTxFeedback(createTxFeedback({ action: kind, stage: "confirming", txHash }));

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error(`${kind} transaction reverted onchain`);
      }

      setTxFeedback(createTxFeedback({ action: kind, stage: "success", txHash, blockNumber: receipt.blockNumber }));
      setStatus(`${kind} confirmed`);
    } catch (error) {
      const message = normalizeWalletWriteError(error);
      setTxFeedback(createTxFeedback({ action: kind, stage: "error", error: message }));
      setStatus(message);
    } finally {
      setPendingAction(null);
    }
  }

  const txControlsDisabled = !onboarding.canSubmitTx || pendingAction !== null || isWritePending;
  const editorDisabled = pendingAction !== null || isWritePending;

  return {
    draft,
    updateDraft,
    liveCells,
    budgetProgress,
    onboarding,
    onboardingMessage,
    displayedStatus,
    txFeedback,
    txStageLabel,
    pendingAction,
    txControlsDisabled,
    editorDisabled,
    account,
    chainId,
    isConnected,
    connectors,
    isConnectPending,
    isSwitchPending,
    disconnect,
    handleTeamSelect,
    handleSeedCellToggle,
    applyPreset,
    transformSeed,
    translateSeed,
    connectWallet,
    switchToTargetNetwork,
    sendTransaction,
    shortenAddress,
    txBadgeVariant,
    seedPresets: SEED_PRESETS,
  };
}

export type JoinFlowReturn = ReturnType<typeof useJoinFlow>;
