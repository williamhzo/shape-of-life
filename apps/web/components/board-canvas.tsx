"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { BoardState } from "@shape-of-life/sim";
import { SEED_PRESETS } from "@/lib/seed";
import { renderBoardPixels } from "@/lib/board-renderer";
import {
  createAnimationState,
  stepAnimation,
  type AnimationState,
} from "@/lib/board-animation";
import { useReducedMotion } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BOARD_SIZE = 64;
const CANVAS_SCALE = 8;
const CANVAS_PX = BOARD_SIZE * CANVAS_SCALE;
const DEFAULT_FPS = 10;
const DEMO_MAX_GEN = 256;

export type BoardCanvasMode =
  | { kind: "demo" }
  | { kind: "live"; board: BoardState; checkpointGen: number; maxGen: number }
  | { kind: "final"; board: BoardState; maxGen: number };

function buildDemoBoard(): BoardState {
  const blueRows = Array.from({ length: BOARD_SIZE }, () => 0n);
  const redRows = Array.from({ length: BOARD_SIZE }, () => 0n);

  const rpentomino = SEED_PRESETS.find((p) => p.id === "r-pentomino");
  const acorn = SEED_PRESETS.find((p) => p.id === "acorn");

  if (rpentomino) {
    placeSeed(blueRows, rpentomino.seedBits, 12, 20);
  }
  if (acorn) {
    placeSeed(redRows, acorn.seedBits, 44, 36);
  }

  return { width: BOARD_SIZE, height: BOARD_SIZE, blueRows, redRows };
}

function placeSeed(rows: bigint[], seedBits: bigint, boardX: number, boardY: number): void {
  for (let sy = 0; sy < 8; sy++) {
    const seedRow = (seedBits >> BigInt(sy * 8)) & 0xFFn;
    if (seedRow !== 0n) {
      rows[(boardY + sy) % BOARD_SIZE] |= seedRow << BigInt(boardX);
    }
  }
}

function buildDemoAnimation(): AnimationState {
  return createAnimationState(buildDemoBoard(), { maxGen: DEMO_MAX_GEN });
}

type BoardCanvasProps = {
  mode?: BoardCanvasMode;
};

export function BoardCanvas({ mode }: BoardCanvasProps) {
  const resolvedKind = mode?.kind ?? "demo";

  if (resolvedKind === "final") {
    return <FinalCanvas board={(mode as { kind: "final"; board: BoardState; maxGen: number }).board} maxGen={(mode as { kind: "final"; board: BoardState; maxGen: number }).maxGen} />;
  }

  if (resolvedKind === "live") {
    const m = mode as { kind: "live"; board: BoardState; checkpointGen: number; maxGen: number };
    return <LiveCanvas key={m.checkpointGen} board={m.board} checkpointGen={m.checkpointGen} maxGen={m.maxGen} />;
  }

  return <DemoCanvas />;
}

function DemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimationState>(buildDemoAnimation());
  const [gen, setGen] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const reducedMotion = useReducedMotion();
  const effectiveFps = reducedMotion ? Math.min(fps, 2) : fps;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const state = animRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, data } = renderBoardPixels(state.board, { scale: CANVAS_SCALE });
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
  }, []);

  const tick = useCallback(() => {
    if (animRef.current.paused) return;
    const next = stepAnimation(animRef.current);
    animRef.current = next;
    setGen(next.generation);
    paint();
  }, [paint]);

  useEffect(() => { paint(); }, [paint]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(tick, 1000 / effectiveFps);
    return () => clearInterval(id);
  }, [paused, effectiveFps, tick]);

  useEffect(() => {
    animRef.current = { ...animRef.current, paused };
  }, [paused]);

  const handleReset = useCallback(() => {
    animRef.current = buildDemoAnimation();
    setGen(0);
    setPaused(false);
    requestAnimationFrame(paint);
  }, [paint]);

  const atEnd = gen >= DEMO_MAX_GEN;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[640px]">
        <CanvasElement ref={canvasRef} />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <Link href="/replay">
            <Button variant="secondary" size="sm">
              Replay
            </Button>
          </Link>
          <Badge variant={atEnd ? "default" : "secondary"}>
            Gen {gen}/{DEMO_MAX_GEN}
          </Badge>
        </div>
      </div>
      <AnimationControls
        paused={paused}
        fps={fps}
        onTogglePause={() => setPaused((p) => !p)}
        onReset={handleReset}
        onFpsDown={() => setFps((f) => Math.max(1, f - 2))}
        onFpsUp={() => setFps((f) => Math.min(30, f + 2))}
      />
    </div>
  );
}

function LiveCanvas({
  board,
  checkpointGen,
  maxGen,
}: {
  board: BoardState;
  checkpointGen: number;
  maxGen: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimationState>(
    createAnimationState(board, { maxGen, checkpointGen }),
  );
  const [gen, setGen] = useState(checkpointGen);
  const [paused, setPaused] = useState(false);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const reducedMotion = useReducedMotion();
  const effectiveFps = reducedMotion ? Math.min(fps, 2) : fps;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const state = animRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, data } = renderBoardPixels(state.board, { scale: CANVAS_SCALE });
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
  }, []);

  const tick = useCallback(() => {
    if (animRef.current.paused) return;
    const next = stepAnimation(animRef.current);
    animRef.current = next;
    setGen(next.generation);
    paint();
  }, [paint]);

  useEffect(() => { paint(); }, [paint]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(tick, 1000 / effectiveFps);
    return () => clearInterval(id);
  }, [paused, effectiveFps, tick]);

  useEffect(() => {
    animRef.current = { ...animRef.current, paused };
  }, [paused]);

  const handleReset = useCallback(() => {
    animRef.current = createAnimationState(board, { maxGen, checkpointGen });
    setGen(checkpointGen);
    setPaused(false);
    requestAnimationFrame(paint);
  }, [board, maxGen, checkpointGen, paint]);

  const atEnd = gen >= maxGen;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[640px]">
        <CanvasElement ref={canvasRef} />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <Link href="/replay">
            <Button variant="secondary" size="sm">
              Replay
            </Button>
          </Link>
          <Badge variant={atEnd ? "default" : "secondary"}>
            Gen {gen}/{maxGen}
          </Badge>
        </div>
      </div>
      <AnimationControls
        paused={paused}
        fps={fps}
        onTogglePause={() => setPaused((p) => !p)}
        onReset={handleReset}
        onFpsDown={() => setFps((f) => Math.max(1, f - 2))}
        onFpsUp={() => setFps((f) => Math.min(30, f + 2))}
      />
    </div>
  );
}

function FinalCanvas({ board, maxGen }: { board: BoardState; maxGen: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, data } = renderBoardPixels(board, { scale: CANVAS_SCALE });
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
  }, [board]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[640px]">
        <CanvasElement ref={canvasRef} />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <Link href="/replay">
            <Button variant="secondary" size="sm">
              Replay
            </Button>
          </Link>
          <Badge>Gen {maxGen}/{maxGen}</Badge>
        </div>
      </div>
    </div>
  );
}

const CanvasElement = forwardRef<HTMLCanvasElement>(function CanvasElement(_, ref) {
  return (
    <canvas
      ref={ref}
      width={CANVAS_PX}
      height={CANVAS_PX}
      className="w-full rounded-lg"
      style={{ imageRendering: "pixelated" }}
    />
  );
});

function AnimationControls({
  paused,
  fps,
  onTogglePause,
  onReset,
  onFpsDown,
  onFpsUp,
}: {
  paused: boolean;
  fps: number;
  onTogglePause: () => void;
  onReset: () => void;
  onFpsDown: () => void;
  onFpsUp: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
      <Button variant="outline" size="sm" onClick={onTogglePause}>
        {paused ? "Play" : "Pause"}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        Reset
      </Button>
      <span className="text-muted-foreground ml-auto tabular-nums text-xs">
        {fps} fps
      </span>
      <Button variant="ghost" size="sm" onClick={onFpsDown} disabled={fps <= 1} aria-label="Decrease fps">
        -
      </Button>
      <Button variant="ghost" size="sm" onClick={onFpsUp} disabled={fps >= 30} aria-label="Increase fps">
        +
      </Button>
    </div>
  );
}
