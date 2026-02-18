# AGENTS.md

## Project Context

- Source of truth for scope and sequencing: `plan.md`.
- EthSkills-aligned delivery gate for implementation/release readiness: `ETHSKILLS_CHECKLIST.md`.

## Non-Negotiable Working Rules

1. Always implement one atomic, impact-ordered step at a time (`P0` to `P3`).
2. For non-trivial behavior changes, write or update tests before implementation only for core business logic/rules/state transitions/accounting paths; do not add frontend component-markup tests or UI-only assertion tests.
3. Keep interfaces simple, deterministic, and explicit.
4. Preserve domain separation/security invariants in all commit/reveal/accounting logic.
5. Follow official docs and modern best-practice guidance for the relevant stack area on most implementation work.
6. Run and satisfy relevant gates in `ETHSKILLS_CHECKLIST.md` for all feature/fix work before delivery.

## Standards and Best-Practice Baselines (Required)

- Contracts: follow OpenZeppelin best practices and security guidance (`https://docs.openzeppelin.com/`).
- Solidity tooling/tests: follow Foundry guides (`https://www.getfoundry.sh/guides`) and Hardhat docs (`https://hardhat.org/docs/getting-started`).
- Web app (Next.js): follow official Next.js docs and App Router guidance (`https://nextjs.org/docs`).
- Monorepo/task orchestration: follow Turborepo docs (`https://turborepo.dev/docs`).
- UI component system: use shadcn/ui components (`https://ui.shadcn.com/docs/components`) for `apps/web`.
- If guidance conflicts, prefer official docs for the exact tool/version in use; record rationale in `plan.md` when deviating.

## Web UI Baseline (Required)

- `apps/web` uses shadcn/ui as the canonical component source.
- All UI elements in `apps/web` must be derived from components in `apps/web/components/ui`.
- Components can be customized, but while the final visual system is being defined, prefer out-of-the-box shadcn styles and variants.

## Progress Tracking and Documentation Sync (Required)

1. Every feature/fix change must update progress tracking in `plan.md` in the same PR/commit series.
2. Keep docs current as code evolves:

- Update `plan.md` checkboxes/status when tasks start/finish.
- Update `README.md` when setup, scripts, or structure changes.
- Add or update design/spec notes when behavior or architecture changes.

3. If implementation reveals new work, append follow-ups to `plan.md` with impact label (`P0`/`P1`/`P2`/`P3`).
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
- For `apps/web`, keep Vitest coverage on API routes and deterministic business-rule logic in `lib/*` only.
- Do not add tests for UI copy/labels, visual status wording, badge variants, or presentational state-mapping that does not protect protocol/business correctness.
- Add a web test only when it enforces one of: domain rule validation, deterministic calldata/hash construction, state-transition guards, accounting/safety invariants, or regression for a previously observed core bug.
- Validate UI behavior in a real browser session (manual interaction), not via component-markup/unit snapshot tests.
- Minimum for simulation engine changes:
- Rule tests (B3/S23 + Immigration)
- Packing/unpacking tests
- Topology boundary tests
- Add regression tests for every core-logic bug fix.

## Git and Delivery

- Use small atomic commits with concise imperative subjects (no conventional prefixes/scopes like `feat(scope):`).
- Commit highest-impact changes first.
- Push policy is user-instruction driven (direct `main` push is allowed).
