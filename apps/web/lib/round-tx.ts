import { encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, type Address, type Hex } from "viem";

export const ROUND_ABI = parseAbi([
  "function commit(uint8 team, uint8 slotIndex, bytes32 commitHash)",
  "function reveal(uint256 roundId, uint8 team, uint8 slotIndex, uint64 seedBits, bytes32 salt)",
  "function claim(uint8 slotIndex)",
]);

const COMMIT_HASH_PREIMAGE = [
  { name: "roundId", type: "uint256" },
  { name: "chainId", type: "uint256" },
  { name: "arena", type: "address" },
  { name: "player", type: "address" },
  { name: "team", type: "uint8" },
  { name: "slotIndex", type: "uint8" },
  { name: "seedBits", type: "uint64" },
  { name: "salt", type: "bytes32" },
] as const;

export type CommitHashInput = {
  roundId: bigint;
  chainId: bigint;
  arena: Address;
  player: Address;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: Hex;
};

export type BuildCommitCalldataInput = {
  team: number;
  slotIndex: number;
  commitHash: Hex;
};

export type BuildRevealCalldataInput = {
  roundId: bigint;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: Hex;
};

export type BuildClaimCalldataInput = {
  slotIndex: number;
};

export function computeCommitHash(input: CommitHashInput): Hex {
  const encoded = encodeAbiParameters(COMMIT_HASH_PREIMAGE, [
    input.roundId,
    input.chainId,
    input.arena,
    input.player,
    input.team,
    input.slotIndex,
    input.seedBits,
    input.salt,
  ]);

  return keccak256(encoded);
}

export function buildCommitCalldata(input: BuildCommitCalldataInput): Hex {
  return encodeFunctionData({
    abi: ROUND_ABI,
    functionName: "commit",
    args: [input.team, input.slotIndex, input.commitHash],
  });
}

export function buildRevealCalldata(input: BuildRevealCalldataInput): Hex {
  return encodeFunctionData({
    abi: ROUND_ABI,
    functionName: "reveal",
    args: [input.roundId, input.team, input.slotIndex, input.seedBits, input.salt],
  });
}

export function buildClaimCalldata(input: BuildClaimCalldataInput): Hex {
  return encodeFunctionData({
    abi: ROUND_ABI,
    functionName: "claim",
    args: [input.slotIndex],
  });
}
