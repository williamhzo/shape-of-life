"use client";

import { useMemo, useState } from "react";
import { type Address, isAddress, type Hex } from "viem";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  buildClaimCalldata,
  buildCommitCalldata,
  buildRevealCalldata,
  computeCommitHash,
} from "@/lib/round-tx";

type EthereumRequest = {
  method: string;
  params?: unknown[];
};

type EthereumProvider = {
  request(request: EthereumRequest): Promise<unknown>;
};

type TxKind = "commit" | "reveal" | "claim";

type WalletDraft = {
  roundId: string;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: string;
  claimSlotIndex: string;
};

const SHAPE_SEPOLIA_CHAIN_ID = 11011n;
const SHAPE_SEPOLIA_CHAIN_HEX = "0x2b03";

function requireProvider(): EthereumProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("wallet provider not found");
  }

  return window.ethereum;
}

function parseUnsignedInteger(raw: string, label: string, max: bigint): bigint {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a decimal integer`);
  }

  const value = BigInt(trimmed);
  if (value > max) {
    throw new Error(`${label} exceeds max ${max}`);
  }

  return value;
}

function parseHex32(raw: string, label: string): Hex {
  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error(`${label} must be 32-byte hex (0x + 64 hex chars)`);
  }

  return trimmed as Hex;
}

function isRoundAddressConfigured(roundAddress: string): roundAddress is Address {
  return isAddress(roundAddress);
}

async function ensureShapeSepolia(provider: EthereumProvider): Promise<bigint> {
  const rawChainId = await provider.request({ method: "eth_chainId" });
  if (typeof rawChainId !== "string" || !rawChainId.startsWith("0x")) {
    throw new Error("wallet returned invalid chain id");
  }

  const chainId = BigInt(rawChainId);
  if (chainId === SHAPE_SEPOLIA_CHAIN_ID) {
    return chainId;
  }

  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SHAPE_SEPOLIA_CHAIN_HEX }],
  });

  return SHAPE_SEPOLIA_CHAIN_ID;
}

export function RoundWalletPanel() {
  const roundAddress = process.env.NEXT_PUBLIC_ROUND_ADDRESS ?? "";

  const [account, setAccount] = useState<Address | null>(null);
  const [draft, setDraft] = useState<WalletDraft>({
    roundId: "1",
    team: TEAM_BLUE,
    slotIndex: 0,
    seedBits: 0n,
    salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
    claimSlotIndex: "0",
  });
  const [status, setStatus] = useState<string>("Idle");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TxKind | null>(null);

  const ready = useMemo(() => isRoundAddressConfigured(roundAddress), [roundAddress]);
  const liveCells = useMemo(() => countLiveSeedCells(draft.seedBits), [draft.seedBits]);

  async function connectWallet(): Promise<void> {
    try {
      const provider = requireProvider();
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== "string" || !isAddress(accounts[0])) {
        throw new Error("wallet returned invalid account list");
      }

      setAccount(accounts[0]);
      setStatus("Wallet connected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to connect wallet");
    }
  }

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

  async function sendTransaction(kind: TxKind): Promise<void> {
    if (!ready) {
      setStatus("NEXT_PUBLIC_ROUND_ADDRESS is not configured");
      return;
    }
    if (!account) {
      setStatus("Connect wallet first");
      return;
    }

    const targetRoundAddress = roundAddress as Address;

    try {
      const provider = requireProvider();
      const chainId = await ensureShapeSepolia(provider);
      const roundId = parseUnsignedInteger(draft.roundId, "roundId", (1n << 256n) - 1n);
      const team = draft.team;
      const slotIndex = draft.slotIndex;
      const seedBits = draft.seedBits;
      const salt = parseHex32(draft.salt, "salt");

      if (liveCells > SEED_BUDGET) {
        throw new Error(`seed budget exceeded (${liveCells}/${SEED_BUDGET})`);
      }

      let data: Hex;
      if (kind === "commit") {
        const commitHash = computeCommitHash({
          roundId,
          chainId,
          arena: targetRoundAddress,
          player: account,
          team,
          slotIndex,
          seedBits,
          salt,
        });
        data = buildCommitCalldata({ team, slotIndex, commitHash });
      } else if (kind === "reveal") {
        data = buildRevealCalldata({
          roundId,
          team,
          slotIndex,
          seedBits,
          salt,
        });
      } else {
        const claimSlotIndex = Number(parseUnsignedInteger(draft.claimSlotIndex, "claimSlotIndex", BigInt(SLOT_COUNT - 1)));
        data = buildClaimCalldata({ slotIndex: claimSlotIndex });
      }

      setPendingAction(kind);
      setStatus(`${kind} pending...`);
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: targetRoundAddress,
            data,
          },
        ],
      });

      if (typeof txHash !== "string") {
        throw new Error("wallet returned invalid tx hash");
      }

      setLastTxHash(txHash);
      setStatus(`${kind} transaction submitted`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "failed to send transaction");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Wallet Journey</CardTitle>
          <Badge variant={ready ? "secondary" : "destructive"}>{ready ? "Round Configured" : "Missing Round Address"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Commit/reveal/claim transactions with slot picker, seed editor, and optimistic submit feedback.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void connectWallet()}>
            {account ? "Reconnect" : "Connect Wallet"}
          </Button>
          <p className="text-muted-foreground">{account ?? "No wallet connected"}</p>
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
                <button
                  key={`${x}-${y}`}
                  type="button"
                  aria-label={`seed-${x}-${y}`}
                  onClick={() => handleSeedCellToggle(x, y)}
                  className={`h-7 w-7 rounded border ${alive ? "bg-primary" : "bg-background"}`}
                />
              );
            })}
          </div>
          <p className="text-muted-foreground">
            Live cells: {liveCells}/{SEED_BUDGET} | seedBits(dec): {draft.seedBits.toString()}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="button" onClick={() => void sendTransaction("commit")} disabled={!ready || !account || pendingAction !== null}>
            Send Commit
          </Button>
          <Button type="button" onClick={() => void sendTransaction("reveal")} disabled={!ready || !account || pendingAction !== null}>
            Send Reveal
          </Button>
          <Button type="button" onClick={() => void sendTransaction("claim")} disabled={!ready || !account || pendingAction !== null}>
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

        <p>Status: {status}</p>
        {pendingAction ? <p className="text-muted-foreground">Optimistic status: {pendingAction} pending confirmation...</p> : null}
        {lastTxHash ? <p className="break-all text-muted-foreground">Last tx: {lastTxHash}</p> : null}
      </CardContent>
    </Card>
  );
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
