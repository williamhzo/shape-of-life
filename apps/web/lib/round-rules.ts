export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
export const SLOT_COUNT = 64;
export const TEAM_SLOT_COUNT = 32;
export const SLOT_COLUMNS = 8;
export const SEED_EDGE = 8;
export const SEED_BUDGET = 12;

export const WINNER_DRAW = 2;
export const SCORE_WEIGHT_POP = 3;
export const SCORE_WEIGHT_INVADE = 2;

export function isSlotIndexInTeamTerritory(team: number, slotIndex: number): boolean {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SLOT_COUNT) {
    throw new Error(`invalid slotIndex ${slotIndex}`);
  }
  const tileX = slotIndex % SLOT_COLUMNS;
  const halfColumns = SLOT_COLUMNS / 2;
  if (team === TEAM_BLUE) {
    return tileX < halfColumns;
  }
  if (team === TEAM_RED) {
    return tileX >= halfColumns;
  }
  throw new Error(`invalid team ${team}`);
}
