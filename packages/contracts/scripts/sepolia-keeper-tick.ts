import { execFileSync } from "node:child_process";
import type { KeeperAction } from "./sepolia-keeper-status";

type ParsedArgs = {
  execute: boolean;
};

type TickRecommendation = {
  action: KeeperAction;
  ready: boolean;
  recommendedSteps: number | null;
};

type KeeperStatus = {
  roundAddress: string;
  recommendation: TickRecommendation;
};

type TickSummary = {
  executeRequested: boolean;
  executable: boolean;
  executed: boolean;
  action: KeeperAction;
  ready: boolean;
  roundAddress: string;
  command: string | null;
  txOutput: string | null;
  reason: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  return {
    execute: argv.includes("--execute"),
  };
}

function loadKeeperStatus(): KeeperStatus {
  const output = execFileSync("bun", ["run", "packages/contracts/scripts/sepolia-keeper-status.ts"], {
    encoding: "utf8",
    env: process.env,
  });

  const parsed = JSON.parse(output) as Partial<KeeperStatus>;
  if (!parsed || typeof parsed !== "object" || !parsed.recommendation || typeof parsed.roundAddress !== "string") {
    throw new Error("invalid keeper status output");
  }
  if (!parsed.recommendation.action || typeof parsed.recommendation.ready !== "boolean") {
    throw new Error("invalid keeper recommendation payload");
  }

  return {
    roundAddress: parsed.roundAddress,
    recommendation: {
      action: parsed.recommendation.action,
      ready: parsed.recommendation.ready,
      recommendedSteps: parsed.recommendation.recommendedSteps ?? null,
    },
  };
}

export function buildKeeperSendArgs(
  roundAddress: string,
  recommendation: Pick<TickRecommendation, "action" | "recommendedSteps">
): string[] | null {
  if (recommendation.action === "begin-reveal") {
    return ["send", roundAddress, "beginReveal()"];
  }
  if (recommendation.action === "initialize") {
    return ["send", roundAddress, "initialize()"];
  }
  if (recommendation.action === "step-batch") {
    const steps = String(recommendation.recommendedSteps ?? 1);
    return ["send", roundAddress, "stepBatch(uint16)", steps];
  }
  if (recommendation.action === "finalize") {
    return ["send", roundAddress, "finalize()"];
  }

  return null;
}

function toCommandString(sendArgs: string[] | null): string | null {
  if (!sendArgs) {
    return null;
  }

  return `cast ${sendArgs.join(" ")} --private-key $KEEPER_PRIVATE_KEY --rpc-url $SHAPE_SEPOLIA_RPC_URL`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const keeperStatus = loadKeeperStatus();
  const sendArgs = buildKeeperSendArgs(keeperStatus.roundAddress, keeperStatus.recommendation);
  const command = toCommandString(sendArgs);

  const executable = keeperStatus.recommendation.ready && sendArgs !== null;
  if (!args.execute || !executable) {
    const summary: TickSummary = {
      executeRequested: args.execute,
      executable,
      executed: false,
      action: keeperStatus.recommendation.action,
      ready: keeperStatus.recommendation.ready,
      roundAddress: keeperStatus.roundAddress,
      command,
      txOutput: null,
      reason: executable
        ? "dry-run only; pass --execute to submit transaction"
        : "no executable keeper transition is currently recommended",
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return;
  }

  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  const rpcUrl = process.env.SHAPE_SEPOLIA_RPC_URL;
  if (!privateKey) {
    throw new Error("KEEPER_PRIVATE_KEY is required when --execute is used");
  }
  if (!rpcUrl) {
    throw new Error("SHAPE_SEPOLIA_RPC_URL is required when --execute is used");
  }

  const txOutput = execFileSync("cast", [...sendArgs!, "--private-key", privateKey, "--rpc-url", rpcUrl], {
    encoding: "utf8",
  }).trim();

  const summary: TickSummary = {
    executeRequested: true,
    executable: true,
    executed: true,
    action: keeperStatus.recommendation.action,
    ready: keeperStatus.recommendation.ready,
    roundAddress: keeperStatus.roundAddress,
    command,
    txOutput,
    reason: "submitted recommended keeper transition",
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (import.meta.main) {
  main();
}
