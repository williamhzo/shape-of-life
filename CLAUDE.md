# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Conway Arena on Shape L2: a multiplayer competitive Conway's Game of Life with two-color immigration rules, commit/reveal rounds, and onchain parity verification. See `plan.md` for the full spec and progress tracking.

## Commands

```bash
# All TS tests (sim + web)
bun test

# Simulation engine tests only
bun test packages/sim/test

# Single sim test file
bun test packages/sim/test/engine.test.ts

# Web app tests only
bun test apps/web/test

# Lint (strict, max-warnings=0)
bun run lint

# Solidity parity tests (requires Foundry)
cd packages/contracts && forge test

# Dev server
cd apps/web && bun run dev

# Production build
cd apps/web && bun run build
```

## Architecture

Bun monorepo (`bun@1.3.6`) with three packages:

- **`packages/sim`** -- Canonical TypeScript simulation engine. Exports `stepGeneration`, `packRows`/`unpackRows`, `BoardState`. 64-bit bigint row representation, cylinder topology (Y wraps, X hard edges), B3/S23 with immigration majority color rule.

- **`packages/contracts`** -- Solidity parity implementation (`ConwayEngine.sol` library). Foundry-tested. Must produce identical output to the TS engine for all inputs.

- **`apps/web`** -- Next.js 15 App Router (React 19, Tailwind 4, shadcn/ui new-york style). Spectator-first UI scaffold. Path alias `@/*` maps to the `apps/web` root.

- **`fixtures/engine/parity.v1.json`** -- Golden test vectors. Both TS and Solidity test suites validate against these. This is the cross-language parity contract.

## Key Invariants

1. **Deterministic parity**: TS and Solidity engines must produce identical output for the same input. Fixture vectors and seeded fuzz tests enforce this.
2. **No color overlap**: `blueRows[y] & redRows[y] === 0n` for all rows, enforced on input and output.
3. **Width bounds**: [1, 64]. Row bits outside width are invalid.
4. **Cylinder topology**: vertical wrap `(y + dy + height) % height`, horizontal hard edges.

## Working Rules

- Source of truth for scope, sequencing, and progress: `plan.md`.
- Update `plan.md` checkboxes/status when tasks start or finish.
- Tests before implementation for non-trivial behavior changes.
- One atomic, impact-ordered step at a time (P0 through P3).
- All `apps/web` UI components must derive from `apps/web/components/ui` (shadcn/ui registry).
- Prefer shadcn out-of-box styles/variants until final design pass.
- Contracts follow OpenZeppelin best practices. Solidity 0.8.28, optimizer on (200 runs).
- ESLint uses flat config with `next/core-web-vitals` + `next/typescript` + `no-console` (warn/error allowed).
