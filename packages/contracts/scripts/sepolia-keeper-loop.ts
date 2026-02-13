import { execFileSync } from "node:child_process";

type LoopArgs = {
  execute: boolean;
  intervalSeconds: number;
  maxIterations: number;
  continueAfterExecute: boolean;
};

type TickSummary = {
  action: string;
  executable: boolean;
  executed: boolean;
  reason: string;
};

type LoopEvent = {
  iteration: number;
  timestamp: string;
  action: string;
  executable: boolean;
  executed: boolean;
  reason: string;
};

type StopDecisionInput = {
  iteration: number;
  maxIterations: number;
  executed: boolean;
  execute: boolean;
  continueAfterExecute: boolean;
};

export function parsePositiveInt(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

export function buildTickCommandArgs(execute: boolean): string[] {
  return execute ? ["run", "tick:sepolia:keeper", "--execute"] : ["run", "tick:sepolia:keeper"];
}

export function shouldStopLoop(input: StopDecisionInput): boolean {
  if (input.maxIterations > 0 && input.iteration >= input.maxIterations) {
    return true;
  }
  if (input.execute && input.executed && !input.continueAfterExecute) {
    return true;
  }

  return false;
}

function parseArgs(argv: string[]): LoopArgs {
  let execute = false;
  let intervalSeconds = 15;
  let maxIterations = 0;
  let continueAfterExecute = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--execute") {
      execute = true;
      continue;
    }
    if (token === "--continue-after-execute") {
      continueAfterExecute = true;
      continue;
    }

    if (token === "--interval" || token === "--iterations") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`missing value for ${token}`);
      }

      if (token === "--interval") {
        intervalSeconds = parsePositiveInt(value, "--interval");
      } else {
        maxIterations = parsePositiveInt(value, "--iterations");
      }

      index += 1;
    }
  }

  return {
    execute,
    intervalSeconds,
    maxIterations,
    continueAfterExecute,
  };
}

function parseTickSummary(raw: string): TickSummary {
  const parsed = JSON.parse(raw) as Partial<TickSummary>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid tick summary payload");
  }
  if (typeof parsed.action !== "string" || typeof parsed.reason !== "string") {
    throw new Error("invalid tick summary fields");
  }
  if (typeof parsed.executable !== "boolean" || typeof parsed.executed !== "boolean") {
    throw new Error("invalid tick summary boolean fields");
  }

  return {
    action: parsed.action,
    executable: parsed.executable,
    executed: parsed.executed,
    reason: parsed.reason,
  };
}

function runTick(execute: boolean): TickSummary {
  const output = execFileSync("bun", buildTickCommandArgs(execute), {
    encoding: "utf8",
    env: process.env,
  });

  return parseTickSummary(output);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  for (let iteration = 1; ; iteration += 1) {
    const tick = runTick(args.execute);
    const event: LoopEvent = {
      iteration,
      timestamp: new Date().toISOString(),
      action: tick.action,
      executable: tick.executable,
      executed: tick.executed,
      reason: tick.reason,
    };
    process.stdout.write(JSON.stringify(event) + "\n");

    if (
      shouldStopLoop({
        iteration,
        maxIterations: args.maxIterations,
        executed: tick.executed,
        execute: args.execute,
        continueAfterExecute: args.continueAfterExecute,
      })
    ) {
      return;
    }

    await sleep(args.intervalSeconds * 1000);
  }
}

if (import.meta.main) {
  await main();
}
