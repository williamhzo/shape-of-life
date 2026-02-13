import { type Address, type Hex } from "viem";

import { ROUND_ABI, computeCommitHash } from "@/lib/round-tx";
import { type WalletAction, type WalletSubmissionDraft, validateWalletSubmissionDraft } from "@/lib/wallet-submit";

type CommonWalletWriteRequest = {
  abi: typeof ROUND_ABI;
  address: Address;
  chainId: number;
  account: Address;
};

export type WalletWriteRequest =
  | (CommonWalletWriteRequest & {
      functionName: "commit";
      args: [team: number, slotIndex: number, commitHash: Hex];
    })
  | (CommonWalletWriteRequest & {
      functionName: "reveal";
      args: [roundId: bigint, team: number, slotIndex: number, seedBits: bigint, salt: Hex];
    })
  | (CommonWalletWriteRequest & {
      functionName: "claim";
      args: [slotIndex: number];
    });

export type BuildWalletWriteRequestParams = {
  action: WalletAction;
  chainId: number;
  account: Address;
  roundAddress: Address;
  draft: WalletSubmissionDraft;
};

export function buildWalletWriteRequest(params: BuildWalletWriteRequestParams): WalletWriteRequest {
  const validated = validateWalletSubmissionDraft({ ...params.draft, action: params.action });

  if (params.action === "commit") {
    const commitHash = computeCommitHash({
      roundId: validated.roundId,
      chainId: BigInt(params.chainId),
      arena: params.roundAddress,
      player: params.account,
      team: validated.team,
      slotIndex: validated.slotIndex,
      seedBits: validated.seedBits,
      salt: validated.salt,
    });

    return {
      abi: ROUND_ABI,
      address: params.roundAddress,
      chainId: params.chainId,
      account: params.account,
      functionName: "commit",
      args: [validated.team, validated.slotIndex, commitHash],
    };
  }

  if (params.action === "reveal") {
    return {
      abi: ROUND_ABI,
      address: params.roundAddress,
      chainId: params.chainId,
      account: params.account,
      functionName: "reveal",
      args: [validated.roundId, validated.team, validated.slotIndex, validated.seedBits, validated.salt],
    };
  }

  return {
    abi: ROUND_ABI,
    address: params.roundAddress,
    chainId: params.chainId,
    account: params.account,
    functionName: "claim",
    args: [validated.claimSlotIndex],
  };
}

function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const maybeShortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof maybeShortMessage === "string" && maybeShortMessage.length > 0) {
      return maybeShortMessage;
    }

    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
      return maybeMessage;
    }

    const maybeCause = (error as { cause?: unknown }).cause;
    return extractErrorMessage(maybeCause);
  }

  return null;
}

export function normalizeWalletWriteError(error: unknown): string {
  const message = extractErrorMessage(error);
  if (!message) {
    return "failed to sign transaction";
  }

  const normalized = message.toLowerCase();
  if (normalized.includes("user rejected") || normalized.includes("user denied") || normalized.includes("rejected the request")) {
    return "transaction rejected in wallet";
  }

  return message;
}
