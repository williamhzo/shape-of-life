"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { BoardState } from "@shape-of-life/sim";
import { SEED_PRESETS } from "@/lib/wallet-ux";
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
const MAX_GEN = 256;

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

function buildInitialAnimation(): AnimationState {
  return createAnimationState(buildDemoBoard(), { maxGen: MAX_GEN });
}

export function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimationState>(buildInitialAnimation());
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
    const imageData = new ImageData(data, width, height);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const tick = useCallback(() => {
    const state = animRef.current;
    if (state.paused) return;
    const next = stepAnimation(state);
    animRef.current = next;
    setGen(next.generation);
    paint();
  }, [paint]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(tick, 1000 / fps);
    return () => clearInterval(id);
  }, [paused, fps, tick]);

  useEffect(() => {
    animRef.current = { ...animRef.current, paused };
  }, [paused]);

  const handleReset = useCallback(() => {
    animRef.current = buildInitialAnimation();
    setGen(0);
    setPaused(false);
    requestAnimationFrame(paint);
  }, [paint]);

  const atEnd = gen >= MAX_GEN;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Board</CardTitle>
          <p className="text-muted-foreground text-sm">
            64x64 canvas, local TS forward-simulation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={atEnd ? "default" : "secondary"}>
            Gen {gen}/{MAX_GEN}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_PX}
            height={CANVAS_PX}
            className="rounded border"
            style={{ width: CANVAS_PX / 2, height: CANVAS_PX / 2, imageRendering: "pixelated" }}
          />
        </div>
        <Separator />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Play" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <span className="text-muted-foreground ml-auto text-xs">
            {fps} fps
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFps((f) => Math.max(1, f - 2))}
            disabled={fps <= 1}
          >
            -
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFps((f) => Math.min(30, f + 2))}
            disabled={fps >= 30}
          >
            +
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
