import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";
import { parseDeploymentAddresses, requireDeploymentAddress } from "./ignition-address";

type SepoliaParameters = {
  ConwayArenaRoundModule: {
    commitDuration: number;
    revealDuration: number;
    maxGen: number;
    maxBatch: number;
  };
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function main(): Promise<void> {
  const parametersPath = resolve("ignition/parameters/shape-sepolia.json");
  const deploymentPath = resolve("ignition/deployments/chain-11011/deployed_addresses.json");

  const parameters = readJson<SepoliaParameters>(parametersPath);
  const deployedRaw = readFileSync(deploymentPath, "utf8");
  const deployedAddresses = parseDeploymentAddresses(deployedRaw);
  const roundAddress = requireDeploymentAddress(deployedAddresses);

  const constructorArguments = [
    parameters.ConwayArenaRoundModule.commitDuration,
    parameters.ConwayArenaRoundModule.revealDuration,
    parameters.ConwayArenaRoundModule.maxGen,
    parameters.ConwayArenaRoundModule.maxBatch,
  ];

  await hre.run("verify:verify", {
    address: roundAddress,
    constructorArguments,
  });

  process.stdout.write(`verified ConwayArenaRound at ${roundAddress}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
