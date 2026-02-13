import { stepGeneration, type BoardState } from "@shape-of-life/sim";
import { summarizeBoard, type BoardSummary } from "@/lib/board-summary";

export type ReplayFrame = {
  generation: number;
  board: BoardState;
  summary: BoardSummary;
};

export type SignatureMomentKind =
  | "peak-population"
  | "lead-change"
  | "mass-extinction"
  | "board-empty";

export type SignatureMoment = {
  kind: SignatureMomentKind;
  generation: number;
  label: string;
};

export type ReplayTimeline = {
  frames: ReplayFrame[];
  moments: SignatureMoment[];
};

export function buildReplayTimeline(
  initialBoard: BoardState,
  maxGenerations: number,
): ReplayTimeline {
  const frames: ReplayFrame[] = [];
  let board = initialBoard;

  for (let gen = 0; gen <= maxGenerations; gen++) {
    const summary = summarizeBoard(board);
    frames.push({ generation: gen, board, summary });
    if (summary.total === 0) break;
    if (gen < maxGenerations) {
      board = stepGeneration(board, "cylinder");
    }
  }

  const moments = detectSignatureMoments(frames);
  return { frames, moments };
}

function detectSignatureMoments(frames: ReplayFrame[]): SignatureMoment[] {
  if (frames.length < 2) return [];

  const moments: SignatureMoment[] = [];

  let peakGen = 0;
  let peakTotal = 0;
  for (const frame of frames) {
    if (frame.summary.total > peakTotal) {
      peakTotal = frame.summary.total;
      peakGen = frame.generation;
    }
  }
  if (peakTotal > 0 && peakGen > 0) {
    moments.push({
      kind: "peak-population",
      generation: peakGen,
      label: `Peak: ${peakTotal} cells`,
    });
  }

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];

    const prevLead = Math.sign(prev.summary.blue - prev.summary.red);
    const currLead = Math.sign(curr.summary.blue - curr.summary.red);
    if (prevLead !== 0 && currLead !== 0 && prevLead !== currLead) {
      const leader = currLead > 0 ? "Blue" : "Red";
      moments.push({
        kind: "lead-change",
        generation: curr.generation,
        label: `${leader} takes lead`,
      });
    }

    if (prev.summary.total > 0) {
      const drop = (prev.summary.total - curr.summary.total) / prev.summary.total;
      if (drop > 0.3) {
        const lost = prev.summary.total - curr.summary.total;
        moments.push({
          kind: "mass-extinction",
          generation: curr.generation,
          label: `-${lost} cells`,
        });
      }
    }

    if (prev.summary.total > 0 && curr.summary.total === 0) {
      moments.push({
        kind: "board-empty",
        generation: curr.generation,
        label: "Extinction",
      });
    }
  }

  return moments;
}
