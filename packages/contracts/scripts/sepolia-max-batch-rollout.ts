import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROUND_DEPLOYMENT_KEY, parseDeploymentAddresses } from "./ignition-address";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_DEPLOYMENT_PATH = "packages/contracts/ignition/deployments/chain-11011/deployed_addresses.json";

type ParsedArgs = {
  round?: string;
  skipDeploy: boolean;
};

export type RoundAddressCandidates = {
  argRound?: string;
  envRound?: string;
  existingRound?: string | null;
};

export function normalizeRoundAddress(raw: string): string {
  const trimmed = raw.trim();
  if (!ADDRESS_PATTERN.test(trimmed)) {
    throw new Error(`invalid round address: ${raw}`);
  }

  return trimmed;
}

export function selectRoundAddress(candidates: RoundAddressCandidates): string | null {
  if (candidates.argRound) {
    return normalizeRoundAddress(candidates.argRound);
  }
  if (candidates.envRound) {
    return normalizeRoundAddress(candidates.envRound);
  }
  if (candidates.existingRound) {
    return normalizeRoundAddress(candidates.existingRound);
  }

  return null;
}

export function shouldDeployRound(roundAddress: string | null, skipDeploy: boolean): boolean {
  if (roundAddress) {
    return false;
  }
  if (skipDeploy) {
    throw new Error("round address is required when --skip-deploy is set");
  }

  return true;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { skipDeploy: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--skip-deploy") {
      parsed.skipDeploy = true;
      continue;
    }
    if (token !== "--round") {
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("missing value for --round");
    }
    parsed.round = value;
    index += 1;
  }

  return parsed;
}

function readExistingRoundAddress(deploymentPath: string = DEFAULT_DEPLOYMENT_PATH): string | null {
  const path = resolve(deploymentPath);
  if (!existsSync(path)) {
    return null;
  }

  const deployedAddresses = parseDeploymentAddresses(readFileSync(path, "utf8"));
  const candidate = deployedAddresses[ROUND_DEPLOYMENT_KEY];
  if (!candidate) {
    return null;
  }

  return normalizeRoundAddress(candidate);
}

function runBunScript(script: string, envOverrides: Record<string, string> = {}): void {
  const env = { ...process.env, ...envOverrides };
  process.stdout.write(`running bun run ${script}\n`);
  execFileSync("bun", ["run", script], { stdio: "inherit", env });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = process.env.SHAPE_SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("SHAPE_SEPOLIA_RPC_URL is required");
  }

  let roundAddress = selectRoundAddress({
    argRound: args.round,
    envRound: process.env.ROUND_ADDRESS,
    existingRound: readExistingRoundAddress(),
  });
  const deployRequired = shouldDeployRound(roundAddress, args.skipDeploy);
  let deployed = false;

  if (deployRequired) {
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
      throw new Error("DEPLOYER_PRIVATE_KEY is required when deployment is needed");
    }

    runBunScript("deploy:contracts:shape-sepolia");
    roundAddress = selectRoundAddress({ existingRound: readExistingRoundAddress() });
    if (!roundAddress) {
      throw new Error("deployment completed but round address could not be resolved");
    }
    deployed = true;
  }

  const commandEnv = {
    SHAPE_SEPOLIA_RPC_URL: rpcUrl,
    ROUND_ADDRESS: roundAddress!,
  };

  runBunScript("benchmark:sepolia:max-batch", commandEnv);
  runBunScript("lock:sepolia:max-batch", commandEnv);
  runBunScript("smoke:sepolia:round", commandEnv);

  process.stdout.write(
    JSON.stringify(
      {
        network: "shape-sepolia",
        roundAddress,
        deployed,
        benchmarkArtifact: "packages/contracts/benchmarks/sepolia-max-batch.latest.json",
        lockArtifact: "packages/contracts/benchmarks/sepolia-max-batch.lock.json",
      },
      null,
      2
    ) + "\n"
  );
}

if (import.meta.main) {
  main();
}
