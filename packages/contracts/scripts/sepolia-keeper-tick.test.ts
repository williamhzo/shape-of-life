import { describe, expect, test } from "bun:test";
import { buildKeeperSendArgs } from "./sepolia-keeper-tick";

describe("sepolia keeper tick utilities", () => {
  test("builds beginReveal invocation args", () => {
    expect(
      buildKeeperSendArgs("0x1111111111111111111111111111111111111111", {
        action: "begin-reveal",
        recommendedSteps: null,
      })
    ).toEqual(["send", "0x1111111111111111111111111111111111111111", "beginReveal()"]);
  });

  test("builds stepBatch invocation args using recommended steps", () => {
    expect(
      buildKeeperSendArgs("0x1111111111111111111111111111111111111111", {
        action: "step-batch",
        recommendedSteps: 12,
      })
    ).toEqual(["send", "0x1111111111111111111111111111111111111111", "stepBatch(uint16)", "12"]);
  });

  test("returns null for non-executable actions", () => {
    expect(
      buildKeeperSendArgs("0x1111111111111111111111111111111111111111", {
        action: "wait-commit",
        recommendedSteps: null,
      })
    ).toBeNull();
  });
});
