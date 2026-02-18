# Shape of Life x EthSkills Checklist

Practical, repo-specific shipping checklist for Conway Arena on Shape L2 based on https://ethskills.com/.

Use this as the execution gate for new work and releases across:

- `packages/sim`
- `packages/contracts`
- `apps/web`
- `packages/indexer`

Canonical project context lives in `plan.md` and `architecture.md`.

## How To Use This Checklist

- Run top-to-bottom per change set (P0 -> P3).
- Do not skip a gate because a later gate passes.
- For core logic changes, enforce TDD (write failing test first).
- Mark checkboxes in your PR notes or release notes.

Sources:

- [EthSkills Ship](https://ethskills.com/ship/SKILL.md)
- [EthSkills Orchestration](https://ethskills.com/orchestration/SKILL.md)
- [Project Plan](./plan.md)
- [Project Architecture](./architecture.md)

---

## P0: Architecture and Scope Gate

- [ ] Confirm whether the change belongs onchain (ownership/transfers/commitments) or offchain (UI/indexing/analytics/replay metadata).
- [ ] Keep MVP contract surface minimal; avoid adding contracts unless strictly needed for trust boundaries.
- [ ] For every new state transition, answer: who calls it, why they call it, and what happens if nobody calls it.
- [ ] Preserve current invariants before coding:
  - deterministic TS/Solidity parity
  - no color overlap
  - accounting conservation
  - explicit phase/transition guards
- [ ] If scope changes behavior, update `plan.md` and any user-facing doc (`README.md`, `architecture.md`, `concept.md`) in the same change set.

Sources:

- [EthSkills Concepts](https://ethskills.com/concepts/SKILL.md)
- [EthSkills Ship](https://ethskills.com/ship/SKILL.md)
- [Project Plan](./plan.md)
- [Project Architecture](./architecture.md)

---

## P1: Contracts and Engine Correctness Gate

- [ ] Use OpenZeppelin battle-tested primitives for access control and guards where applicable.
- [ ] Keep commit/reveal domain separation intact (`chainId`, `arena`, `player`).
- [ ] Enforce transition guard matrix for all round phases (`Commit`, `Reveal`, `Sim`, `Claim`).
- [ ] Ensure `stepBatch` clamps by requested/maxBatch/maxGen remainder and cannot over-advance.
- [ ] Keep payout paths idempotent and bounded:
  - one-claim-only
  - zero-eligible routing behavior
  - keeper shortfall clamp
- [ ] Emit all required events for indexer and audit reconciliation.
- [ ] If integrating external protocols, use verified addresses only (never guessed addresses).

Sources:

- [EthSkills Security](https://ethskills.com/security/SKILL.md)
- [EthSkills Testing](https://ethskills.com/testing/SKILL.md)
- [EthSkills Addresses](https://ethskills.com/addresses/SKILL.md)
- [Project Plan (state/accounting)](./plan.md)
- [Project Architecture (contract surfaces)](./architecture.md)

---

## P1: Security Gate

- [ ] Token decimal handling is explicit (no blind `1e18` assumptions for arbitrary tokens).
- [ ] External calls follow checks-effects-interactions and reentrancy-safe patterns.
- [ ] Oracle reads are manipulation-resistant (no raw spot-price assumptions for high-stakes paths).
- [ ] Approvals are bounded (no unnecessary infinite approvals in user flows).
- [ ] Access control is explicit for privileged actions.
- [ ] All user inputs are validated (slot/team/budget/salt/phase guards).
- [ ] Accounting invariant holds: paid + dust <= funded.

Sources:

- [EthSkills Security](https://ethskills.com/security/SKILL.md)
- [OpenZeppelin Contracts Docs](https://docs.openzeppelin.com/contracts)
- [Project Architecture Invariants](./architecture.md)

---

## P1: Testing Gate (TDD + Regression)

- [ ] Add/adjust failing tests first for core behavior changes.
- [ ] `packages/sim`:
  - rule tests (B3/S23 + immigration)
  - packing/unpacking invertibility
  - topology boundary coverage
  - parity vectors and seeded fuzz
- [ ] `packages/contracts`:
  - lifecycle transition tests
  - accounting and claim safety tests
  - reentrancy/authorization edge cases
  - gas snapshot checks for critical methods
- [ ] `apps/web` deterministic logic tests in `lib/*` (no component-markup tests).
- [ ] `packages/indexer` reconciliation tests for event-derived state and accounting.
- [ ] Add regression tests for every bug fixed.

Validation commands:

- [ ] `bun run test`
- [ ] `bun run test:contracts:gas`
- [ ] `bun run lint:web`
- [ ] `cd apps/web && bun run build`

Sources:

- [EthSkills Testing](https://ethskills.com/testing/SKILL.md)
- [Project README Commands](./README.md)
- [Project Plan (Testing-first mandate)](./plan.md)

---

## P2: Frontend UX and Wallet Flow Gate

- [ ] One primary action at a time: connect -> switch network -> approve (if needed) -> execute.
- [ ] Every onchain action has isolated loading + disabled state until confirmation.
- [ ] Wallet rejection and revert errors are mapped to clear user feedback.
- [ ] Address rendering/input uses project-standard components and readable formatting.
- [ ] Amounts are human-readable and include USD context where applicable.
- [ ] No stale chain assumptions; Shape Sepolia gating remains explicit in wallet flows.
- [ ] Replay/live panels remain consistent with round phase and finalized state.

Sources:

- [EthSkills Frontend UX](https://ethskills.com/frontend-ux/SKILL.md)
- [EthSkills QA](https://ethskills.com/qa/SKILL.md)
- [Project Architecture (web flow)](./architecture.md)
- [Open Action P2.12](./plan.md)

---

## P2: Data and Indexing Gate

- [ ] Treat emitted events as the historical source of truth for read models.
- [ ] Ensure event schema remains indexer-friendly before changing contract events.
- [ ] Keep `packages/indexer` reconciliation green after event/state changes.
- [ ] For UI reads, batch current-state calls where possible; avoid inefficient polling patterns.
- [ ] Preserve deterministic replay artifact generation assumptions.

Sources:

- [EthSkills Indexing](https://ethskills.com/indexing/SKILL.md)
- [Project Architecture (read model/indexing)](./architecture.md)
- [Project Plan (Phase E/indexer)](./plan.md)

---

## P2: Sepolia Operations Gate

- [ ] Verify required env vars are present before operational scripts.
- [ ] Run benchmark lock flow before changing `maxBatch`.
- [ ] Run smoke and keeper observability scripts for deployed rounds.
- [ ] Keep deployment/verification artifacts reproducible and documented.
- [ ] Do not hardcode secrets; keep RPC keys and private keys out of committed files.

Validation commands:

- [ ] `SHAPE_SEPOLIA_RPC_URL=... ROUND_ADDRESS=... bun run benchmark:sepolia:max-batch`
- [ ] `bun run lock:sepolia:max-batch`
- [ ] `SHAPE_SEPOLIA_RPC_URL=... ROUND_ADDRESS=... bun run smoke:sepolia:round`
- [ ] `SHAPE_SEPOLIA_RPC_URL=... ROUND_ADDRESS=... bun run observe:sepolia:keeper`
- [ ] `SHAPE_SEPOLIA_RPC_URL=... ROUND_ADDRESS=... bun run release:gate:sepolia`

Sources:

- [EthSkills Orchestration](https://ethskills.com/orchestration/SKILL.md)
- [EthSkills Wallets (key safety)](https://ethskills.com/wallets/SKILL.md)
- [Project README (Sepolia commands)](./README.md)
- [Project Plan (operator checklist)](./plan.md)

---

## P3: Release and Post-Deploy Gate

- [ ] Explorer verification complete for latest deployed contracts.
- [ ] UI release build passes and metadata is production-safe.
- [ ] Keeper loop runbook and rollback/manual intervention path are documented.
- [ ] Monitoring path is clear (events, feeds, reconciliation checks).
- [ ] Any new risks discovered are added to `plan.md` with impact label (`P0`-`P3`).

Sources:

- [EthSkills Frontend Playbook](https://ethskills.com/frontend-playbook/SKILL.md)
- [EthSkills QA](https://ethskills.com/qa/SKILL.md)
- [Project Plan (readiness and risks)](./plan.md)
- [Keeper Runbook](./packages/contracts/docs/keeper-runbook.md)

---

## Reference Sources (Consolidated)

EthSkills:

- [Main Skill Index](https://ethskills.com/SKILL.md)
- [Ship](https://ethskills.com/ship/SKILL.md)
- [Concepts](https://ethskills.com/concepts/SKILL.md)
- [Security](https://ethskills.com/security/SKILL.md)
- [Testing](https://ethskills.com/testing/SKILL.md)
- [Indexing](https://ethskills.com/indexing/SKILL.md)
- [Frontend UX](https://ethskills.com/frontend-ux/SKILL.md)
- [Frontend Playbook](https://ethskills.com/frontend-playbook/SKILL.md)
- [QA](https://ethskills.com/qa/SKILL.md)
- [Wallets](https://ethskills.com/wallets/SKILL.md)
- [Orchestration](https://ethskills.com/orchestration/SKILL.md)
- [Addresses](https://ethskills.com/addresses/SKILL.md)

Project:

- [Spec and Plan](./plan.md)
- [Architecture](./architecture.md)
- [Gameplay Concept](./concept.md)
- [Repository Commands](./README.md)

Standards:

- [OpenZeppelin Docs](https://docs.openzeppelin.com/contracts)
- [Foundry Guides](https://www.getfoundry.sh/guides)
- [Hardhat Docs](https://hardhat.org/docs/getting-started)
- [Next.js Docs](https://nextjs.org/docs)
- [Turborepo Docs](https://turborepo.dev/docs)
