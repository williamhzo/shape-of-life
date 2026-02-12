import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Measurement = {
  steps: number;
  gasUsed: bigint;
};

const DEFAULT_STEPS = [8, 12, 16, 20, 24, 28, 32];
const BPS_DENOMINATOR = 10_000n;

export function parseCastEstimate(output: string): bigint {
  const trimmed = output.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`unexpected cast estimate output: ${output}`);
  }

  return BigInt(trimmed);
}

export function selectLockedMaxBatch(measurements: Measurement[], gasLimit: bigint, safetyBps: number): number {
  if (measurements.length === 0) {
    throw new Error("no measurements provided");
  }
  if (safetyBps <= 0 || safetyBps > Number(BPS_DENOMINATOR)) {
    throw new Error("invalid safetyBps");
  }

  const thresholdGas = (gasLimit * BigInt(safetyBps)) / BPS_DENOMINATOR;
  const safe = [...measurements]
    .filter((entry) => entry.steps > 0 && entry.gasUsed <= thresholdGas)
    .sort((a, b) => a.steps - b.steps);

  if (safe.length === 0) {
    throw new Error("no safe maxBatch found under configured threshold");
  }

  return safe[safe.length - 1].steps;
}

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

function parseSteps(raw: string | undefined): number[] {
  if (!raw) {
    return [...DEFAULT_STEPS];
  }

  return raw
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function runCastEstimate(rpcUrl: string, roundAddress: string, caller: string | undefined, steps: number): bigint {
  const args = ["estimate", "--rpc-url", rpcUrl];
  if (caller) {
    args.push("--from", caller);
  }

  args.push(roundAddress, "stepBatch(uint16)", String(steps));

  const output = execFileSync("cast", args, { encoding: "utf8" });
  return parseCastEstimate(output);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = process.env.SHAPE_SEPOLIA_RPC_URL;
  const roundAddress = args.round ?? process.env.ROUND_ADDRESS;
  const from = args.from ?? process.env.BENCHMARK_CALLER;

  if (!rpcUrl) {
    throw new Error("SHAPE_SEPOLIA_RPC_URL is required");
  }
  if (!roundAddress) {
    throw new Error("--round or ROUND_ADDRESS is required");
  }

  const steps = parseSteps(args.steps);
  if (steps.length === 0) {
    throw new Error("no valid steps provided");
  }

  const gasLimit = BigInt(args["gas-limit"] ?? "1200000");
  const safetyBps = Number(args["safety-bps"] ?? "8500");
  const thresholdGas = (gasLimit * BigInt(safetyBps)) / BPS_DENOMINATOR;

  const measurements = steps.map((step) => ({ steps: step, gasUsed: runCastEstimate(rpcUrl, roundAddress, from, step) }));
  const lockedMaxBatch = selectLockedMaxBatch(measurements, gasLimit, safetyBps);

  const outPath = resolve(args.out ?? "packages/contracts/benchmarks/sepolia-max-batch.latest.json");
  mkdirSync(dirname(outPath), { recursive: true });

  const payload = {
    network: "shape-sepolia",
    roundAddress,
    measuredAt: new Date().toISOString(),
    gasLimit: gasLimit.toString(),
    safetyBps,
    thresholdGas: thresholdGas.toString(),
    lockedMaxBatch,
    measurements: measurements.map((entry) => ({
      steps: entry.steps,
      gasUsed: entry.gasUsed.toString(),
    })),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  process.stdout.write(`locked maxBatch=${lockedMaxBatch} written to ${outPath}\n`);
}

if (import.meta.main) {
  main();
}
