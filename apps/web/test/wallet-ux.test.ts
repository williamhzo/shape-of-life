import { describe, expect, it } from "bun:test";

import {
  countLiveSeedCells,
  isSeedCellAlive,
  isSlotIndexInTeamTerritory,
  slotIndexToGrid,
  toggleSeedCell,
} from "../lib/wallet-ux";

describe("wallet UX helpers", () => {
  it("toggles 8x8 seed cells using row-major bit layout", () => {
    let seedBits = 0n;
    seedBits = toggleSeedCell(seedBits, 0, 0);
    seedBits = toggleSeedCell(seedBits, 7, 7);

    expect(isSeedCellAlive(seedBits, 0, 0)).toBe(true);
    expect(isSeedCellAlive(seedBits, 7, 7)).toBe(true);
    expect(countLiveSeedCells(seedBits)).toBe(2);

    seedBits = toggleSeedCell(seedBits, 0, 0);
    expect(isSeedCellAlive(seedBits, 0, 0)).toBe(false);
    expect(countLiveSeedCells(seedBits)).toBe(1);
  });

  it("maps slot indexes to 8x8 board grid coordinates", () => {
    expect(slotIndexToGrid(0)).toEqual({ tileX: 0, tileY: 0 });
    expect(slotIndexToGrid(7)).toEqual({ tileX: 7, tileY: 0 });
    expect(slotIndexToGrid(8)).toEqual({ tileX: 0, tileY: 1 });
    expect(slotIndexToGrid(63)).toEqual({ tileX: 7, tileY: 7 });
  });

  it("enforces team slot territories", () => {
    expect(isSlotIndexInTeamTerritory(0, 0)).toBe(true);
    expect(isSlotIndexInTeamTerritory(0, 31)).toBe(true);
    expect(isSlotIndexInTeamTerritory(0, 32)).toBe(false);

    expect(isSlotIndexInTeamTerritory(1, 31)).toBe(false);
    expect(isSlotIndexInTeamTerritory(1, 32)).toBe(true);
    expect(isSlotIndexInTeamTerritory(1, 63)).toBe(true);
  });
});
