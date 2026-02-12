import { describe, expect, test } from "bun:test";
import { ROUND_DEPLOYMENT_KEY, parseDeploymentAddresses, requireDeploymentAddress } from "./ignition-address";

describe("ignition deployment address utilities", () => {
  test("parses object payload into string-only map", () => {
    const addresses = parseDeploymentAddresses(
      JSON.stringify({
        [ROUND_DEPLOYMENT_KEY]: "0x1234",
        ignoredNumber: 123,
      })
    );

    expect(addresses[ROUND_DEPLOYMENT_KEY]).toBe("0x1234");
    expect(addresses.ignoredNumber).toBeUndefined();
  });

  test("throws when payload is not an object", () => {
    expect(() => parseDeploymentAddresses("[]")).toThrow("invalid ignition deployed addresses payload");
  });

  test("returns required deployment address", () => {
    const address = requireDeploymentAddress({ [ROUND_DEPLOYMENT_KEY]: "0xabc" });
    expect(address).toBe("0xabc");
  });

  test("throws when required deployment address is missing", () => {
    expect(() => requireDeploymentAddress({})).toThrow(`missing ${ROUND_DEPLOYMENT_KEY} in ignition deployed addresses`);
  });
});
