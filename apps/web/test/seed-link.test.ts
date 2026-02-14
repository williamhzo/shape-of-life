import { describe, expect, it } from "vitest";

import {
  encodeSeedLink,
  decodeSeedLink,
  resolveSeedBits,
  type SeedLinkParams,
} from "../lib/seed-link";
import { TEAM_BLUE, TEAM_RED } from "../lib/round-rules";
import { getSeedPresetById, applySeedTransform } from "../lib/seed";

describe("encodeSeedLink", () => {
  it("encodes a preset with team and slot", () => {
    const qs = encodeSeedLink({ preset: "acorn", team: TEAM_BLUE, slot: 12 });
    const params = new URLSearchParams(qs);
    expect(params.get("preset")).toBe("acorn");
    expect(params.get("team")).toBe("blue");
    expect(params.get("slot")).toBe("12");
  });

  it("encodes raw seedBits as hex when no preset", () => {
    const qs = encodeSeedLink({ seedBits: 0xABCDn });
    const params = new URLSearchParams(qs);
    expect(params.get("seed")).toBe("000000000000abcd");
    expect(params.has("preset")).toBe(false);
  });

  it("encodes transforms as shorthands", () => {
    const qs = encodeSeedLink({
      preset: "glider",
      transforms: ["rotate-90", "mirror-x"],
    });
    const params = new URLSearchParams(qs);
    expect(params.get("t")).toBe("r90,mx");
  });

  it("prefers preset over seedBits", () => {
    const qs = encodeSeedLink({ preset: "glider", seedBits: 0xFFn });
    const params = new URLSearchParams(qs);
    expect(params.get("preset")).toBe("glider");
    expect(params.has("seed")).toBe(false);
  });

  it("omits empty fields", () => {
    const qs = encodeSeedLink({});
    expect(qs).toBe("");
  });

  it("encodes red team", () => {
    const qs = encodeSeedLink({ preset: "blinker", team: TEAM_RED });
    const params = new URLSearchParams(qs);
    expect(params.get("team")).toBe("red");
  });
});

describe("decodeSeedLink", () => {
  it("round-trips a preset link", () => {
    const original: SeedLinkParams = {
      preset: "acorn",
      transforms: ["rotate-90", "mirror-x"],
      slot: 5,
      team: TEAM_RED,
    };
    const qs = encodeSeedLink(original);
    const decoded = decodeSeedLink(new URLSearchParams(qs));
    expect(decoded.preset).toBe("acorn");
    expect(decoded.transforms).toEqual(["rotate-90", "mirror-x"]);
    expect(decoded.slot).toBe(5);
    expect(decoded.team).toBe(TEAM_RED);
  });

  it("round-trips a raw seed link", () => {
    const original: SeedLinkParams = { seedBits: 0x1234n, slot: 0 };
    const qs = encodeSeedLink(original);
    const decoded = decodeSeedLink(new URLSearchParams(qs));
    expect(decoded.seedBits).toBe(0x1234n);
    expect(decoded.slot).toBe(0);
  });

  it("ignores unknown preset IDs", () => {
    const decoded = decodeSeedLink(new URLSearchParams("preset=nonexistent"));
    expect(decoded.preset).toBeUndefined();
  });

  it("ignores out-of-range slot", () => {
    const decoded = decodeSeedLink(new URLSearchParams("slot=999"));
    expect(decoded.slot).toBeUndefined();
  });

  it("ignores invalid hex seed", () => {
    const decoded = decodeSeedLink(new URLSearchParams("seed=gggg"));
    expect(decoded.seedBits).toBeUndefined();
  });

  it("ignores unknown transforms", () => {
    const decoded = decodeSeedLink(new URLSearchParams("t=r90,unknown,mx"));
    expect(decoded.transforms).toEqual(["rotate-90", "mirror-x"]);
  });
});

describe("resolveSeedBits", () => {
  it("resolves preset to seedBits", () => {
    const bits = resolveSeedBits({ preset: "glider" });
    const expected = getSeedPresetById("glider")!.seedBits;
    expect(bits).toBe(expected);
  });

  it("applies transforms to preset", () => {
    const bits = resolveSeedBits({ preset: "glider", transforms: ["rotate-90"] });
    const expected = applySeedTransform(getSeedPresetById("glider")!.seedBits, "rotate-90");
    expect(bits).toBe(expected);
  });

  it("resolves raw seedBits", () => {
    const bits = resolveSeedBits({ seedBits: 0xABn });
    expect(bits).toBe(0xABn);
  });

  it("returns null for empty params", () => {
    expect(resolveSeedBits({})).toBeNull();
  });

  it("returns null for unknown preset", () => {
    expect(resolveSeedBits({ preset: "nonexistent" })).toBeNull();
  });
});
