import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDeploymentAddresses, requireDeploymentAddress } from "./ignition-address";

function main(): void {
  const deploymentPath = resolve("ignition/deployments/chain-11011/deployed_addresses.json");
  const deployedAddresses = parseDeploymentAddresses(readFileSync(deploymentPath, "utf8"));
  const roundAddress = requireDeploymentAddress(deployedAddresses);

  process.stdout.write(`${roundAddress}\n`);
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
