import { describe, expect, it } from "bun:test";

import { computeSyncWindow, type RoundSyncCursor } from "../src/sync-round-read-model";

const cursor: RoundSyncCursor = {
  version: "v1",
  chainId: 11011,
  roundAddress: "0x1111111111111111111111111111111111111111",
  lastSyncedBlock: 80n,
  syncedAt: "2026-02-12T17:00:00.000Z",
};

describe("computeSyncWindow", () => {
  it("starts from confirmed tip when no cursor exists", () => {
    const window = computeSyncWindow({
      latestBlock: 100n,
      confirmations: 5n,
      reorgLookback: 12n,
      cursor: null,
      explicitFromBlock: undefined,
      explicitToBlock: undefined,
    });

    expect(window.fromBlock).toBe(0n);
    expect(window.toBlock).toBe(95n);
    expect(window.usedCursor).toBe(false);
  });

  it("rewinds from cursor by reorg lookback for resumable sync", () => {
    const window = computeSyncWindow({
      latestBlock: 100n,
      confirmations: 5n,
      reorgLookback: 12n,
      cursor,
      explicitFromBlock: undefined,
      explicitToBlock: undefined,
    });

    expect(window.fromBlock).toBe(68n);
    expect(window.toBlock).toBe(95n);
    expect(window.usedCursor).toBe(true);
  });

  it("prioritizes explicit block bounds over cursor", () => {
    const window = computeSyncWindow({
      latestBlock: 100n,
      confirmations: 5n,
      reorgLookback: 12n,
      cursor,
      explicitFromBlock: 40n,
      explicitToBlock: 55n,
    });

    expect(window.fromBlock).toBe(40n);
    expect(window.toBlock).toBe(55n);
    expect(window.usedCursor).toBe(false);
  });

  it("clamps range when confirmations push toBlock below fromBlock", () => {
    const window = computeSyncWindow({
      latestBlock: 20n,
      confirmations: 20n,
      reorgLookback: 12n,
      cursor,
      explicitFromBlock: undefined,
      explicitToBlock: undefined,
    });

    expect(window.fromBlock).toBe(0n);
    expect(window.toBlock).toBe(0n);
  });
});
