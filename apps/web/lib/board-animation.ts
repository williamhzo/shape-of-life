import { stepGeneration, type BoardState } from "@shape-of-life/sim";

export type AnimationState = {
  board: BoardState;
  generation: number;
  maxGeneration: number;
  paused: boolean;
  checkpointGen: number;
};

export function createAnimationState(
  board: BoardState,
  options: { maxGen: number; checkpointGen?: number },
): AnimationState {
  const checkpointGen = options.checkpointGen ?? 0;
  return {
    board,
    generation: checkpointGen,
    maxGeneration: options.maxGen,
    paused: false,
    checkpointGen,
  };
}

export function syncToCheckpoint(
  current: AnimationState,
  board: BoardState,
  checkpointGen: number,
): AnimationState {
  return {
    ...current,
    board,
    generation: checkpointGen,
    checkpointGen,
  };
}

function isBoardEmpty(board: BoardState): boolean {
  for (let y = 0; y < board.height; y++) {
    if (board.blueRows[y] !== 0n || board.redRows[y] !== 0n) return false;
  }
  return true;
}

export function stepAnimation(state: AnimationState): AnimationState {
  if (state.paused) return state;
  if (state.generation >= state.maxGeneration) return state;
  if (isBoardEmpty(state.board)) return state;

  const next = stepGeneration(state.board, "cylinder");
  return {
    ...state,
    board: next,
    generation: state.generation + 1,
  };
}
