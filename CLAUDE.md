# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Conway Arena on Shape L2: a multiplayer competitive Conway's Game of Life with two-color immigration rules, commit/reveal rounds, and onchain parity verification. See `plan.md` for the full spec and progress tracking. See `architecture.md` for implemented vs planned surfaces. See `concept.md` for user-facing game rules.

## Commands

Turborepo orchestrates build/test/lint across all workspaces with caching.

```bash
# All tests (sim + web + indexer + contracts) -- parallel via turbo
bun run test

# Single-package tests via turbo filter
turbo test --filter=@shape-of-life/sim
turbo test --filter=@shape-of-life/web
turbo test --filter=@shape-of-life/indexer
turbo test --filter=@shape-of-life/contracts

# Single test file (bypass turbo, run directly)
bun test packages/sim/test/engine.test.ts
cd packages/contracts && forge test --offline --match-path test/ConwayArenaRoundE2E.t.sol

# Lint (strict, max-warnings=0)
bun run lint

# Solidity gas regression check against committed snapshot
bun run test:gas

# Dev server
bun run dev

# Production build
bun run build
```

Sepolia operations require env vars. See `plan.md` section 20.6 for the full checklist:

- `SHAPE_SEPOLIA_RPC_URL` -- Alchemy endpoint for Shape Sepolia (chainId 11011)
- `ROUND_ADDRESS` -- deployed ConwayArenaRound address
- `DEPLOYER_PRIVATE_KEY` -- for deployment/verification
- `KEEPER_PRIVATE_KEY` -- for keeper tick/loop `--execute` mode

## Architecture

Turborepo + Bun monorepo (`bun@1.3.6`) with four packages:

- **`packages/sim`** -- Canonical TypeScript simulation engine. Exports `stepGeneration`, `packRows`/`unpackRows`, `BoardState`. 64-bit bigint row representation, cylinder topology (Y wraps, X hard edges), B3/S23 with immigration majority color rule.

- **`packages/contracts`** -- Solidity parity engine (`ConwayEngine.sol`) + round lifecycle contract (`ConwayArenaRound.sol`). Foundry for tests/fuzzing/gas snapshots, Hardhat+Ignition for deployment/verification. Must produce identical simulation output to the TS engine.

- **`packages/indexer`** -- Chain-ingesting round read-model sync with viem. Persisted JSON snapshots, cursor/reorg-aware incremental sync, deterministic accounting reconciliation checks.

- **`apps/web`** -- Next.js 15 App Router (React 19, Tailwind 4, shadcn/ui new-york style). Spectator-first UI scaffold. wagmi + viem for wallet/tx lifecycle. Path alias `@/*` maps to the `apps/web` root. Tests use Vitest (configured in `apps/web/vitest.config.ts`), scoped to deterministic `lib/*` logic and API routes only -- no component-markup tests.

- **`fixtures/engine/parity.v1.json`** -- Golden test vectors. Both TS and Solidity test suites validate against these. This is the cross-language parity contract.

## Key Invariants

1. **Deterministic parity**: TS and Solidity engines must produce identical output for the same input. Fixture vectors and seeded fuzz tests enforce this.
2. **No color overlap**: `blueRows[y] & redRows[y] === 0n` for all rows, enforced on input and output.
3. **Width bounds**: [1, 64]. Row bits outside width are invalid.
4. **Cylinder topology**: vertical wrap `(y + dy + height) % height`, horizontal hard edges.
5. **Accounting conservation**: `winnerPaid + keeperPaid + treasuryDust <= totalFunded` always holds.

## Working Rules

- Source of truth for scope, sequencing, and progress: `plan.md`.
- Update `plan.md` checkboxes/status when tasks start or finish.
- Tests before implementation for non-trivial rules changes.
- One atomic, impact-ordered step at a time (P0 through P3).
- All `apps/web` UI components must derive from `apps/web/components/ui` (shadcn/ui registry).
- Prefer shadcn out-of-box styles/variants until final design pass.
- Web Vitest scope: API routes and deterministic `apps/web/lib/*` logic only. Validate UI behavior in live browser sessions.
- Contracts follow OpenZeppelin best practices (https://docs.openzeppelin.com/)
- ESLint uses flat config with `next/core-web-vitals` + `next/typescript` + `no-console` (warn/error allowed).

## Git and Delivery

- Use small atomic commits with concise imperative subjects (no conventional prefixes/scopes like `feat(scope):`).
- Commit highest-impact changes first.
- Push policy is user-instruction driven (direct `main` push is allowed).
