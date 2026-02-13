import type { BoardState } from "@shape-of-life/sim";

export const BOARD_WIDTH = 64;
export const BOARD_HEIGHT = 64;

export function contractRowsToBoardState(
  blueRows: readonly bigint[],
  redRows: readonly bigint[],
): BoardState {
  if (blueRows.length !== BOARD_HEIGHT || redRows.length !== BOARD_HEIGHT) {
    throw new Error(
      `expected ${BOARD_HEIGHT} rows, got blue=${blueRows.length} red=${redRows.length}`,
    );
  }

  for (let y = 0; y < BOARD_HEIGHT; y++) {
    if ((blueRows[y] & redRows[y]) !== 0n) {
      throw new Error(`color overlap at row ${y}`);
    }
  }

  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    blueRows: [...blueRows],
    redRows: [...redRows],
  };
}
