import { describe, expect, test } from "bun:test";
import { normalizeRoundAddress, selectRoundAddress, shouldDeployRound } from "./sepolia-max-batch-rollout";

describe("sepolia max batch rollout utilities", () => {
  test("normalizes valid round address output", () => {
    expect(normalizeRoundAddress(" 0x1111111111111111111111111111111111111111\n")).toBe(
      "0x1111111111111111111111111111111111111111"
    );
  });

  test("rejects invalid round address output", () => {
    expect(() => normalizeRoundAddress("not-an-address")).toThrow("invalid round address");
  });

  test("selects explicit arg round over env/existing", () => {
    const selected = selectRoundAddress({
      argRound: "0x2222222222222222222222222222222222222222",
      envRound: "0x3333333333333333333333333333333333333333",
      existingRound: "0x4444444444444444444444444444444444444444",
    });

    expect(selected).toBe("0x2222222222222222222222222222222222222222");
  });

  test("falls back to existing deployed address when arg/env are absent", () => {
    const selected = selectRoundAddress({
      existingRound: "0x5555555555555555555555555555555555555555",
    });

    expect(selected).toBe("0x5555555555555555555555555555555555555555");
  });

  test("requires round address when skip-deploy is enabled", () => {
    expect(() => shouldDeployRound(null, true)).toThrow("round address is required when --skip-deploy is set");
  });

  test("requires deployment when no round address is available", () => {
    expect(shouldDeployRound(null, false)).toBe(true);
    expect(shouldDeployRound("0x6666666666666666666666666666666666666666", false)).toBe(false);
  });
});
