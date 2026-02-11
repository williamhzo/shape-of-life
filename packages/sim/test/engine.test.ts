import { describe, expect, test } from "bun:test";

import { packRows, stepGeneration, unpackRows } from "../src/engine";

function setCell(rows: bigint[], x: number, y: number): void {
  rows[y] |= 1n << BigInt(x);
}

function hasCell(rows: bigint[], x: number, y: number): boolean {
  return ((rows[y] >> BigInt(x)) & 1n) === 1n;
}

describe("packing", () => {
  test("packs and unpacks 64 rows losslessly", () => {
    const rows = Array.from({ length: 64 }, (_, i) =>
      BigInt.asUintN(64, (1n << BigInt(i % 64)) | (BigInt(i) << 40n)),
    );

    const packed = packRows(rows);
    expect(packed).toHaveLength(16);
    const unpacked = unpackRows(packed, 64);

    expect(unpacked).toEqual(rows);
  });
});

describe("B3/S23", () => {
  test("blinker oscillates in one step", () => {
    const blueRows = Array<bigint>(5).fill(0n);
    const redRows = Array<bigint>(5).fill(0n);

    setCell(blueRows, 1, 2);
    setCell(blueRows, 2, 2);
    setCell(blueRows, 3, 2);

    const next = stepGeneration(
      {
        width: 5,
        height: 5,
        blueRows,
        redRows,
      },
      "cylinder",
    );

    expect(hasCell(next.blueRows, 2, 1)).toBe(true);
    expect(hasCell(next.blueRows, 2, 2)).toBe(true);
    expect(hasCell(next.blueRows, 2, 3)).toBe(true);
    expect(hasCell(next.blueRows, 1, 2)).toBe(false);
    expect(hasCell(next.blueRows, 3, 2)).toBe(false);
    expect(next.redRows.every((row) => row === 0n)).toBe(true);
  });
});

describe("immigration", () => {
  test("newborn takes majority color from three neighbors", () => {
    const blueRows = Array<bigint>(5).fill(0n);
    const redRows = Array<bigint>(5).fill(0n);

    setCell(blueRows, 1, 2);
    setCell(blueRows, 2, 1);
    setCell(redRows, 3, 2);

    const next = stepGeneration(
      {
        width: 5,
        height: 5,
        blueRows,
        redRows,
      },
      "cylinder",
    );

    expect(hasCell(next.blueRows, 2, 2)).toBe(true);
    expect(hasCell(next.redRows, 2, 2)).toBe(false);
  });
});
