export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
export const SLOT_COUNT = 64;
export const TEAM_SLOT_COUNT = 32;
export const SEED_EDGE = 8;
export const SEED_BUDGET = 12;

function assertSeedCoordinate(x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SEED_EDGE || y >= SEED_EDGE) {
    throw new Error(`seed coordinates out of bounds (${x}, ${y})`);
  }
}

function assertSlotIndex(slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) {
    throw new Error(`invalid slotIndex ${slotIndex}`);
  }
}

export function toggleSeedCell(seedBits: bigint, x: number, y: number): bigint {
  assertSeedCoordinate(x, y);
  const bitIndex = BigInt(y * SEED_EDGE + x);
  const mask = 1n << bitIndex;

  return seedBits ^ mask;
}

export function isSeedCellAlive(seedBits: bigint, x: number, y: number): boolean {
  assertSeedCoordinate(x, y);
  const bitIndex = BigInt(y * SEED_EDGE + x);
  const mask = 1n << bitIndex;
  return (seedBits & mask) !== 0n;
}

export function countLiveSeedCells(seedBits: bigint): number {
  let bits = BigInt.asUintN(64, seedBits);
  let count = 0;

  while (bits !== 0n) {
    bits &= bits - 1n;
    count += 1;
  }

  return count;
}

export function slotIndexToGrid(slotIndex: number): { tileX: number; tileY: number } {
  assertSlotIndex(slotIndex);
  return {
    tileX: slotIndex % SEED_EDGE,
    tileY: Math.floor(slotIndex / SEED_EDGE),
  };
}

export function isSlotIndexInTeamTerritory(team: number, slotIndex: number): boolean {
  assertSlotIndex(slotIndex);
  if (team === TEAM_BLUE) {
    return slotIndex < TEAM_SLOT_COUNT;
  }
  if (team === TEAM_RED) {
    return slotIndex >= TEAM_SLOT_COUNT;
  }

  throw new Error(`invalid team ${team}`);
}
