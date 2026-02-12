export const ROUND_DEPLOYMENT_KEY = "ConwayArenaRoundModule#ConwayArenaRound";

export function parseDeploymentAddresses(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid ignition deployed addresses payload");
  }

  const addresses: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      addresses[key] = value;
    }
  }

  return addresses;
}

export function requireDeploymentAddress(
  deployedAddresses: Record<string, string>,
  key: string = ROUND_DEPLOYMENT_KEY
): string {
  const address = deployedAddresses[key];
  if (!address) {
    throw new Error(`missing ${key} in ignition deployed addresses`);
  }

  return address;
}
