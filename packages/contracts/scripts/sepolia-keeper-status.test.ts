import { describe, expect, test } from "bun:test";
import { parseCastBool, recommendKeeperAction } from "./sepolia-keeper-status";

describe("sepolia keeper status utilities", () => {
  test("parses cast bool outputs", () => {
    expect(parseCastBool("true\n")).toBe(true);
    expect(parseCastBool("false\n")).toBe(false);
    expect(parseCastBool("0x1")).toBe(true);
    expect(parseCastBool("0x0")).toBe(false);
    expect(parseCastBool("1")).toBe(true);
    expect(parseCastBool("0")).toBe(false);
  });

  test("rejects unsupported cast bool output", () => {
    expect(() => parseCastBool("maybe")).toThrow("unexpected cast bool output");
  });

  test("recommends waiting during commit window", () => {
    const recommendation = recommendKeeperAction({
      phase: 0,
      blockTimestamp: 100,
      commitEnd: 120,
      revealEnd: 0,
      gen: 0,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: false,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("wait-commit");
    expect(recommendation.ready).toBe(false);
  });

  test("recommends beginReveal after commit window closes", () => {
    const recommendation = recommendKeeperAction({
      phase: 0,
      blockTimestamp: 121,
      commitEnd: 120,
      revealEnd: 0,
      gen: 0,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: false,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("begin-reveal");
    expect(recommendation.ready).toBe(true);
  });

  test("recommends initialize after reveal window closes", () => {
    const recommendation = recommendKeeperAction({
      phase: 1,
      blockTimestamp: 200,
      commitEnd: 100,
      revealEnd: 150,
      gen: 0,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: false,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("initialize");
    expect(recommendation.ready).toBe(true);
  });

  test("recommends stepBatch with bounded step count while simulation is active", () => {
    const recommendation = recommendKeeperAction({
      phase: 2,
      blockTimestamp: 0,
      commitEnd: 0,
      revealEnd: 0,
      gen: 250,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: false,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("step-batch");
    expect(recommendation.ready).toBe(true);
    expect(recommendation.recommendedSteps).toBe(6);
  });

  test("recommends finalize when simulation is terminal", () => {
    const recommendation = recommendKeeperAction({
      phase: 2,
      blockTimestamp: 0,
      commitEnd: 0,
      revealEnd: 0,
      gen: 10,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: true,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("finalize");
    expect(recommendation.ready).toBe(true);
  });

  test("recommends claim in claim phase", () => {
    const recommendation = recommendKeeperAction({
      phase: 3,
      blockTimestamp: 0,
      commitEnd: 0,
      revealEnd: 0,
      gen: 256,
      maxGen: 256,
      maxBatch: 16,
      blueExtinct: false,
      redExtinct: false,
    });

    expect(recommendation.action).toBe("claim");
    expect(recommendation.ready).toBe(true);
    expect(recommendation.recommendedSteps).toBeNull();
  });
});
