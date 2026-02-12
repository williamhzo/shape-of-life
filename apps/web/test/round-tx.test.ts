import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";

import {
  ROUND_ABI,
  buildClaimCalldata,
  buildCommitCalldata,
  buildRevealCalldata,
  computeCommitHash,
} from "../lib/round-tx";

describe("round tx payload helpers", () => {
  it("computes commit hash with round/chain/arena/player domain separation", () => {
    const hash = computeCommitHash({
      roundId: 42n,
      chainId: 11011n,
      arena: "0x1111111111111111111111111111111111111111",
      player: "0x2222222222222222222222222222222222222222",
      team: 1,
      slotIndex: 44,
      seedBits: 255n,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000123",
    });

    expect(hash).toBe("0xea8694d197cc644d958d67552b84fee5606657dca7cb7617c156fa24671fbd4e");
  });

  it("encodes commit/reveal/claim calldata with expected argument ordering", () => {
    const commitData = buildCommitCalldata({
      team: 1,
      slotIndex: 44,
      commitHash: "0xea8694d197cc644d958d67552b84fee5606657dca7cb7617c156fa24671fbd4e",
    });
    const revealData = buildRevealCalldata({
      roundId: 42n,
      team: 1,
      slotIndex: 44,
      seedBits: 255n,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000123",
    });
    const claimData = buildClaimCalldata({ slotIndex: 44 });

    const decodedCommit = decodeFunctionData({ abi: ROUND_ABI, data: commitData });
    expect(decodedCommit.functionName).toBe("commit");
    expect(decodedCommit.args).toEqual([1, 44, "0xea8694d197cc644d958d67552b84fee5606657dca7cb7617c156fa24671fbd4e"]);

    const decodedReveal = decodeFunctionData({ abi: ROUND_ABI, data: revealData });
    expect(decodedReveal.functionName).toBe("reveal");
    expect(decodedReveal.args).toEqual([
      42n,
      1,
      44,
      255n,
      "0x0000000000000000000000000000000000000000000000000000000000000123",
    ]);

    const decodedClaim = decodeFunctionData({ abi: ROUND_ABI, data: claimData });
    expect(decodedClaim.functionName).toBe("claim");
    expect(decodedClaim.args).toEqual([44]);
  });
});
