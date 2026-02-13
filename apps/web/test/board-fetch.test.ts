import { describe, expect, it } from "vitest";

import {
  BOARD_HEIGHT,
  contractRowsToBoardState,
} from "../lib/board-fetch";

function emptyRows(): bigint[] {
  return Array.from({ length: BOARD_HEIGHT }, () => 0n);
}

describe("contractRowsToBoardState", () => {
  it("converts valid rows to BoardState", () => {
    const blue = emptyRows();
    const red = emptyRows();
    blue[0] = 0b1010n;
    red[1] = 0b0101n;

    const board = contractRowsToBoardState(blue, red);
    expect(board.width).toBe(64);
    expect(board.height).toBe(64);
    expect(board.blueRows[0]).toBe(0b1010n);
    expect(board.redRows[1]).toBe(0b0101n);
  });

  it("returns a copy of the input arrays", () => {
    const blue = emptyRows();
    const red = emptyRows();
    const board = contractRowsToBoardState(blue, red);
    blue[0] = 1n;
    expect(board.blueRows[0]).toBe(0n);
  });

  it("throws on wrong blue array length", () => {
    expect(() =>
      contractRowsToBoardState([0n], emptyRows()),
    ).toThrow("expected 64 rows");
  });

  it("throws on wrong red array length", () => {
    expect(() =>
      contractRowsToBoardState(emptyRows(), [0n]),
    ).toThrow("expected 64 rows");
  });

  it("throws on color overlap", () => {
    const blue = emptyRows();
    const red = emptyRows();
    blue[5] = 0b111n;
    red[5] = 0b010n;
    expect(() => contractRowsToBoardState(blue, red)).toThrow(
      "color overlap at row 5",
    );
  });

  it("handles empty board", () => {
    const board = contractRowsToBoardState(emptyRows(), emptyRows());
    expect(board.blueRows.every((r) => r === 0n)).toBe(true);
    expect(board.redRows.every((r) => r === 0n)).toBe(true);
  });
});
