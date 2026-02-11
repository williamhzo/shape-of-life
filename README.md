# Shape of Life

Conway Arena on Shape L2. See `PLAN.md` for full product spec and phased implementation plan.

## Current Status
- Started Phase A engine foundation with strict TDD.
- Implemented first immediate testing action item:
  - pack/unpack tests
  - B3/S23 behavior test
  - Immigration majority-color birth test

## Workspace
- Runtime/package manager: Bun
- Package initialized:
  - `packages/sim` (TypeScript simulation engine primitives)

## Commands
- Run simulation tests:

```bash
bun test packages/sim/test
```

- Run all configured tests:

```bash
bun test
```
