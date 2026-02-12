import { describe, expect, test } from "bun:test";
import { hasContractCode, parseCastUint } from "./sepolia-smoke-round";

describe("sepolia smoke utilities", () => {
  test("parses decimal cast outputs", () => {
    expect(parseCastUint("11011\n")).toBe(11011);
  });

  test("parses hex cast outputs", () => {
    expect(parseCastUint("0x2b03")).toBe(11011);
  });

  test("rejects unsupported cast output", () => {
    expect(() => parseCastUint("not-a-number")).toThrow("unexpected cast numeric output");
  });

  test("recognizes contract code presence", () => {
    expect(hasContractCode("0x6001600055")).toBe(true);
    expect(hasContractCode("0x")).toBe(false);
    expect(hasContractCode("0x0")).toBe(false);
  });
});
