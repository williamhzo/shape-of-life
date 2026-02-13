import { stepGeneration, type BoardState } from "@shape-of-life/sim";
import { SEED_EDGE, SLOT_COLUMNS, TEAM_BLUE } from "@/lib/round-rules";

export type RevealedSeed = {
  player: string;
  slotIndex: number;
  team: number;
  seedBits: bigint;
};

export type SeedContribution = {
  player: string;
  slotIndex: number;
  team: number;
  initialCellCount: number;
  survivalGens: number;
  peakHomeCells: number;
  finalHomeCells: number;
  contributionScore: number;
};

const BOARD_WIDTH = SLOT_COLUMNS * SEED_EDGE;
const BOARD_HEIGHT = BOARD_WIDTH;

function popcount(v: bigint): number {
  let bits = BigInt.asUintN(64, v);
  let count = 0;
  while (bits !== 0n) {
    bits &= bits - 1n;
    count += 1;
  }
  return count;
}

function slotBaseCoords(slotIndex: number): { baseX: number; baseY: number } {
  return {
    baseX: (slotIndex % SLOT_COLUMNS) * SEED_EDGE,
    baseY: Math.floor(slotIndex / SLOT_COLUMNS) * SEED_EDGE,
  };
}

function countColorInRegion(
  rows: bigint[],
  baseX: number,
  baseY: number,
): number {
  const regionMask = ((1n << BigInt(SEED_EDGE)) - 1n) << BigInt(baseX);
  let count = 0;
  for (let y = baseY; y < baseY + SEED_EDGE; y += 1) {
    count += popcount(rows[y] & regionMask);
  }
  return count;
}

export function materializeBoard(seeds: RevealedSeed[]): BoardState {
  const blueRows = Array<bigint>(BOARD_HEIGHT).fill(0n);
  const redRows = Array<bigint>(BOARD_HEIGHT).fill(0n);

  for (const { slotIndex, team, seedBits } of seeds) {
    const { baseX, baseY } = slotBaseCoords(slotIndex);
    const targetRows = team === TEAM_BLUE ? blueRows : redRows;

    for (let localY = 0; localY < SEED_EDGE; localY += 1) {
      const rowBits = (seedBits >> BigInt(localY * SEED_EDGE)) & 0xffn;
      if (rowBits !== 0n) {
        targetRows[baseY + localY] |= rowBits << BigInt(baseX);
      }
    }
  }

  return { width: BOARD_WIDTH, height: BOARD_HEIGHT, blueRows, redRows };
}

export function computeSeedContributions(
  seeds: RevealedSeed[],
  finalGen: number,
): SeedContribution[] {
  if (seeds.length === 0 || finalGen < 0) return [];

  const trackers = seeds.map((seed) => {
    const { baseX, baseY } = slotBaseCoords(seed.slotIndex);
    return {
      ...seed,
      baseX,
      baseY,
      initialCellCount: popcount(seed.seedBits),
      survivalGens: 0,
      peakHomeCells: 0,
      finalHomeCells: 0,
    };
  });

  let board = materializeBoard(seeds);

  for (const t of trackers) {
    const rows = t.team === TEAM_BLUE ? board.blueRows : board.redRows;
    const count = countColorInRegion(rows, t.baseX, t.baseY);
    if (count > 0) t.survivalGens = 0;
    t.peakHomeCells = count;
  }

  for (let gen = 1; gen <= finalGen; gen += 1) {
    board = stepGeneration(board, "cylinder");

    for (const t of trackers) {
      const rows = t.team === TEAM_BLUE ? board.blueRows : board.redRows;
      const count = countColorInRegion(rows, t.baseX, t.baseY);
      if (count > 0) t.survivalGens = gen;
      if (count > t.peakHomeCells) t.peakHomeCells = count;
    }
  }

  for (const t of trackers) {
    const rows = t.team === TEAM_BLUE ? board.blueRows : board.redRows;
    t.finalHomeCells = countColorInRegion(rows, t.baseX, t.baseY);
  }

  return trackers
    .map((t) => ({
      player: t.player,
      slotIndex: t.slotIndex,
      team: t.team,
      initialCellCount: t.initialCellCount,
      survivalGens: t.survivalGens,
      peakHomeCells: t.peakHomeCells,
      finalHomeCells: t.finalHomeCells,
      contributionScore: 3 * t.finalHomeCells + t.survivalGens,
    }))
    .sort((a, b) => b.contributionScore - a.contributionScore);
}
