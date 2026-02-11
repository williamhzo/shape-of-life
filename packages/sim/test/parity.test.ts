import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stepGeneration, type BoardState } from "../src/engine";

type ParityCase = {
  id: string;
  width: number;
  height: number;
  steps: number;
  input: {
    blueRows: string[];
    redRows: string[];
  };
  expected: {
    blueRows: string[];
    redRows: string[];
  };
};

type ParityFixture = {
  version: string;
  topology: "cylinder";
  cases: ParityCase[];
};

function normalizeHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function parseHexRows(rows: string[]): bigint[] {
  return rows.map((v) => BigInt(v));
}

function toHexRows(rows: bigint[]): string[] {
  return rows.map(normalizeHex);
}

function runSteps(state: BoardState, steps: number): BoardState {
  let current = state;
  for (let i = 0; i < steps; i += 1) {
    current = stepGeneration(current, "cylinder");
  }
  return current;
}

function nextU32(seedState: { value: number }): number {
  let x = seedState.value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  seedState.value = x >>> 0;
  return seedState.value;
}

function makeRandomBoard(width: number, height: number, seed: number): BoardState {
  const blueRows = Array<bigint>(height).fill(0n);
  const redRows = Array<bigint>(height).fill(0n);
  const rng = { value: seed || 1 };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const roll = nextU32(rng) % 10;
      const bit = 1n << BigInt(x);
      if (roll < 2) {
        blueRows[y] |= bit;
      } else if (roll < 4) {
        redRows[y] |= bit;
      }
    }
  }

  return { width, height, blueRows, redRows };
}

type CellState = 0 | 1 | 2;

function referenceStep(state: BoardState): BoardState {
  const { width, height } = state;
  const grid: CellState[][] = Array.from({ length: height }, () =>
    Array<CellState>(width).fill(0),
  );
  const next: CellState[][] = Array.from({ length: height }, () =>
    Array<CellState>(width).fill(0),
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const blue = ((state.blueRows[y] >> BigInt(x)) & 1n) === 1n;
      const red = ((state.redRows[y] >> BigInt(x)) & 1n) === 1n;
      if (blue && red) {
        throw new Error("invalid input state: overlapping blue/red cell");
      }
      grid[y][x] = blue ? 1 : red ? 2 : 0;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let blueNeighbors = 0;
      let redNeighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            continue;
          }
          const ny = (y + dy + height) % height;
          const neighbor = grid[ny][nx];
          if (neighbor === 1) {
            blueNeighbors += 1;
          } else if (neighbor === 2) {
            redNeighbors += 1;
          }
        }
      }
      const liveNeighbors = blueNeighbors + redNeighbors;
      const current = grid[y][x];

      if (current === 1 || current === 2) {
        if (liveNeighbors === 2 || liveNeighbors === 3) {
          next[y][x] = current;
        }
        continue;
      }

      if (liveNeighbors === 3) {
        if (blueNeighbors > redNeighbors) {
          next[y][x] = 1;
        } else if (redNeighbors > blueNeighbors) {
          next[y][x] = 2;
        }
      }
    }
  }

  const blueRows = Array<bigint>(height).fill(0n);
  const redRows = Array<bigint>(height).fill(0n);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (next[y][x] === 1) {
        blueRows[y] |= 1n << BigInt(x);
      } else if (next[y][x] === 2) {
        redRows[y] |= 1n << BigInt(x);
      }
    }
  }

  return { width, height, blueRows, redRows };
}

const fixturePath = join(import.meta.dir, "..", "..", "..", "fixtures", "engine", "parity.v1.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ParityFixture;

describe("golden parity vectors", () => {
  test("fixture metadata is valid", () => {
    expect(fixture.version).toBe("v1");
    expect(fixture.topology).toBe("cylinder");
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const parityCase of fixture.cases) {
    test(parityCase.id, () => {
      const result = runSteps(
        {
          width: parityCase.width,
          height: parityCase.height,
          blueRows: parseHexRows(parityCase.input.blueRows),
          redRows: parseHexRows(parityCase.input.redRows),
        },
        parityCase.steps,
      );

      expect(toHexRows(result.blueRows)).toEqual(parityCase.expected.blueRows);
      expect(toHexRows(result.redRows)).toEqual(parityCase.expected.redRows);
      for (let y = 0; y < result.height; y += 1) {
        expect((result.blueRows[y] & result.redRows[y]) === 0n).toBe(true);
      }
    });
  }
});

describe("random-seed fuzz parity", () => {
  test("matches reference engine across deterministic seeds", () => {
    const width = 16;
    const height = 16;
    const seeds = 50;
    const stepsPerSeed = 8;

    for (let seed = 1; seed <= seeds; seed += 1) {
      let engineState = makeRandomBoard(width, height, seed);
      let referenceState = makeRandomBoard(width, height, seed);

      for (let step = 0; step < stepsPerSeed; step += 1) {
        engineState = stepGeneration(engineState, "cylinder");
        referenceState = referenceStep(referenceState);
        expect(engineState.blueRows).toEqual(referenceState.blueRows);
        expect(engineState.redRows).toEqual(referenceState.redRows);
      }
    }
  });
});
