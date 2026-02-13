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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    const id = setInterval(tick, 1000 / fps);
    return () => clearInterval(id);
  }, [paused, fps, tick]);

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Board</CardTitle>
          <p className="text-muted-foreground text-sm">Demo</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/replay">
            <Button variant="outline" size="sm">
              Replay
            </Button>
          </Link>
          <Badge variant={atEnd ? "default" : "secondary"}>
            Gen {gen}/{DEMO_MAX_GEN}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CanvasElement ref={canvasRef} />
        <Separator />
        <AnimationControls
          paused={paused}
          fps={fps}
          onTogglePause={() => setPaused((p) => !p)}
          onReset={handleReset}
          onFpsDown={() => setFps((f) => Math.max(1, f - 2))}
          onFpsUp={() => setFps((f) => Math.min(30, f + 2))}
        />
      </CardContent>
    </Card>
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
    const id = setInterval(tick, 1000 / fps);
    return () => clearInterval(id);
  }, [paused, fps, tick]);

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Board</CardTitle>
          <p className="text-muted-foreground text-sm">Live</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/replay">
            <Button variant="outline" size="sm">
              Replay
            </Button>
          </Link>
          <Badge variant={atEnd ? "default" : "secondary"}>
            Gen {gen}/{maxGen}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CanvasElement ref={canvasRef} />
        <Separator />
        <AnimationControls
          paused={paused}
          fps={fps}
          onTogglePause={() => setPaused((p) => !p)}
          onReset={handleReset}
          onFpsDown={() => setFps((f) => Math.max(1, f - 2))}
          onFpsUp={() => setFps((f) => Math.min(30, f + 2))}
        />
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Board</CardTitle>
          <p className="text-muted-foreground text-sm">Final</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/replay">
            <Button variant="outline" size="sm">
              Replay
            </Button>
          </Link>
          <Badge>Gen {maxGen}/{maxGen}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CanvasElement ref={canvasRef} />
      </CardContent>
    </Card>
  );
}

const CanvasElement = forwardRef<HTMLCanvasElement>(function CanvasElement(_, ref) {
  return (
    <div className="flex justify-center">
      <canvas
        ref={ref}
        width={CANVAS_PX}
        height={CANVAS_PX}
        className="rounded border"
        style={{ width: CANVAS_PX / 2, height: CANVAS_PX / 2, imageRendering: "pixelated" }}
      />
    </div>
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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onTogglePause}>
        {paused ? "Play" : "Pause"}
      </Button>
      <Button variant="outline" size="sm" onClick={onReset}>
        Reset
      </Button>
      <span className="text-muted-foreground ml-auto text-xs">
        {fps} fps
      </span>
      <Button variant="ghost" size="sm" onClick={onFpsDown} disabled={fps <= 1}>
        -
      </Button>
      <Button variant="ghost" size="sm" onClick={onFpsUp} disabled={fps >= 30}>
        +
      </Button>
    </div>
  );
}
