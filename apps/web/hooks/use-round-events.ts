"use client";

import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  committedEvent,
  revealedEvent,
  steppedEvent,
  playerClaimedEvent,
} from "@/lib/round-abi";
import { TARGET_CHAIN } from "@/lib/wagmi-config";

export function useRoundEvents(roundAddress: Address | null) {
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });

  return useQuery({
    queryKey: ["round-events", roundAddress],
    queryFn: async () => {
      const [committed, revealed, stepped, playerClaimed] = await Promise.all([
        publicClient!.getLogs({
          address: roundAddress!,
          event: committedEvent,
          fromBlock: 0n,
        }),
        publicClient!.getLogs({
          address: roundAddress!,
          event: revealedEvent,
          fromBlock: 0n,
        }),
        publicClient!.getLogs({
          address: roundAddress!,
          event: steppedEvent,
          fromBlock: 0n,
        }),
        publicClient!.getLogs({
          address: roundAddress!,
          event: playerClaimedEvent,
          fromBlock: 0n,
        }),
      ]);
      return { committed, revealed, stepped, playerClaimed };
    },
    enabled: roundAddress !== null && publicClient !== undefined,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}
