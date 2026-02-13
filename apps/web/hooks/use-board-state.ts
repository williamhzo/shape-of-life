"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import type { BoardState } from "@shape-of-life/sim";

import { ROUND_READ_ABI } from "@/lib/round-tx";
import { contractRowsToBoardState } from "@/lib/board-fetch";
import { TARGET_CHAIN } from "@/lib/wagmi-config";

export type BoardStateResult = {
  board: BoardState | null;
  checkpointGen: number | null;
  loading: boolean;
  error: string | null;
};

const IDLE: BoardStateResult = {
  board: null,
  checkpointGen: null,
  loading: false,
  error: null,
};

export function useBoardState(
  roundAddress: Address | null,
  onchainGen: number | null,
): BoardStateResult {
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });
  const [result, setResult] = useState<BoardStateResult>(IDLE);
  const lastFetchedGen = useRef<number | null>(null);
  const active = roundAddress !== null && onchainGen !== null && publicClient !== undefined;

  useEffect(() => {
    if (!roundAddress || onchainGen === null || !publicClient) {
      lastFetchedGen.current = null;
      return;
    }

    if (lastFetchedGen.current === onchainGen) return;

    let cancelled = false;

    publicClient
      .readContract({
        address: roundAddress,
        abi: ROUND_READ_ABI,
        functionName: "getBoardState",
      })
      .then(([blueRows, redRows]) => {
        if (cancelled) return;
        const board = contractRowsToBoardState(
          blueRows.map(BigInt),
          redRows.map(BigInt),
        );
        lastFetchedGen.current = onchainGen;
        setResult({ board, checkpointGen: onchainGen, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "failed to fetch board state";
        setResult((prev) => ({ ...prev, loading: false, error: message }));
      });

    return () => {
      cancelled = true;
    };
  }, [roundAddress, onchainGen, publicClient]);

  if (!active) return IDLE;

  return result;
}
