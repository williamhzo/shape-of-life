# AGENTS.md

## Project Context

- Source of truth for scope and sequencing: `PLAN.md`.

## Non-Negotiable Working Rules

1. Always implement one atomic, impact-ordered step at a time (`P0` to `P3`).
2. Always write or update tests before implementation for non-trivial behavior changes.
3. Keep interfaces simple, deterministic, and explicit.
4. Preserve domain separation/security invariants in all commit/reveal/accounting logic.
5. Follow official docs and modern best-practice guidance for the relevant stack area on most implementation work.

## Standards and Best-Practice Baselines (Required)

- Contracts: follow OpenZeppelin best practices and security guidance (`https://docs.openzeppelin.com/`).
- Solidity tooling/tests: follow Foundry guides (`https://www.getfoundry.sh/guides`) and Hardhat docs (`https://hardhat.org/docs/getting-started`).
- Web app (Next.js): follow official Next.js docs and App Router guidance (`https://nextjs.org/docs`).
- Monorepo/task orchestration: follow Turborepo docs (`https://turborepo.dev/docs`).
- If guidance conflicts, prefer official docs for the exact tool/version in use; record rationale in `PLAN.md` when deviating.

## Progress Tracking and Documentation Sync (Required)

1. Every feature/fix change must update progress tracking in `PLAN.md` in the same PR/commit series.
2. Keep docs current as code evolves:

- Update `PLAN.md` checkboxes/status when tasks start/finish.
- Update `README.md` when setup, scripts, or structure changes.
- Add or update design/spec notes when behavior or architecture changes.

3. If implementation reveals new work, append follow-ups to `PLAN.md` with impact label (`P0`/`P1`/`P2`/`P3`).
4. Do not leave plan/docs stale after code changes.

## Repository Conventions

- Package manager/runtime: Bun.
- Workspace layout target:
- `apps/web`
- `packages/contracts`
- `packages/sim`
- `packages/indexer`
- Keep modules small and composable; avoid cross-package hidden coupling.

## Testing and Validation

- Run focused package tests while iterating; run aggregate tests before commit/push.
- Minimum for simulation engine changes:
- Rule tests (B3/S23 + Immigration)
- Packing/unpacking tests
- Topology boundary tests
- Add regression tests for every bug fix.

## Git and Delivery

- Use small atomic commits with conventional commit messages.
- Commit highest-impact changes first.
- Push policy is user-instruction driven (direct `main` push is allowed).
