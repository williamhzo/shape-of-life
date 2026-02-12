import { type Address, type Hex } from "viem";

import {
  buildClaimCalldata,
  buildCommitCalldata,
  buildRevealCalldata,
  computeCommitHash,
} from "@/lib/round-tx";
import { type WalletAction, type WalletSubmissionDraft, validateWalletSubmissionDraft } from "@/lib/wallet-submit";

export type WalletProvider = {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type SubmitWalletActionParams = {
  provider: WalletProvider;
  action: WalletAction;
  account: Address;
  roundAddress: Address;
  draft: WalletSubmissionDraft;
};

export type SubmitWalletActionResult = {
  txHash: string;
  chainId: bigint;
};

const SHAPE_SEPOLIA_CHAIN_ID = 11011n;
const SHAPE_SEPOLIA_CHAIN_HEX = "0x2b03";

async function ensureShapeSepolia(provider: WalletProvider): Promise<bigint> {
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

export async function submitWalletAction(params: SubmitWalletActionParams): Promise<SubmitWalletActionResult> {
  const chainId = await ensureShapeSepolia(params.provider);
  const validated = validateWalletSubmissionDraft({ ...params.draft, action: params.action });

  let data: Hex;
  if (params.action === "commit") {
    const commitHash = computeCommitHash({
      roundId: validated.roundId,
      chainId,
      arena: params.roundAddress,
      player: params.account,
      team: validated.team,
      slotIndex: validated.slotIndex,
      seedBits: validated.seedBits,
      salt: validated.salt,
    });
    data = buildCommitCalldata({ team: validated.team, slotIndex: validated.slotIndex, commitHash });
  } else if (params.action === "reveal") {
    data = buildRevealCalldata({
      roundId: validated.roundId,
      team: validated.team,
      slotIndex: validated.slotIndex,
      seedBits: validated.seedBits,
      salt: validated.salt,
    });
  } else {
    data = buildClaimCalldata({ slotIndex: validated.claimSlotIndex });
  }

  const txHash = await params.provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: params.account,
        to: params.roundAddress,
        data,
      },
    ],
  });

  if (typeof txHash !== "string") {
    throw new Error("wallet returned invalid tx hash");
  }

  return {
    txHash,
    chainId,
  };
}
