import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type BenchmarkArtifact = {
  roundAddress: string;
  measuredAt: string;
  lockedMaxBatch: number;
  thresholdGas?: string;
  gasLimit?: string;
  safetyBps?: number;
};

type SepoliaParameters = {
  ConwayArenaRoundModule: {
    commitDuration: number;
    revealDuration: number;
    maxGen: number;
    maxBatch: number;
  };
};

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }

    parsed[key] = value;
    i += 1;
  }

  return parsed;
}

export function parseBenchmarkArtifact(raw: string): BenchmarkArtifact {
  const parsed = JSON.parse(raw) as Partial<BenchmarkArtifact>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid benchmark artifact payload");
  }
  if (!Number.isInteger(parsed.lockedMaxBatch) || Number(parsed.lockedMaxBatch) <= 0) {
    throw new Error("benchmark artifact missing valid lockedMaxBatch");
  }
  if (typeof parsed.roundAddress !== "string" || parsed.roundAddress.length === 0) {
    throw new Error("benchmark artifact missing roundAddress");
  }
  if (typeof parsed.measuredAt !== "string" || parsed.measuredAt.length === 0) {
    throw new Error("benchmark artifact missing measuredAt");
  }

  return {
    roundAddress: parsed.roundAddress,
    measuredAt: parsed.measuredAt,
    lockedMaxBatch: Number(parsed.lockedMaxBatch),
    thresholdGas: parsed.thresholdGas,
    gasLimit: parsed.gasLimit,
    safetyBps: parsed.safetyBps,
  };
}

export function withLockedMaxBatch(rawParams: string, lockedMaxBatch: number): string {
  if (!Number.isInteger(lockedMaxBatch) || lockedMaxBatch <= 0) {
    throw new Error("invalid lockedMaxBatch");
  }

  const parsed = JSON.parse(rawParams) as Partial<SepoliaParameters>;
  if (!parsed || typeof parsed !== "object" || !parsed.ConwayArenaRoundModule) {
    throw new Error("invalid shape-sepolia params payload");
  }

  const next: SepoliaParameters = {
    ConwayArenaRoundModule: {
      ...parsed.ConwayArenaRoundModule,
      maxBatch: lockedMaxBatch,
    },
  };

  return JSON.stringify(next, null, 2) + "\n";
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const benchmarkPath = resolve(args.benchmark ?? "packages/contracts/benchmarks/sepolia-max-batch.latest.json");
  const paramsPath = resolve(args.params ?? "packages/contracts/ignition/parameters/shape-sepolia.json");
  const lockPath = resolve(args.out ?? "packages/contracts/benchmarks/sepolia-max-batch.lock.json");

  const benchmark = parseBenchmarkArtifact(readFileSync(benchmarkPath, "utf8"));
  const nextParams = withLockedMaxBatch(readFileSync(paramsPath, "utf8"), benchmark.lockedMaxBatch);
  writeFileSync(paramsPath, nextParams, "utf8");

  mkdirSync(dirname(lockPath), { recursive: true });
  const lockPayload = {
    sourceArtifact: benchmarkPath,
    lockedAt: new Date().toISOString(),
    measuredAt: benchmark.measuredAt,
    roundAddress: benchmark.roundAddress,
    lockedMaxBatch: benchmark.lockedMaxBatch,
    thresholdGas: benchmark.thresholdGas ?? null,
    gasLimit: benchmark.gasLimit ?? null,
    safetyBps: benchmark.safetyBps ?? null,
  };
  writeFileSync(lockPath, JSON.stringify(lockPayload, null, 2) + "\n", "utf8");

  process.stdout.write(`locked maxBatch=${benchmark.lockedMaxBatch} written to ${paramsPath}\n`);
  process.stdout.write(`lock summary written to ${lockPath}\n`);
}

if (import.meta.main) {
  main();
}
