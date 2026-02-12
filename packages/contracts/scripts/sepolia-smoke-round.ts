import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type SmokeSummary = {
  network: "shape-sepolia";
  roundAddress: string;
  chainId: number;
  phase: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  lockFile: string | null;
  lockMatch: boolean | null;
  lockedMaxBatch: number | null;
};

type LockFilePayload = {
  lockedMaxBatch: number;
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

export function parseCastUint(raw: string): number {
  const trimmed = raw.trim();
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return Number(BigInt(trimmed));
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  throw new Error(`unexpected cast numeric output: ${raw}`);
}

export function hasContractCode(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "0x" && trimmed !== "0x0";
}

function cast(rpcUrl: string, args: string[]): string {
  return execFileSync("cast", [...args, "--rpc-url", rpcUrl], { encoding: "utf8" });
}

function readLockFile(path: string): LockFilePayload {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<LockFilePayload>;
  if (!Number.isInteger(parsed.lockedMaxBatch) || Number(parsed.lockedMaxBatch) <= 0) {
    throw new Error(`invalid lockedMaxBatch in ${path}`);
  }

  return {
    lockedMaxBatch: Number(parsed.lockedMaxBatch),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = args.rpc ?? process.env.SHAPE_SEPOLIA_RPC_URL;
  const roundAddress = args.round ?? process.env.ROUND_ADDRESS;
  const lockPath = resolve(args.lock ?? "packages/contracts/benchmarks/sepolia-max-batch.lock.json");

  if (!rpcUrl) {
    throw new Error("--rpc or SHAPE_SEPOLIA_RPC_URL is required");
  }
  if (!roundAddress) {
    throw new Error("--round or ROUND_ADDRESS is required");
  }

  const chainId = parseCastUint(cast(rpcUrl, ["chain-id"]));
  if (chainId != 11011) {
    throw new Error(`unexpected chain id ${chainId}; expected 11011`);
  }

  const code = cast(rpcUrl, ["code", roundAddress]);
  if (!hasContractCode(code)) {
    throw new Error(`no bytecode found at ${roundAddress}`);
  }

  const phase = parseCastUint(cast(rpcUrl, ["call", roundAddress, "phase()(uint8)"]));
  const gen = parseCastUint(cast(rpcUrl, ["call", roundAddress, "gen()(uint16)"]));
  const maxGen = parseCastUint(cast(rpcUrl, ["call", roundAddress, "maxGen()(uint16)"]));
  const maxBatch = parseCastUint(cast(rpcUrl, ["call", roundAddress, "maxBatch()(uint16)"]));

  let lockFile: string | null = null;
  let lockMatch: boolean | null = null;
  let lockedMaxBatch: number | null = null;

  if (existsSync(lockPath)) {
    const lock = readLockFile(lockPath);
    lockFile = lockPath;
    lockMatch = lock.lockedMaxBatch === maxBatch;
    lockedMaxBatch = lock.lockedMaxBatch;

    if (!lockMatch) {
      throw new Error(
        `deployed maxBatch ${maxBatch} does not match locked maxBatch ${lock.lockedMaxBatch} from ${lockPath}`
      );
    }
  }

  const summary: SmokeSummary = {
    network: "shape-sepolia",
    roundAddress,
    chainId,
    phase,
    gen,
    maxGen,
    maxBatch,
    lockFile,
    lockMatch,
    lockedMaxBatch,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (import.meta.main) {
  main();
}
