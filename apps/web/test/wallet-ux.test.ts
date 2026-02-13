import { describe, expect, it } from "vitest";

import { isSlotIndexInTeamTerritory } from "../lib/wallet-ux";

describe("wallet UX helpers", () => {
  it("enforces team slot territories by tile column (left/right)", () => {
    expect(isSlotIndexInTeamTerritory(0, 0)).toBe(true);
    expect(isSlotIndexInTeamTerritory(0, 3)).toBe(true);
    expect(isSlotIndexInTeamTerritory(0, 4)).toBe(false);
    expect(isSlotIndexInTeamTerritory(0, 32)).toBe(true);

    expect(isSlotIndexInTeamTerritory(1, 3)).toBe(false);
    expect(isSlotIndexInTeamTerritory(1, 4)).toBe(true);
    expect(isSlotIndexInTeamTerritory(1, 7)).toBe(true);
    expect(isSlotIndexInTeamTerritory(1, 63)).toBe(true);
  });
});
