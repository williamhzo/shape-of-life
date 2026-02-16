import { parseAbi, parseAbiItem } from "viem";

export const ROUND_STATE_ABI = parseAbi([
  "function phase() view returns (uint8)",
  "function gen() view returns (uint16)",
  "function maxGen() view returns (uint16)",
  "function maxBatch() view returns (uint16)",
  "function totalFunded() view returns (uint256)",
  "function winnerPaid() view returns (uint256)",
  "function keeperPaid() view returns (uint256)",
  "function treasuryDust() view returns (uint256)",
  "function winnerTeam() view returns (uint8)",
  "function scoreBlue() view returns (uint32)",
  "function scoreRed() view returns (uint32)",
  "function finalBluePopulation() view returns (uint16)",
  "function finalRedPopulation() view returns (uint16)",
  "function finalBlueInvasion() view returns (uint16)",
  "function finalRedInvasion() view returns (uint16)",
  "function payoutPerClaim() view returns (uint256)",
  "function blueExtinct() view returns (bool)",
  "function redExtinct() view returns (bool)",
]);

export const committedEvent = parseAbiItem(
  "event Committed(address player, uint8 team, uint8 slotIndex)",
);

export const revealedEvent = parseAbiItem(
  "event Revealed(address player, uint8 team, uint8 slotIndex)",
);

export const steppedEvent = parseAbiItem(
  "event Stepped(uint16 fromGen, uint16 toGen, address keeper, uint256 reward)",
);

export const playerClaimedEvent = parseAbiItem(
  "event PlayerClaimed(address player, uint8 slotIndex, uint256 amount)",
);

export const STATE_FN_NAMES = [
  "phase",
  "gen",
  "maxGen",
  "maxBatch",
  "totalFunded",
  "winnerPaid",
  "keeperPaid",
  "treasuryDust",
  "winnerTeam",
  "scoreBlue",
  "scoreRed",
  "finalBluePopulation",
  "finalRedPopulation",
  "finalBlueInvasion",
  "finalRedInvasion",
  "payoutPerClaim",
  "blueExtinct",
  "redExtinct",
] as const;
