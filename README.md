# Shape of Life

Conway Arena on Shape L2. See `PLAN.md` for full product spec and phased implementation plan.

## Current Status
- Started Phase A engine foundation with strict TDD.
- Implemented first two immediate testing action items:
  - pack/unpack tests
  - B3/S23 behavior test
  - Immigration majority-color birth test
  - TS golden/parity vectors + deterministic random-seed fuzz harness
  - Solidity parity vectors + deterministic seed fuzz tests

## Workspace
- Runtime/package manager: Bun
- Package initialized:
  - `packages/sim` (TypeScript simulation engine primitives)
  - `packages/contracts` (Foundry Solidity parity harness)
- Shared cross-implementation fixtures:
  - `fixtures/engine/parity.v1.json`

## Commands
- Run simulation tests:

```bash
bun test packages/sim/test
```

- Run all configured tests:

```bash
bun test
```

- Run Solidity parity tests (requires local solc install via Foundry):

```bash
cd packages/contracts && forge test
```
