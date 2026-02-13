import { describe, expect, it } from "vitest";

import type { BoardState } from "@shape-of-life/sim";
import {
  createAnimationState,
  stepAnimation,
  type AnimationState,
} from "../lib/board-animation";

function makeBoard(blueRow0 = 0n, redRow0 = 0n): BoardState {
  const blueRows = Array.from({ length: 8 }, () => 0n);
  const redRows = Array.from({ length: 8 }, () => 0n);
  blueRows[0] = blueRow0;
  redRows[0] = redRow0;
  return { width: 8, height: 8, blueRows, redRows };
}

describe("createAnimationState", () => {
  it("creates initial state from a board snapshot", () => {
    const board = makeBoard(0b111n);
    const state = createAnimationState(board, { maxGen: 256 });
    expect(state.generation).toBe(0);
    expect(state.maxGeneration).toBe(256);
    expect(state.board.blueRows[0]).toBe(0b111n);
    expect(state.paused).toBe(false);
  });
});

describe("stepAnimation", () => {
  it("advances one generation via TS engine", () => {
    const board = makeBoard(0b010n);
    const state = createAnimationState(board, { maxGen: 256 });
    const next = stepAnimation(state);
    expect(next.generation).toBe(1);
    expect(next.board).not.toBe(state.board);
  });

  it("stops at maxGeneration", () => {
    const board = makeBoard(0b111n);
    const state = createAnimationState(board, { maxGen: 2 });
    const s1 = stepAnimation(state);
    const s2 = stepAnimation(s1);
    expect(s2.generation).toBe(2);
    const s3 = stepAnimation(s2);
    expect(s3.generation).toBe(2);
    expect(s3.board).toBe(s2.board);
  });

  it("does not step when paused", () => {
    const board = makeBoard(0b111n);
    const state: AnimationState = { ...createAnimationState(board, { maxGen: 256 }), paused: true };
    const next = stepAnimation(state);
    expect(next.generation).toBe(0);
    expect(next.board).toBe(state.board);
  });

  it("detects extinction (both teams dead)", () => {
    const empty = makeBoard();
    const state = createAnimationState(empty, { maxGen: 256 });
    const next = stepAnimation(state);
    expect(next.generation).toBe(0);
    expect(next.board).toBe(state.board);
  });

  it("produces deterministic multi-step evolution from blinker", () => {
    const blinker = makeBoard(0b010n);
    blinker.blueRows[1] = 0b010n;
    blinker.blueRows[2] = 0b010n;
    const s0 = createAnimationState(blinker, { maxGen: 256 });
    const s1 = stepAnimation(s0);
    const s2 = stepAnimation(s1);
    expect(s2.board.blueRows[0]).toBe(blinker.blueRows[0]);
    expect(s2.board.blueRows[1]).toBe(blinker.blueRows[1]);
    expect(s2.board.blueRows[2]).toBe(blinker.blueRows[2]);
  });
});
