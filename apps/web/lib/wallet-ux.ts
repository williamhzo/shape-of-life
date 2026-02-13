export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
export const SLOT_COUNT = 64;
export const TEAM_SLOT_COUNT = 32;
export const SEED_EDGE = 8;
export const SEED_BUDGET = 12;

export type SeedTransform = "rotate-90" | "rotate-180" | "rotate-270" | "mirror-x" | "mirror-y" | "translate";

export type SeedPreset = {
  id: string;
  name: string;
  seedBits: bigint;
  liveCells: number;
};

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

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}

function setSeedCell(seedBits: bigint, x: number, y: number, alive: boolean): bigint {
  assertSeedCoordinate(x, y);
  const bitIndex = BigInt(y * SEED_EDGE + x);
  const mask = 1n << bitIndex;
  return alive ? seedBits | mask : seedBits & ~mask;
}

function seedFromCoordinates(coordinates: Array<{ x: number; y: number }>): bigint {
  let seedBits = 0n;
  for (const coordinate of coordinates) {
    seedBits = setSeedCell(seedBits, coordinate.x, coordinate.y, true);
  }
  return seedBits;
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

export function applySeedTransform(seedBits: bigint, transform: SeedTransform, options?: { dx: number; dy: number }): bigint {
  const normalized = BigInt.asUintN(64, seedBits);
  let transformed = 0n;

  if (transform === "translate") {
    const dx = options?.dx ?? 0;
    const dy = options?.dy ?? 0;
    assertInteger(dx, "dx");
    assertInteger(dy, "dy");

    for (let y = 0; y < SEED_EDGE; y += 1) {
      for (let x = 0; x < SEED_EDGE; x += 1) {
        if (!isSeedCellAlive(normalized, x, y)) {
          continue;
        }

        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= SEED_EDGE || nextY < 0 || nextY >= SEED_EDGE) {
          continue;
        }

        transformed = setSeedCell(transformed, nextX, nextY, true);
      }
    }

    return transformed;
  }

  for (let y = 0; y < SEED_EDGE; y += 1) {
    for (let x = 0; x < SEED_EDGE; x += 1) {
      if (!isSeedCellAlive(normalized, x, y)) {
        continue;
      }

      let nextX = x;
      let nextY = y;

      if (transform === "rotate-90") {
        nextX = SEED_EDGE - 1 - y;
        nextY = x;
      } else if (transform === "rotate-180") {
        nextX = SEED_EDGE - 1 - x;
        nextY = SEED_EDGE - 1 - y;
      } else if (transform === "rotate-270") {
        nextX = y;
        nextY = SEED_EDGE - 1 - x;
      } else if (transform === "mirror-x") {
        nextX = SEED_EDGE - 1 - x;
      } else if (transform === "mirror-y") {
        nextY = SEED_EDGE - 1 - y;
      }

      transformed = setSeedCell(transformed, nextX, nextY, true);
    }
  }

  return transformed;
}

export const SEED_PRESETS: SeedPreset[] = [
  {
    id: "glider",
    name: "Glider",
    seedBits: seedFromCoordinates([
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]),
    liveCells: 5,
  },
  {
    id: "blinker",
    name: "Blinker",
    seedBits: seedFromCoordinates([
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]),
    liveCells: 3,
  },
  {
    id: "toad",
    name: "Toad",
    seedBits: seedFromCoordinates([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]),
    liveCells: 6,
  },
  {
    id: "light-cross",
    name: "Light Cross",
    seedBits: seedFromCoordinates([
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]),
    liveCells: 11,
  },
];

export function getSeedPresetById(presetId: string): SeedPreset | null {
  const preset = SEED_PRESETS.find((candidate) => candidate.id === presetId);
  return preset ?? null;
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
