import { type SeedTransform, getSeedPresetById, applySeedTransform } from "@/lib/wallet-ux";
import { TEAM_BLUE, TEAM_RED, SLOT_COUNT } from "@/lib/round-rules";

export type SeedLinkParams = {
  preset?: string;
  seedBits?: bigint;
  transforms?: SeedTransform[];
  slot?: number;
  team?: number;
};

const TRANSFORM_SHORTHANDS: Record<string, SeedTransform> = {
  r90: "rotate-90",
  r180: "rotate-180",
  r270: "rotate-270",
  mx: "mirror-x",
  my: "mirror-y",
};

const TRANSFORM_TO_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(TRANSFORM_SHORTHANDS).map(([k, v]) => [v, k]),
);

export function encodeSeedLink(params: SeedLinkParams): string {
  const search = new URLSearchParams();

  if (params.preset) {
    search.set("preset", params.preset);
  } else if (params.seedBits !== undefined) {
    search.set("seed", params.seedBits.toString(16).padStart(16, "0"));
  }

  if (params.transforms && params.transforms.length > 0) {
    const shorts = params.transforms
      .filter((t) => t !== "translate")
      .map((t) => TRANSFORM_TO_SHORT[t] ?? t);
    if (shorts.length > 0) {
      search.set("t", shorts.join(","));
    }
  }

  if (params.slot !== undefined) {
    search.set("slot", String(params.slot));
  }

  if (params.team !== undefined) {
    search.set("team", params.team === TEAM_BLUE ? "blue" : "red");
  }

  return search.toString();
}

export function decodeSeedLink(searchParams: URLSearchParams): SeedLinkParams {
  const result: SeedLinkParams = {};

  const preset = searchParams.get("preset");
  if (preset && getSeedPresetById(preset)) {
    result.preset = preset;
  }

  const seed = searchParams.get("seed");
  if (!result.preset && seed && /^[0-9a-fA-F]{1,16}$/.test(seed)) {
    result.seedBits = BigInt.asUintN(64, BigInt(`0x${seed}`));
  }

  const t = searchParams.get("t");
  if (t) {
    const transforms: SeedTransform[] = [];
    for (const part of t.split(",")) {
      const trimmed = part.trim();
      const mapped = TRANSFORM_SHORTHANDS[trimmed];
      if (mapped) transforms.push(mapped);
    }
    if (transforms.length > 0) {
      result.transforms = transforms;
    }
  }

  const slot = searchParams.get("slot");
  if (slot !== null) {
    const parsed = parseInt(slot, 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < SLOT_COUNT) {
      result.slot = parsed;
    }
  }

  const team = searchParams.get("team");
  if (team === "blue") result.team = TEAM_BLUE;
  else if (team === "red") result.team = TEAM_RED;

  return result;
}

export function resolveSeedBits(params: SeedLinkParams): bigint | null {
  let seedBits: bigint | null = null;

  if (params.preset) {
    const preset = getSeedPresetById(params.preset);
    if (preset) seedBits = preset.seedBits;
  } else if (params.seedBits !== undefined) {
    seedBits = params.seedBits;
  }

  if (seedBits === null) return null;

  if (params.transforms) {
    for (const transform of params.transforms) {
      seedBits = applySeedTransform(seedBits, transform);
    }
  }

  return seedBits;
}
