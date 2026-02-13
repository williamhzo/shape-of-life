import { describe, expect, test } from "bun:test";
import { buildTickCommandArgs, parsePositiveInt, shouldStopLoop } from "./sepolia-keeper-loop";

describe("sepolia keeper loop utilities", () => {
  test("parses positive integer args", () => {
    expect(parsePositiveInt("12", "--interval")).toBe(12);
  });

  test("rejects invalid integer args", () => {
    expect(() => parsePositiveInt("0", "--interval")).toThrow("must be a positive integer");
    expect(() => parsePositiveInt("abc", "--interval")).toThrow("must be a positive integer");
  });

  test("builds tick command args for dry-run", () => {
    expect(buildTickCommandArgs(false)).toEqual(["run", "tick:sepolia:keeper"]);
  });

  test("builds tick command args with execute flag", () => {
    expect(buildTickCommandArgs(true)).toEqual(["run", "tick:sepolia:keeper", "--execute"]);
  });

  test("stops loop when max iterations reached", () => {
    expect(
      shouldStopLoop({
        iteration: 3,
        maxIterations: 3,
        executed: false,
        execute: false,
        continueAfterExecute: false,
      })
    ).toBe(true);
  });

  test("stops loop after executed tick in execute mode by default", () => {
    expect(
      shouldStopLoop({
        iteration: 1,
        maxIterations: 0,
        executed: true,
        execute: true,
        continueAfterExecute: false,
      })
    ).toBe(true);
  });

  test("continues after executed tick when override is set", () => {
    expect(
      shouldStopLoop({
        iteration: 1,
        maxIterations: 0,
        executed: true,
        execute: true,
        continueAfterExecute: true,
      })
    ).toBe(false);
  });
});
