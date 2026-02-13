import { describe, expect, it } from "vitest";

import {
  SEED_PRESETS,
  applySeedTransform,
  countLiveSeedCells,
  getSeedPresetById,
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

  it("applies seed transforms (rotate, mirror, translate) within the 8x8 grid", () => {
    let seedBits = 0n;
    seedBits = toggleSeedCell(seedBits, 1, 0);
    seedBits = applySeedTransform(seedBits, "rotate-90");
    expect(isSeedCellAlive(seedBits, 7, 1)).toBe(true);

    seedBits = applySeedTransform(seedBits, "mirror-x");
    expect(isSeedCellAlive(seedBits, 0, 1)).toBe(true);

    seedBits = applySeedTransform(seedBits, "translate", { dx: 2, dy: 1 });
    expect(isSeedCellAlive(seedBits, 2, 2)).toBe(true);
  });

  it("ships preset seed patterns within budget", () => {
    expect(SEED_PRESETS.length).toBeGreaterThan(0);
    for (const preset of SEED_PRESETS) {
      expect(preset.liveCells).toBeLessThanOrEqual(12);
      expect(countLiveSeedCells(preset.seedBits)).toBe(preset.liveCells);
      expect(getSeedPresetById(preset.id)?.id).toBe(preset.id);
    }
  });
});
