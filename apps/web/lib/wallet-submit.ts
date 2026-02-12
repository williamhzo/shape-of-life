import { isSlotIndexInTeamTerritory, SEED_BUDGET, SLOT_COUNT, countLiveSeedCells } from "@/lib/wallet-ux";

export type WalletAction = "commit" | "reveal" | "claim";

export type WalletSubmissionDraft = {
  action: WalletAction;
  roundId: string;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: string;
  claimSlotIndex: string;
};

export type ValidatedWalletSubmission = {
  roundId: bigint;
  team: number;
  slotIndex: number;
  seedBits: bigint;
  salt: `0x${string}`;
  claimSlotIndex: number;
};

function parseUnsignedInteger(raw: string, label: string, max: bigint): bigint {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a decimal integer`);
  }

  const value = BigInt(trimmed);
  if (value > max) {
    throw new Error(`${label} exceeds max ${max}`);
  }

  return value;
}

function parseHex32(raw: string, label: string): `0x${string}` {
  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error(`${label} must be 32-byte hex (0x + 64 hex chars)`);
  }

  return trimmed as `0x${string}`;
}

export function validateWalletSubmissionDraft(draft: WalletSubmissionDraft): ValidatedWalletSubmission {
  const roundId = parseUnsignedInteger(draft.roundId, "roundId", (1n << 256n) - 1n);
  const seedBits = BigInt.asUintN(64, draft.seedBits);
  const salt = parseHex32(draft.salt, "salt");

  if (!isSlotIndexInTeamTerritory(draft.team, draft.slotIndex)) {
    throw new Error("selected slot is outside selected team territory");
  }

  const liveCells = countLiveSeedCells(seedBits);
  if (liveCells > SEED_BUDGET) {
    throw new Error(`seed budget exceeded (${liveCells}/${SEED_BUDGET})`);
  }

  const claimSlotIndex = Number(parseUnsignedInteger(draft.claimSlotIndex, "claimSlotIndex", BigInt(SLOT_COUNT - 1)));

  return {
    roundId,
    team: draft.team,
    slotIndex: draft.slotIndex,
    seedBits,
    salt,
    claimSlotIndex,
  };
}
