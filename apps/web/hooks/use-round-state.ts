"use client";

import type { Address } from "viem";
import { useReadContracts } from "wagmi";
import { ROUND_STATE_ABI, STATE_FN_NAMES } from "@/lib/round-abi";

export function useRoundState(roundAddress: Address | null) {
  return useReadContracts({
    contracts: STATE_FN_NAMES.map((functionName) => ({
      address: roundAddress!,
      abi: ROUND_STATE_ABI,
      functionName,
    })),
    query: {
      enabled: roundAddress !== null,
      refetchInterval: 5_000,
      staleTime: 4_000,
    },
  });
}
