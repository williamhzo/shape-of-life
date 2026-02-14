"use client";

import { type Address, isAddress, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { REGISTRY_ABI } from "@/lib/registry";
import { TARGET_CHAIN } from "@/lib/wagmi-config";

const envRoundAddress = process.env.NEXT_PUBLIC_ROUND_ADDRESS ?? "";
const envRegistryAddress = process.env.NEXT_PUBLIC_ARENA_REGISTRY_ADDRESS ?? "";

export function useCurrentRound(): {
  roundAddress: Address | null;
  source: "env" | "registry" | "none";
} {
  const hasEnvRound = isAddress(envRoundAddress);
  const hasRegistry = isAddress(envRegistryAddress);

  const { data: registryRound } = useReadContract({
    address: envRegistryAddress as Address,
    abi: REGISTRY_ABI,
    functionName: "currentRound",
    chainId: TARGET_CHAIN.id,
    query: { enabled: !hasEnvRound && hasRegistry },
  });

  if (hasEnvRound) {
    return { roundAddress: envRoundAddress as Address, source: "env" };
  }

  if (registryRound && registryRound !== zeroAddress) {
    return { roundAddress: registryRound, source: "registry" };
  }

  return { roundAddress: null, source: "none" };
}
