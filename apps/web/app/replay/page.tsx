"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import type { BoardState } from "@shape-of-life/sim";
import { SEED_PRESETS } from "@/lib/wallet-ux";
import { SEED_EDGE } from "@/lib/round-rules";
import { decodeSeedLink, resolveSeedBits, encodeSeedLink } from "@/lib/seed-link";
import { ReplayCanvas } from "@/components/replay-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BOARD_SIZE = 64;
const MAX_GEN = 256;

function placeSeed(
  rows: bigint[],
  seedBits: bigint,
  boardX: number,
  boardY: number,
): void {
  for (let sy = 0; sy < SEED_EDGE; sy++) {
    const seedRow = (seedBits >> BigInt(sy * SEED_EDGE)) & 0xFFn;
    if (seedRow !== 0n) {
      rows[(boardY + sy) % BOARD_SIZE] |= seedRow << BigInt(boardX);
    }
  }
}

function buildDemoBoard(): BoardState {
  const blueRows = Array.from({ length: BOARD_SIZE }, () => 0n);
  const redRows = Array.from({ length: BOARD_SIZE }, () => 0n);

  const rpentomino = SEED_PRESETS.find((p) => p.id === "r-pentomino");
  const acorn = SEED_PRESETS.find((p) => p.id === "acorn");
  if (rpentomino) placeSeed(blueRows, rpentomino.seedBits, 12, 20);
  if (acorn) placeSeed(redRows, acorn.seedBits, 44, 36);

  return { width: BOARD_SIZE, height: BOARD_SIZE, blueRows, redRows };
}

function buildBoardFromSeed(seedBits: bigint, team: number): BoardState {
  const blueRows = Array.from({ length: BOARD_SIZE }, () => 0n);
  const redRows = Array.from({ length: BOARD_SIZE }, () => 0n);

  const cx = Math.floor((BOARD_SIZE - SEED_EDGE) / 2);
  const cy = Math.floor((BOARD_SIZE - SEED_EDGE) / 2);
  const rows = team === 0 ? blueRows : redRows;
  placeSeed(rows, seedBits, cx, cy);

  return { width: BOARD_SIZE, height: BOARD_SIZE, blueRows, redRows };
}

function ReplayPageInner() {
  const searchParams = useSearchParams();
  const linkParams = useMemo(
    () => decodeSeedLink(searchParams),
    [searchParams],
  );
  const resolvedSeed = useMemo(() => resolveSeedBits(linkParams), [linkParams]);

  const board = useMemo(() => {
    if (resolvedSeed !== null) {
      return buildBoardFromSeed(resolvedSeed, linkParams.team ?? 0);
    }
    return buildDemoBoard();
  }, [resolvedSeed, linkParams.team]);

  const title = linkParams.preset
    ? `Replay: ${linkParams.preset}`
    : resolvedSeed !== null
      ? "Replay: Custom Seed"
      : "Replay: Demo";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Replay</CardTitle>
            <p className="text-muted-foreground text-sm">
              Scrub through generations and discover signature moments.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              Back
            </Button>
          </Link>
        </CardHeader>
      </Card>

      <ReplayCanvas
        initialBoard={board}
        maxGenerations={MAX_GEN}
        title={title}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Replays</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {SEED_PRESETS.map((preset) => (
            <Link
              key={preset.id}
              href={`/replay?${encodeSeedLink({ preset: preset.id, team: 0 })}`}
            >
              <Badge variant="secondary" className="cursor-pointer">
                {preset.name}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

export default function ReplayPage() {
  return (
    <Suspense>
      <ReplayPageInner />
    </Suspense>
  );
}
