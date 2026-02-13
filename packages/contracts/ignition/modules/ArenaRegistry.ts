import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ArenaRegistryModule", (m) => {
  const registry = m.contract("ArenaRegistry", []);
  return { registry };
});
