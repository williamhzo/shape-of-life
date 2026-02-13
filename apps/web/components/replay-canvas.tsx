"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BoardState } from "@shape-of-life/sim";
import { renderBoardPixels } from "@/lib/board-renderer";
import { buildReplayTimeline, type SignatureMoment } from "@/lib/replay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

const BOARD_SIZE = 64;
const CANVAS_SCALE = 8;
const CANVAS_PX = BOARD_SIZE * CANVAS_SCALE;
const DEFAULT_FPS = 10;

type ReplayCanvasProps = {
  initialBoard: BoardState;
  maxGenerations?: number;
  title?: string;
};

export function ReplayCanvas({
  initialBoard,
  maxGenerations = 256,
  title = "Replay",
}: ReplayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gen, setGen] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(DEFAULT_FPS);

  const timeline = useMemo(
    () => buildReplayTimeline(initialBoard, maxGenerations),
    [initialBoard, maxGenerations],
  );

  const maxFrame = timeline.frames.length - 1;
  const currentFrame = timeline.frames[Math.min(gen, maxFrame)];

  const paint = useCallback(
    (board: BoardState) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height, data } = renderBoardPixels(board, {
        scale: CANVAS_SCALE,
      });
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
    },
    [],
  );

  useEffect(() => {
    if (currentFrame) paint(currentFrame.board);
  }, [currentFrame, paint]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setGen((g) => {
        const next = g + 1;
        if (next > maxFrame) {
          setPlaying(false);
          return g;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [playing, fps, maxFrame]);

  const handleSeek = useCallback((value: number[]) => {
    setGen(value[0]);
    setPlaying(false);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {currentFrame
              ? `Blue: ${currentFrame.summary.blue} | Red: ${currentFrame.summary.red} | Total: ${currentFrame.summary.total}`
              : "No data"}
          </p>
        </div>
        <Badge variant={gen >= maxFrame ? "default" : "secondary"}>
          Gen {gen}/{maxFrame}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_PX}
            height={CANVAS_PX}
            className="rounded border"
            style={{
              width: CANVAS_PX / 2,
              height: CANVAS_PX / 2,
              imageRendering: "pixelated",
            }}
          />
        </div>

        <div className="space-y-2">
          <Slider
            value={[gen]}
            min={0}
            max={maxFrame}
            step={1}
            onValueChange={handleSeek}
          />
          {timeline.moments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {timeline.moments.map((moment) => (
                <Button
                  key={`${moment.kind}-${moment.generation}`}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={() => {
                    setGen(moment.generation);
                    setPlaying(false);
                  }}
                >
                  <MomentBadge moment={moment} />
                </Button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setGen(0);
              setPlaying(false);
            }}
          >
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

function MomentBadge({ moment }: { moment: SignatureMoment }) {
  const variant =
    moment.kind === "peak-population"
      ? "default"
      : moment.kind === "lead-change"
        ? "secondary"
        : "destructive";
  return (
    <Badge variant={variant} className="text-[10px]">
      Gen {moment.generation}: {moment.label}
    </Badge>
  );
}
