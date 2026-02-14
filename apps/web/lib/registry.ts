import { parseAbi } from "viem";

export const REGISTRY_ABI = parseAbi([
  "function currentRound() view returns (address)",
]);
