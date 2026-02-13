import { describe, expect, test } from "vitest";

import {
  materializeBoard,
  computeSeedContributions,
  type RevealedSeed,
} from "../lib/seed-contribution";
import { TEAM_BLUE, TEAM_RED } from "../lib/round-rules";

function seedFromLocalCoords(coords: Array<{ x: number; y: number }>): bigint {
  let bits = 0n;
  for (const { x, y } of coords) {
    bits |= 1n << BigInt(y * 8 + x);
  }
  return bits;
}

describe("materializeBoard", () => {
  test("places a single blue seed in slot 0 (top-left)", () => {
    const seed: RevealedSeed = {
      player: "0xAlice",
      slotIndex: 0,
      team: TEAM_BLUE,
      seedBits: seedFromLocalCoords([{ x: 0, y: 0 }, { x: 1, y: 0 }]),
    };
    const board = materializeBoard([seed]);

    expect(board.width).toBe(64);
    expect(board.height).toBe(64);
    expect(board.blueRows[0]).toBe(0b11n);
    expect(board.redRows[0]).toBe(0n);
  });

  test("places a red seed in slot 4 (column 4, row 0)", () => {
    const seed: RevealedSeed = {
      player: "0xBob",
      slotIndex: 4,
      team: TEAM_RED,
      seedBits: seedFromLocalCoords([{ x: 0, y: 0 }]),
    };
    const board = materializeBoard([seed]);

    expect(board.redRows[0]).toBe(1n << 32n);
    expect(board.blueRows[0]).toBe(0n);
  });

  test("places seeds in slot 9 (column 1, row 1)", () => {
    const seed: RevealedSeed = {
      player: "0xCharlie",
      slotIndex: 9,
      team: TEAM_BLUE,
      seedBits: seedFromLocalCoords([{ x: 2, y: 3 }]),
    };
    const board = materializeBoard([seed]);

    const expectedX = 1 * 8 + 2;
    const expectedY = 1 * 8 + 3;
    expect((board.blueRows[expectedY] >> BigInt(expectedX)) & 1n).toBe(1n);
  });
});

describe("computeSeedContributions", () => {
  test("returns empty array for no seeds", () => {
    expect(computeSeedContributions([], 10)).toEqual([]);
  });

  test("blinker survives indefinitely and stays in home region", () => {
    const blinker = seedFromLocalCoords([
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
    ]);
    const seeds: RevealedSeed[] = [
      { player: "0xAlice", slotIndex: 0, team: TEAM_BLUE, seedBits: blinker },
    ];

    const results = computeSeedContributions(seeds, 10);
    expect(results).toHaveLength(1);
    const r = results[0];

    expect(r.initialCellCount).toBe(3);
    expect(r.survivalGens).toBe(10);
    expect(r.finalHomeCells).toBeGreaterThan(0);
    expect(r.peakHomeCells).toBeGreaterThanOrEqual(r.finalHomeCells);
  });

  test("isolated block is stable (survives all gens, constant count)", () => {
    const block = seedFromLocalCoords([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
    const seeds: RevealedSeed[] = [
      { player: "0xBob", slotIndex: 0, team: TEAM_BLUE, seedBits: block },
    ];

    const results = computeSeedContributions(seeds, 20);
    const r = results[0];

    expect(r.initialCellCount).toBe(4);
    expect(r.survivalGens).toBe(20);
    expect(r.finalHomeCells).toBe(4);
    expect(r.peakHomeCells).toBe(4);
  });

  test("results are sorted by contributionScore descending", () => {
    const block = seedFromLocalCoords([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
    const singleCell = seedFromLocalCoords([{ x: 0, y: 0 }]);

    const seeds: RevealedSeed[] = [
      { player: "0xAlice", slotIndex: 0, team: TEAM_BLUE, seedBits: singleCell },
      { player: "0xBob", slotIndex: 1, team: TEAM_BLUE, seedBits: block },
    ];

    const results = computeSeedContributions(seeds, 5);
    expect(results[0].player).toBe("0xBob");
    expect(results[0].contributionScore).toBeGreaterThan(results[1].contributionScore);
  });

  test("single cell dies at gen 1 (no neighbors)", () => {
    const singleCell = seedFromLocalCoords([{ x: 3, y: 3 }]);
    const seeds: RevealedSeed[] = [
      { player: "0xAlice", slotIndex: 0, team: TEAM_BLUE, seedBits: singleCell },
    ];

    const results = computeSeedContributions(seeds, 5);
    const r = results[0];

    expect(r.survivalGens).toBe(0);
    expect(r.finalHomeCells).toBe(0);
  });

  test("two opposing seeds in adjacent slots track independently", () => {
    const block = seedFromLocalCoords([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);

    const seeds: RevealedSeed[] = [
      { player: "0xAlice", slotIndex: 0, team: TEAM_BLUE, seedBits: block },
      { player: "0xBob", slotIndex: 4, team: TEAM_RED, seedBits: block },
    ];

    const results = computeSeedContributions(seeds, 10);
    expect(results).toHaveLength(2);

    const alice = results.find((r) => r.player === "0xAlice")!;
    const bob = results.find((r) => r.player === "0xBob")!;

    expect(alice.team).toBe(TEAM_BLUE);
    expect(bob.team).toBe(TEAM_RED);
    expect(alice.survivalGens).toBe(10);
    expect(bob.survivalGens).toBe(10);
  });

  test("contributionScore formula: 3 * finalHomeCells + survivalGens", () => {
    const block = seedFromLocalCoords([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
    const seeds: RevealedSeed[] = [
      { player: "0xAlice", slotIndex: 0, team: TEAM_BLUE, seedBits: block },
    ];

    const results = computeSeedContributions(seeds, 8);
    const r = results[0];

    expect(r.contributionScore).toBe(3 * r.finalHomeCells + r.survivalGens);
  });
});
