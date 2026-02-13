import { describe, expect, it } from "vitest";

import { createTxFeedback, txBadgeVariant, type TxStage } from "../lib/wallet-tx-feedback";

describe("wallet tx feedback helpers", () => {
  it("builds deterministic lifecycle messages", () => {
    expect(createTxFeedback({ action: "commit", stage: "pending" }).message).toContain("Commit pending");
    expect(createTxFeedback({ action: "reveal", stage: "sign" }).message).toContain("Sign reveal");
    expect(createTxFeedback({ action: "claim", stage: "confirming", txHash: "0xabc" }).message).toContain("0xabc");
    expect(createTxFeedback({ action: "claim", stage: "success", blockNumber: 123n }).message).toContain("123");
    expect(createTxFeedback({ action: "commit", stage: "error", error: "reverted" }).message).toBe("reverted");
  });

  it("maps stages to stable badge variants", () => {
    const stages: TxStage[] = ["idle", "pending", "sign", "confirming", "error", "success"];
    const variants = stages.map((stage) => txBadgeVariant(stage));

    expect(variants).toEqual(["outline", "secondary", "secondary", "secondary", "destructive", "default"]);
  });
});
