# Shape of Life Architecture

This document describes the architecture currently implemented in this repository and the near-term architecture defined in `plan.md`. It is intentionally split between **implemented now** and **planned next** to avoid spec drift.

## 1. System Overview

Shape of Life is a Bun monorepo with three active surfaces:

- `packages/sim`: TypeScript canonical simulation primitives and parity oracle.
- `packages/contracts`: Solidity engine parity + round-lifecycle guard implementation (Foundry-tested).
- `packages/indexer`: TypeScript reconciliation checks for accounting-critical round events.
  - Includes chain-ingesting round read-model sync tooling with persisted JSON snapshots.
- `apps/web`: Next.js App Router scaffold for spectator-facing UI and simple API routes.

Shared deterministic fixtures live in `fixtures/engine/parity.v1.json`.

## 2. Workspace Topology

### 2.1 Monorepo + Tooling

- Runtime/package manager: Bun (`packageManager: bun@1.3.6`).
- Workspaces: `apps/*`, `packages/*` (root `package.json`).
- Core test commands:
  - `bun test` (aggregate sim + web + indexer + contract-script + Solidity contract tests)
  - `bun test packages/sim/test`
  - `cd apps/web && bun run test`
  - `bun test packages/indexer/test`
  - `bun test packages/contracts/scripts/*.test.ts`
  - `cd packages/contracts && forge test --offline`
  - `bun run test:contracts:gas` (`forge snapshot --offline --match-test testGas --check`)
  - `bun run benchmark:sepolia:max-batch` (requires `SHAPE_SEPOLIA_RPC_URL` and deployed `ROUND_ADDRESS`)
  - `bun run observe:sepolia:keeper` (requires `SHAPE_SEPOLIA_RPC_URL` and deployed `ROUND_ADDRESS`)

### 2.2 Package Responsibilities

- `packages/sim`
  - `src/engine.ts`:
    - Board validation
    - 64-bit row packing/unpacking (`packRows`, `unpackRows`)
    - One-generation stepping (`stepGeneration`) for cylinder topology
  - `test/engine.test.ts`: unit tests for packing, B3/S23 behavior, immigration majority
  - `test/parity.test.ts`: fixture vectors + deterministic seeded fuzz parity vs reference implementation

- `packages/contracts`
  - `src/ConwayEngine.sol`:
    - Solidity parity engine for one generation
    - Invariant checks (`InvalidDimensions`, `InvalidRowsLength`, `OverlappingCells`)
  - `src/ConwayArenaRound.sol`:
    - Commit/reveal/sim/claim phase state machine with explicit phase and time-window guards
    - 64x64 board-state storage (`blueRows`, `redRows`) and final board-derived population/invasion snapshots
    - `initialize()` materializes revealed slot seed bits into deterministic board coordinates
    - `stepBatch()` advances board state by invoking `ConwayEngine.step` across bounded batches
    - `finalize()` derives board status and winner resolution at max generation from weighted score outputs (`3*population + 2*invasion`)
    - Step clamping semantics: `actualSteps = min(requestedSteps, maxBatch, maxGen - gen)`
    - Commit-domain separation primitive `hashCommit(roundId, chainId, arena, player, team, slotIndex, seedBits, salt)`
    - Accounting primitives for v0.1 payout safety:
      - keeper reward shortfall clamp
      - early accounting funding invariant check (`totalFunded <= address(this).balance`) at configuration time
      - keeper pull-withdraw credits (`withdrawKeeperCredit`) with no-credit guard
      - winner payout transfer allocation for winning/draw revealed slots via `claim(uint8)`
      - explicit non-reentrancy guard on transfer paths (`claim`, `withdrawKeeperCredit`)
      - manual settlement disabled for accounting rounds to avoid claim-path griefing
      - finalize-time zero-eligible winner pool routing to treasury dust
      - finalize-time keeper remainder rollover into winner pool
      - claim-settlement dust routing and invariant-traceable counters
  - `test/ConwayEngineParity.t.sol`:
    - Fixed vectors mirroring fixture semantics
    - Deterministic seeded fuzz parity against Solidity in-test reference engine
  - `test/ConwayArenaRoundStateMachine.t.sol`:
    - Transition matrix tests for allowed/disallowed round calls
    - Explicit custom-error selector assertions for guard failures
  - `test/ConwayArenaRoundAccounting.t.sol`:
    - Keeper shortfall + over-requested step reward clamp tests
    - Accounting invariant and dust-routing tests
  - `test/ConwayArenaRoundE2E.t.sol`:
    - Local lifecycle integration test from commit through claim with end-state accounting reconciliation
  - `test/ConwayArenaRoundGas.t.sol`:
    - Stable gas checkpoints for `commit`, `reveal`, `stepBatch`, `finalize`, and `claim`
  - `test/ConwayArenaRoundCommitHash.t.sol`:
    - Domain-separation tests for commit preimage hashing (`chainId`, `arena`, `player`)
  - `scripts/max-batch-benchmark.ts`:
    - Uses `cast estimate` against Shape Sepolia to measure `stepBatch(uint16)` gas across candidate step sizes
    - Selects a lock recommendation using configurable gas-limit headroom (`safetyBps`)
    - Writes reproducible benchmark artifact JSON for review/plan sync
  - `scripts/lock-max-batch-from-benchmark.ts`:
    - Applies measured `lockedMaxBatch` from benchmark artifacts to `ignition/parameters/shape-sepolia.json`
    - Emits a lock summary artifact for release/audit traceability
  - `scripts/sepolia-max-batch-rollout.ts`:
    - One-command rollout pipeline for Sepolia `maxBatch` lock (`deploy/address-resolve -> benchmark -> lock -> smoke`)
    - Supports explicit `--round` pinning or `--skip-deploy` fail-fast behavior when no round address is available
  - `scripts/sepolia-smoke-round.ts`:
    - Cast-based Sepolia smoke checks (chain id, contract bytecode presence, key round state reads)
    - Optional enforcement that deployed `maxBatch` matches the committed lock artifact
  - `scripts/sepolia-keeper-status.ts`:
    - Cast-based keeper observability summary for Sepolia rounds
    - Produces deterministic next-action recommendation (`begin-reveal`, `initialize`, `step-batch`, `finalize`, `claim`) from current phase/timing/terminal state
    - Emits `recommendedCommand` for actionable keeper transitions to reduce manual operator mistakes
  - `scripts/sepolia-keeper-tick.ts`:
    - One-shot keeper automation command that consumes observability output and can submit the recommended transition with `--execute`
    - Dry-run mode reports whether a transition is currently executable without sending a transaction
  - `scripts/sepolia-keeper-loop.ts`:
    - Recurring keeper automation loop over `tick:sepolia:keeper` with configurable interval/iteration limits
    - Supports execute mode with default stop on first submitted transition
  - `docs/keeper-runbook.md`:
    - Operator playbook for transition calls, smoke/observe cadence, and failure-mode response on Sepolia
  - `hardhat.config.ts`:
    - viem-first Hardhat 3 scaffold using `@nomicfoundation/hardhat-toolbox-viem`
    - Shape Sepolia/Mainnet deterministic network wiring from env (`SHAPE_SEPOLIA_RPC_URL`, `SHAPE_MAINNET_RPC_URL`, `DEPLOYER_PRIVATE_KEY`)
    - optional custom-chain verify endpoint wiring for Shape explorers
  - `ignition/modules/ConwayArenaRound.ts` + `ignition/parameters/shape-sepolia.json`:
    - deterministic constructor-parameterized deployment module for `ConwayArenaRound`
  - `scripts/verify-shape-sepolia.ts` + `scripts/show-shape-sepolia-round.ts`:
    - deployment-address extraction from Ignition artifacts
    - constructor-argument-aware verification entrypoint for latest Shape Sepolia deployment

- `apps/web`
  - `app/page.tsx`: spectator dashboard with wallet journey panel + live round polling panel
  - `app/layout.tsx` + `app/providers.tsx`: wagmi SSR cookie hydration and client provider wiring (`WagmiProvider` + `QueryClientProvider`)
  - `app/api/health/route.ts`: health endpoint contract
  - `app/api/round/live/route.ts`: server route that reads persisted indexer model and returns normalized live spectator payload
  - `components/round-live-panel.tsx`: client polling UI for live round state (`/api/round/live`)
  - `components/round-wallet-panel.tsx`: wagmi-based signup flow + browser-wallet commit/reveal/claim journey
    - Includes connect/disconnect actions, Shape Sepolia chain-gating, team-aware slot picker, 8x8 seed editor with presets/transforms + budget meter, and explicit tx lifecycle state feedback (`pending`, `sign`, `confirming`, `error`, `success`)
  - `lib/board-summary.ts`: board population accounting + overlap/width invariants
  - `lib/wagmi-config.ts`: Shape Sepolia chain/config transport setup for wagmi
  - `lib/wallet-onboarding.ts`: deterministic signup-state gating helper for connect/switch/ready transitions
  - `lib/wallet-ux.ts`: deterministic seed editing primitives, presets, and transforms (rotate/mirror/translate)
  - `lib/wallet-signing.ts`: deterministic tx-write request and error-normalization helpers for commit/reveal/claim
  - `lib/wallet-tx-feedback.ts`: deterministic tx lifecycle messaging + badge-state mapping for UI status rendering
  - `lib/round-live.ts`: persisted read-model parsing + normalization for API responses
  - `lib/round-tx.ts`: commit-hash + tx-calldata builders for round contract calls
  - `test/*.test.ts`: route contract + board summary tests
    - includes wallet onboarding state-transition tests
    - includes wallet seed transform/preset tests
    - includes wallet tx lifecycle feedback-state tests
    - includes wallet write-request/error mapping tests
    - includes wallet failure-path validation tests and route consistency checks for spectator-read-model status
  - UI baseline from shadcn registry under `apps/web/components/ui`

- `packages/indexer`
  - `src/ingest-round-read-model.ts`:
    - viem-backed chain ingestion adapter for `Stepped`, `Finalized`, and `Claimed` logs
    - onchain state reads (`phase`, `gen`, `maxGen`, `maxBatch`, accounting counters)
    - deterministic read-model builder with finalize-aware reconciliation status
  - `src/round-read-model-store.ts`:
    - Stable BigInt-safe JSON serialization/parsing for persisted read models
    - File read/write helpers for indexer snapshot artifacts
  - `src/sync-round-read-model.ts`:
    - CLI entrypoint for RPC-backed sync (`--rpc`, `--round`, optional block bounds, output path)
    - confirmation-depth filtering and resumable cursor windowing (`--confirmations`, `--reorg-lookback`)
    - overlap reprocessing for reorg-safe event replacement before merge
  - `src/reconcile-round-events.ts`:
    - Deterministic event-stream reconciliation over `Stepped`, `Finalized`, and `Claimed` payloads
    - Enforces keeper-reward consistency (`sum(stepped.reward) == finalized.keeperPaid`)
    - Produces accounting invariant checks (`winnerPaid + keeperPaid + treasuryDust <= totalFunded`)
  - `test/ingest-round-read-model.test.ts`:
    - Read-model construction, pending-finalize behavior, reconciliation divergence failure checks
  - `test/reconcile-round-events.test.ts`:
    - Happy-path reconciliation assertions
    - Divergence and missing-event failure checks

## 3. Domain and Data Model

### 3.1 Board Representation

Canonical board representation used by the TS engine:

- `width: number` (1..64 currently supported by engine code)
- `height: number` (>0)
- `blueRows: bigint[]`
- `redRows: bigint[]`

Each row is treated as 64-bit (`BigInt.asUintN(64, ...)`), with occupancy bit `1 << x`.

### 3.2 Color State Model

- Dead
- Alive Blue
- Alive Red

Invariant: `blueRows[y] & redRows[y] == 0` for all rows.

### 3.3 Fixture Contract

`fixtures/engine/parity.v1.json` defines deterministic golden vectors:

- `version: "v1"`
- `topology: "cylinder"`
- case list with `input`, `steps`, and expected outputs

Both TS and Solidity tests encode these same semantics, making fixtures the cross-language parity contract.

## 4. Execution Paths

### 4.1 Simulation Execution (TS)

1. Validate dimensions and row array lengths.
2. For each cell, count neighbors with:
   - Y wrapping (cylinder vertical wrap)
   - X hard edges (no horizontal wrap)
3. Apply B3/S23 and immigration majority.
4. Mask rows to board width.
5. Assert no overlap in output state.

### 4.2 Parity Verification (TS <-> Solidity)

- TS parity suite checks:
  - Golden vectors from fixture
  - Deterministic seeded random corpus vs TS reference implementation
- Solidity parity suite checks:
  - Fixed vectors equivalent to fixture cases
  - Deterministic seeded random corpus vs Solidity reference implementation

Current architecture guarantees rule parity confidence at engine level and now includes a minimal round manager with guard, commit/reveal payload validation, slot-claim ownership/idempotency checks, and accounting primitives.

### 4.3 Web Read Model

- `GET /api/health` returns process liveness payload.
- `summarizeBoard()` computes blue/red/total populations and validates board invariants for UI/accounting display.
- `GET /api/round/live` reads the persisted indexer round snapshot and normalizes bigint-heavy payloads for client consumption.
- Landing page now renders:
  - live spectator panel (polling `/api/round/live`)
  - wagmi-backed wallet journey panel with signup gating and `simulate -> sign -> receipt` tx flow
  - local preview board summary card.

## 5. Planned Architecture (From plan.md, Not Fully Implemented Yet)

The plan defines eventual expansion to:

- `ConwayArena` round-state machine contract (commit/reveal/sim/claim).
- Optional NFT artifact contract.
- `packages/indexer` for event-driven read models.
- Keeper bot for permissionless stepping liveness.
- Hardhat deployment + verification scripts.

Status snapshot:

- Implemented: Phase A engine prototype base, web bootstrap slice, Solidity engine parity harness, simulation-backed round progression (seed materialization + board stepping), transition guard matrix, commit/reveal slot payload guards, claim idempotency guards, keeper withdrawal transfer plumbing, winner payout transfer allocation, accounting invariants (including mixed claim ordering), local round E2E, gas regression CI, and a Hardhat+Ignition deployment/verification scaffold for Shape Sepolia.
- Pending/high impact next: execute Sepolia benchmark run with deployment metadata, then lock `maxBatch` from measured artifact.

## 6. Architectural Invariants

The current implementation assumes and tests these invariants:

- Determinism: same input state + steps => same output state.
- Disjoint colors: blue/red overlap is invalid input and forbidden output.
- Topology consistency: cylinder semantics must match in TS and Solidity.
- Lifecycle guard correctness: round calls must be phase-valid and respect commit/reveal windows.
- Commit/reveal binding: slot reservations are team-territory constrained, reveal is slot-owner bound, and reveal preimage must match committed hash.
- Claim idempotency: only revealed slot owners can execute `claim(uint8)` and each slot can be claimed at most once.
- Keeper payout safety: keeper rewards accrue in credits and are withdrawn via pull transfer with zero-credit rejection.
- Winner payout determinism: payouts are equal-share across eligible revealed slots (winning team or both teams on draw), with integer dust routed to treasury.
- Settlement safety: accounting rounds reject manual `settleWinnerClaims` calls so transfer-based claim distribution cannot be griefed.
- Funding safety: accounting configuration fails early when configured funding exceeds current contract native balance.
- Accounting safety: `winnerPaid + keeperPaid + treasuryDust` must never exceed `totalFunded`.
- Width safety: no bits outside configured width are accepted in web summary logic.

## 7. Known Gaps and Failure Modes

Current gaps relative to full plan:

- Accounting is currently a primitive slice (native transfers only; no ERC20 payout path).
- Non-reveal forfeits and zero-eligible payout routing are still covered mostly by accounting-path tests rather than full slot-level adversarial flows.
- Keeper bot and browser-automation end-to-end tests (real UI interaction harness) are not yet implemented.

Primary near-term risk: documentation or UI assumptions diverging from actual engine semantics; parity fixtures and mirrored tests are the current mitigation.
