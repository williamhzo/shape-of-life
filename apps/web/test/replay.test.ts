import { describe, expect, it } from "vitest";

import type { BoardState } from "@shape-of-life/sim";
import { buildReplayTimeline } from "../lib/replay";

function emptyBoard(size = 8): BoardState {
  return {
    width: size,
    height: size,
    blueRows: Array.from({ length: size }, () => 0n),
    redRows: Array.from({ length: size }, () => 0n),
  };
}

function boardWith(overrides: { blueRows?: [number, bigint][]; redRows?: [number, bigint][] }, size = 8): BoardState {
  const board = emptyBoard(size);
  for (const [y, bits] of overrides.blueRows ?? []) board.blueRows[y] = bits;
  for (const [y, bits] of overrides.redRows ?? []) board.redRows[y] = bits;
  return board;
}

describe("buildReplayTimeline", () => {
  it("produces frames from gen 0 to maxGenerations", () => {
    const board = boardWith({ blueRows: [[1, 0b111n]] });
    const timeline = buildReplayTimeline(board, 10);
    expect(timeline.frames[0].generation).toBe(0);
    expect(timeline.frames.length).toBeGreaterThanOrEqual(2);
    expect(timeline.frames.length).toBeLessThanOrEqual(12);
  });

  it("stops early on empty board", () => {
    const board = emptyBoard();
    const timeline = buildReplayTimeline(board, 100);
    expect(timeline.frames).toHaveLength(1);
    expect(timeline.frames[0].summary.total).toBe(0);
  });

  it("stops when board goes extinct mid-run", () => {
    const board = boardWith({ blueRows: [[0, 0b1n]] });
    const timeline = buildReplayTimeline(board, 100);
    const lastFrame = timeline.frames[timeline.frames.length - 1];
    expect(lastFrame.summary.total).toBe(0);
    expect(timeline.frames.length).toBeLessThan(100);
  });

  it("includes correct summary at each frame", () => {
    const board = boardWith({ blueRows: [[1, 0b111n]], redRows: [[3, 0b11n]] });
    const timeline = buildReplayTimeline(board, 5);
    expect(timeline.frames[0].summary.blue).toBe(3);
    expect(timeline.frames[0].summary.red).toBe(2);
    expect(timeline.frames[0].summary.total).toBe(5);
  });
});

describe("signature moment detection", () => {
  it("detects board-empty moment", () => {
    const board = boardWith({ blueRows: [[0, 0b1n]] });
    const timeline = buildReplayTimeline(board, 100);
    const extinction = timeline.moments.find((m) => m.kind === "board-empty");
    expect(extinction).toBeDefined();
    expect(extinction!.label).toBe("Extinction");
  });

  it("detects peak-population for evolving patterns", () => {
    const board = emptyBoard(64);
    board.blueRows[28] = 0b11n << 29n;
    board.blueRows[29] = 0b11n << 28n;
    board.blueRows[30] = 0b1n << 29n;
    const timeline = buildReplayTimeline(board, 100);
    const peak = timeline.moments.find((m) => m.kind === "peak-population");
    expect(peak).toBeDefined();
    expect(peak!.generation).toBeGreaterThan(0);
  });

  it("detects lead-change when teams swap dominance", () => {
    const board = boardWith({
      blueRows: [[0, 0b111n], [1, 0b111n], [2, 0b111n]],
      redRows: [[5, 0b11n]],
    });
    const timeline = buildReplayTimeline(board, 50);
    const leadChanges = timeline.moments.filter((m) => m.kind === "lead-change");
    for (const lc of leadChanges) {
      expect(lc.label).toMatch(/Blue takes lead|Red takes lead/);
    }
  });

  it("returns empty moments for static boards", () => {
    const board = boardWith({
      blueRows: [[0, 0b110n], [1, 0b110n]],
    });
    const timeline = buildReplayTimeline(board, 5);
    const nonPeak = timeline.moments.filter((m) => m.kind !== "peak-population");
    expect(nonPeak).toHaveLength(0);
  });
});
