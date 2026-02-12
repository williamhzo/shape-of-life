import { describe, expect, it } from "vitest";

import { validateWalletSubmissionDraft } from "../lib/wallet-submit";

describe("validateWalletSubmissionDraft", () => {
  it("rejects slot selections outside team territory", () => {
    expect(() =>
      validateWalletSubmissionDraft({
        action: "commit",
        roundId: "1",
        team: 0,
        slotIndex: 40,
        seedBits: 3n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
        claimSlotIndex: "0",
      }),
    ).toThrow("outside selected team territory");
  });

  it("rejects seed patterns that exceed budget", () => {
    expect(() =>
      validateWalletSubmissionDraft({
        action: "reveal",
        roundId: "1",
        team: 1,
        slotIndex: 40,
        seedBits: (1n << 13n) - 1n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
        claimSlotIndex: "0",
      }),
    ).toThrow("seed budget exceeded");
  });

  it("rejects malformed salt", () => {
    expect(() =>
      validateWalletSubmissionDraft({
        action: "commit",
        roundId: "1",
        team: 0,
        slotIndex: 0,
        seedBits: 3n,
        salt: "0x1234",
        claimSlotIndex: "0",
      }),
    ).toThrow("salt must be 32-byte hex");
  });

  it("returns normalized numeric payload for claim action", () => {
    const validated = validateWalletSubmissionDraft({
      action: "claim",
      roundId: "9",
      team: 0,
      slotIndex: 3,
      seedBits: 0n,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
      claimSlotIndex: "63",
    });

    expect(validated.roundId).toBe(9n);
    expect(validated.claimSlotIndex).toBe(63);
    expect(validated.seedBits).toBe(0n);
  });
});
