import { describe, expect, test } from "bun:test";

import { summarizeBoard } from "../lib/board-summary";

describe("summarizeBoard", () => {
  test("counts per-team live cells and totals", () => {
    const blueRows = [
      0b0001n,
      0b0110n,
      0b0000n,
      0b1000n,
    ];
    const redRows = [
      0b0010n,
      0b0001n,
      0b0100n,
      0b0000n,
    ];

    const summary = summarizeBoard({
      width: 4,
      height: 4,
      blueRows,
      redRows,
    });

    expect(summary.blue).toBe(4);
    expect(summary.red).toBe(3);
    expect(summary.total).toBe(7);
  });

  test("throws when board contains overlapping team bits", () => {
    expect(() =>
      summarizeBoard({
        width: 4,
        height: 1,
        blueRows: [0b0011n],
        redRows: [0b0001n],
      }),
    ).toThrow("overlapping");
  });

  test("throws when any row sets bits outside board width", () => {
    expect(() =>
      summarizeBoard({
        width: 4,
        height: 1,
        blueRows: [0b1_0000n],
        redRows: [0n],
      }),
    ).toThrow("outside board width");
  });
});
