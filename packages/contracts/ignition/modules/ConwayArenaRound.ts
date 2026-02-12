import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ConwayArenaRoundModule", (m) => {
  const commitDuration = m.getParameter("commitDuration", 90);
  const revealDuration = m.getParameter("revealDuration", 60);
  const maxGen = m.getParameter("maxGen", 256);
  const maxBatch = m.getParameter("maxBatch", 16);

  const round = m.contract("ConwayArenaRound", [commitDuration, revealDuration, maxGen, maxBatch]);
  return { round };
});
