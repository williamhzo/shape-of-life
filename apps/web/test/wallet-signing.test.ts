import { describe, expect, it } from "vitest";

import { buildWalletWriteRequest, normalizeWalletWriteError } from "../lib/wallet-signing";
import { computeCommitHash } from "../lib/round-tx";

describe("buildWalletWriteRequest", () => {
  it("builds commit write request with round-bound commit hash", () => {
    const request = buildWalletWriteRequest({
      action: "commit",
      chainId: 11011,
      account: "0x2222222222222222222222222222222222222222",
      roundAddress: "0x1111111111111111111111111111111111111111",
      draft: {
        action: "commit",
        roundId: "1",
        team: 0,
        slotIndex: 3,
        seedBits: 7n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        claimSlotIndex: "0",
      },
    });

    expect(request.functionName).toBe("commit");
    expect(request.args[0]).toBe(0);
    expect(request.args[1]).toBe(3);
    expect(request.args[2]).toBe(
      computeCommitHash({
        roundId: 1n,
        chainId: 11011n,
        arena: "0x1111111111111111111111111111111111111111",
        player: "0x2222222222222222222222222222222222222222",
        team: 0,
        slotIndex: 3,
        seedBits: 7n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
      }),
    );
  });

  it("builds reveal and claim requests with validated args", () => {
    const reveal = buildWalletWriteRequest({
      action: "reveal",
      chainId: 11011,
      account: "0x2222222222222222222222222222222222222222",
      roundAddress: "0x1111111111111111111111111111111111111111",
      draft: {
        action: "reveal",
        roundId: "9",
        team: 1,
        slotIndex: 44,
        seedBits: 255n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        claimSlotIndex: "0",
      },
    });
    expect(reveal.functionName).toBe("reveal");
    expect(reveal.args).toEqual([9n, 1, 44, 255n, "0x0000000000000000000000000000000000000000000000000000000000000001"]);

    const claim = buildWalletWriteRequest({
      action: "claim",
      chainId: 11011,
      account: "0x2222222222222222222222222222222222222222",
      roundAddress: "0x1111111111111111111111111111111111111111",
      draft: {
        action: "claim",
        roundId: "9",
        team: 1,
        slotIndex: 44,
        seedBits: 255n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        claimSlotIndex: "12",
      },
    });
    expect(claim.functionName).toBe("claim");
    expect(claim.args).toEqual([12]);
  });
});

describe("normalizeWalletWriteError", () => {
  it("maps user rejection and falls back to the best available message", () => {
    expect(normalizeWalletWriteError(new Error("User rejected the request."))).toBe("transaction rejected in wallet");
    expect(normalizeWalletWriteError({ shortMessage: "execution reverted: invalid slot" })).toBe("execution reverted: invalid slot");
    expect(normalizeWalletWriteError("plain failure")).toBe("plain failure");
  });
});
