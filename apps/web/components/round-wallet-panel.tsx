"use client";

import { useMemo, useState } from "react";
import { type Address, isAddress, type Hex } from "viem";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  team: string;
  slotIndex: string;
  seedBits: string;
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
    team: "0",
    slotIndex: "0",
    seedBits: "0",
    salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
    claimSlotIndex: "0",
  });
  const [status, setStatus] = useState<string>("Idle");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const ready = useMemo(() => isRoundAddressConfigured(roundAddress), [roundAddress]);

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
      const team = Number(parseUnsignedInteger(draft.team, "team", 1n));
      const slotIndex = Number(parseUnsignedInteger(draft.slotIndex, "slotIndex", 63n));
      const seedBits = parseUnsignedInteger(draft.seedBits, "seedBits", (1n << 64n) - 1n);
      const salt = parseHex32(draft.salt, "salt");

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
        const claimSlotIndex = Number(parseUnsignedInteger(draft.claimSlotIndex, "claimSlotIndex", 63n));
        data = buildClaimCalldata({ slotIndex: claimSlotIndex });
      }

      setStatus(`Sending ${kind} transaction...`);
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
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Wallet Journey</CardTitle>
          <Badge variant={ready ? "secondary" : "destructive"}>{ready ? "Round Configured" : "Missing Round Address"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Commit/reveal/claim transactions with a browser wallet on Shape Sepolia.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void connectWallet()}>
            {account ? "Reconnect" : "Connect Wallet"}
          </Button>
          <p className="text-muted-foreground">{account ?? "No wallet connected"}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="roundId">Round ID</Label>
            <Input id="roundId" value={draft.roundId} onChange={(event) => updateDraft("roundId", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="team">Team (0 blue, 1 red)</Label>
            <Input id="team" value={draft.team} onChange={(event) => updateDraft("team", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slotIndex">Slot Index (0-63)</Label>
            <Input id="slotIndex" value={draft.slotIndex} onChange={(event) => updateDraft("slotIndex", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="seedBits">Seed Bits (uint64 decimal)</Label>
            <Input id="seedBits" value={draft.seedBits} onChange={(event) => updateDraft("seedBits", event.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="salt">Salt (bytes32 hex)</Label>
          <Input id="salt" value={draft.salt} onChange={(event) => updateDraft("salt", event.target.value)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button type="button" onClick={() => void sendTransaction("commit")} disabled={!ready || !account}>
            Send Commit
          </Button>
          <Button type="button" onClick={() => void sendTransaction("reveal")} disabled={!ready || !account}>
            Send Reveal
          </Button>
          <Button type="button" onClick={() => void sendTransaction("claim")} disabled={!ready || !account}>
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
