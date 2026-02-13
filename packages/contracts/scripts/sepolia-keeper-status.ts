import { execFileSync } from "node:child_process";
import { hasContractCode, parseCastUint } from "./sepolia-smoke-round";

export type KeeperAction =
  | "wait-commit"
  | "begin-reveal"
  | "wait-reveal"
  | "initialize"
  | "step-batch"
  | "finalize"
  | "claim";

export type KeeperRecommendation = {
  action: KeeperAction;
  ready: boolean;
  reason: string;
  recommendedSteps: number | null;
};

export type RoundSnapshot = {
  phase: number;
  blockTimestamp: number;
  commitEnd: number;
  revealEnd: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  blueExtinct: boolean;
  redExtinct: boolean;
};

type KeeperStatusSummary = {
  network: "shape-sepolia";
  roundAddress: string;
  chainId: number;
  phase: number;
  phaseLabel: string;
  blockTimestamp: number;
  commitEnd: number;
  revealEnd: number;
  gen: number;
  maxGen: number;
  maxBatch: number;
  blueExtinct: boolean;
  redExtinct: boolean;
  terminal: boolean;
  stepsRemaining: number;
  recommendation: KeeperRecommendation;
};

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

export function parseCastBool(raw: string): boolean {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1" || trimmed === "0x1") {
    return true;
  }
  if (trimmed === "false" || trimmed === "0" || trimmed === "0x0") {
    return false;
  }

  throw new Error(`unexpected cast bool output: ${raw}`);
}

export function phaseLabel(phase: number): string {
  if (phase === 0) {
    return "commit";
  }
  if (phase === 1) {
    return "reveal";
  }
  if (phase === 2) {
    return "sim";
  }
  if (phase === 3) {
    return "claim";
  }

  return "unknown";
}

export function isTerminal(snapshot: Pick<RoundSnapshot, "gen" | "maxGen" | "blueExtinct" | "redExtinct">): boolean {
  return snapshot.gen >= snapshot.maxGen || snapshot.blueExtinct || snapshot.redExtinct;
}

export function recommendKeeperAction(snapshot: RoundSnapshot): KeeperRecommendation {
  if (snapshot.phase === 0) {
    if (snapshot.blockTimestamp <= snapshot.commitEnd) {
      return {
        action: "wait-commit",
        ready: false,
        reason: "commit window is still open",
        recommendedSteps: null,
      };
    }

    return {
      action: "begin-reveal",
      ready: true,
      reason: "commit window has closed",
      recommendedSteps: null,
    };
  }

  if (snapshot.phase === 1) {
    if (snapshot.blockTimestamp <= snapshot.revealEnd) {
      return {
        action: "wait-reveal",
        ready: false,
        reason: "reveal window is still open",
        recommendedSteps: null,
      };
    }

    return {
      action: "initialize",
      ready: true,
      reason: "reveal window has closed",
      recommendedSteps: null,
    };
  }

  if (snapshot.phase === 2) {
    if (isTerminal(snapshot)) {
      return {
        action: "finalize",
        ready: true,
        reason: "round is terminal and can move to claim phase",
        recommendedSteps: null,
      };
    }

    const stepsRemaining = snapshot.maxGen - snapshot.gen;
    return {
      action: "step-batch",
      ready: true,
      reason: "simulation is active and not terminal",
      recommendedSteps: Math.min(snapshot.maxBatch, stepsRemaining),
    };
  }

  if (snapshot.phase === 3) {
    return {
      action: "claim",
      ready: true,
      reason: "round is finalized and claims are open",
      recommendedSteps: null,
    };
  }

  throw new Error(`unsupported phase ${snapshot.phase}`);
}

function cast(rpcUrl: string, args: string[]): string {
  return execFileSync("cast", [...args, "--rpc-url", rpcUrl], { encoding: "utf8" });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = args.rpc ?? process.env.SHAPE_SEPOLIA_RPC_URL;
  const roundAddress = args.round ?? process.env.ROUND_ADDRESS;

  if (!rpcUrl) {
    throw new Error("--rpc or SHAPE_SEPOLIA_RPC_URL is required");
  }
  if (!roundAddress) {
    throw new Error("--round or ROUND_ADDRESS is required");
  }

  const chainId = parseCastUint(cast(rpcUrl, ["chain-id"]));
  if (chainId !== 11011) {
    throw new Error(`unexpected chain id ${chainId}; expected 11011`);
  }

  const code = cast(rpcUrl, ["code", roundAddress]);
  if (!hasContractCode(code)) {
    throw new Error(`no bytecode found at ${roundAddress}`);
  }

  const blockTimestamp = parseCastUint(cast(rpcUrl, ["block", "latest", "--field", "timestamp"]));
  const phase = parseCastUint(cast(rpcUrl, ["call", roundAddress, "phase()(uint8)"]));
  const commitEnd = parseCastUint(cast(rpcUrl, ["call", roundAddress, "commitEnd()(uint64)"]));
  const revealEnd = parseCastUint(cast(rpcUrl, ["call", roundAddress, "revealEnd()(uint64)"]));
  const gen = parseCastUint(cast(rpcUrl, ["call", roundAddress, "gen()(uint16)"]));
  const maxGen = parseCastUint(cast(rpcUrl, ["call", roundAddress, "maxGen()(uint16)"]));
  const maxBatch = parseCastUint(cast(rpcUrl, ["call", roundAddress, "maxBatch()(uint16)"]));
  const blueExtinct = parseCastBool(cast(rpcUrl, ["call", roundAddress, "blueExtinct()(bool)"]));
  const redExtinct = parseCastBool(cast(rpcUrl, ["call", roundAddress, "redExtinct()(bool)"]));

  const snapshot: RoundSnapshot = {
    phase,
    blockTimestamp,
    commitEnd,
    revealEnd,
    gen,
    maxGen,
    maxBatch,
    blueExtinct,
    redExtinct,
  };
  const terminal = isTerminal(snapshot);
  const recommendation = recommendKeeperAction(snapshot);
  const summary: KeeperStatusSummary = {
    network: "shape-sepolia",
    roundAddress,
    chainId,
    phase,
    phaseLabel: phaseLabel(phase),
    blockTimestamp,
    commitEnd,
    revealEnd,
    gen,
    maxGen,
    maxBatch,
    blueExtinct,
    redExtinct,
    terminal,
    stepsRemaining: Math.max(0, maxGen - gen),
    recommendation,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (import.meta.main) {
  main();
}
