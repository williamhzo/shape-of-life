"use client";

import { useEffect, useState } from "react";
import type { RoundLivePayload } from "@/lib/round-live";

export type RoundLiveState = {
  payload: RoundLivePayload | null;
  error: string | null;
};

const POLL_MS = 5000;

export function useRoundLive(): RoundLiveState {
  const [state, setState] = useState<RoundLiveState>({ payload: null, error: null });

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/round/live", { cache: "no-store" });
        if (!response.ok) {
          const failure = (await response.json()) as { error?: string };
          throw new Error(failure.error ?? `request failed (${response.status})`);
        }

        const payload = (await response.json()) as RoundLivePayload;
        if (!cancelled) {
          setState({ payload, error: null });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (!cancelled) {
          setState((previous) => ({ payload: previous.payload, error: message }));
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return state;
}
