# Shape of Life Architecture

This document describes the architecture currently implemented in this repository and the near-term architecture defined in `plan.md`. It is intentionally split between **implemented now** and **planned next** to avoid spec drift.

## 1. System Overview

Shape of Life is a Bun monorepo with four active surfaces:

- `packages/sim`: TypeScript canonical simulation primitives and parity oracle.
- `packages/contracts`: Solidity engine parity + round-lifecycle guard implementation (Foundry-tested).
- `packages/indexer`: TypeScript reconciliation checks for accounting-critical round events.
  - Includes chain-ingesting round read-model sync tooling with persisted JSON snapshots.
- `apps/web`: Next.js App Router scaffold for spectator-facing UI and simple API routes.

Shared deterministic fixtures live in `fixtures/engine/parity.v1.json`.

Additional docs:
- `concept.md`: user-facing game rules and Conway's Game of Life concept explainer (non-technical).
- `plan.md`: full v0.1 spec, implementation plan, progress log, and readiness checklist.

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
  - `src/ArenaRegistry.sol`:
    - Owner-managed registry storing `currentRound`, `pastRounds[]`, and `seasonMetadataHash`
    - Functions: `setCurrentRound`, `setSeasonMetadataHash`, `transferOwnership`, `pastRoundCount`, `allPastRounds`
    - Events: `CurrentRoundUpdated`, `SeasonMetadataHashUpdated`
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
  - `test/ConwayArenaRoundCommitReveal.t.sol`:
    - Slot reservation, territory enforcement, reveal ownership, preimage verification, seed budget
  - `test/ConwayArenaRoundSimulation.t.sol`:
    - Seed materialization, board stepping, population tracking, weighted winner resolution
  - `test/ConwayArenaRoundWinnerPayout.t.sol`:
    - Winner team claim distribution, draw split, non-winner zero-payout
  - `test/ConwayArenaRoundEvents.t.sol`:
    - Event emission for Committed, Revealed, Initialized, Stepped, Finalized, PlayerClaimed
  - `test/ConwayArenaRoundReentrancy.t.sol`:
    - Reentrancy guard against claim/withdrawKeeperCredit cross-function attack
  - `test/ConwayArenaRoundClaimSafety.t.sol`:
    - Double-claim prevention, owner verification, revealed slot requirement
  - `test/ConwayArenaRoundKeeperWithdraw.t.sol`:
    - Keeper credit withdrawal, insufficient credit error
  - `test/ConwayArenaRoundCommitHash.t.sol`:
    - Domain-separation tests for commit preimage hashing (`chainId`, `arena`, `player`)
  - `test/ArenaRegistry.t.sol`:
    - Round registration, ownership, past round archival, metadata hash, access control
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
  - `ignition/modules/ConwayArenaRound.ts` + `ignition/modules/ArenaRegistry.ts` + `ignition/parameters/shape-sepolia.json`:
    - deterministic constructor-parameterized deployment modules for `ConwayArenaRound` and `ArenaRegistry`
  - `scripts/verify-shape-sepolia.ts` + `scripts/show-shape-sepolia-round.ts`:
    - deployment-address extraction from Ignition artifacts
    - constructor-argument-aware verification entrypoint for latest Shape Sepolia deployment

- `apps/web`
  - `app/page.tsx`: spectator dashboard rendering `RoundDashboard` with live polling, participant/keeper feeds, board canvas, and end screen
  - `app/replay/page.tsx`: replay route accepting seed-link query params (`?preset=acorn&t=r90,mx&slot=5&team=blue`) or falling back to demo board, with quick-replay preset links
  - `app/layout.tsx` + `app/providers.tsx`: wagmi SSR cookie hydration and client provider wiring (`WagmiProvider` + `QueryClientProvider`)
  - `app/api/health/route.ts`: health endpoint contract
  - `app/api/round/live/route.ts`: server route that reads persisted indexer model and returns normalized live spectator payload with participant roster and keeper leaderboard
  - `components/round-dashboard.tsx`: orchestrator component owning poll state and distributing data to live panel, wallet panel, participant list, keeper feed, board canvas, and end card
  - `components/round-live-panel.tsx`: client polling UI for live round state (`/api/round/live`) with freshness badge
  - `components/round-wallet-panel.tsx`: wagmi-based signup flow + browser-wallet commit/reveal/claim journey
    - Includes connect/disconnect actions, Shape Sepolia chain-gating, team-aware slot picker, 8x8 seed editor with presets/transforms + budget meter, and explicit tx lifecycle state feedback (`pending`, `sign`, `confirming`, `error`, `success`)
  - `components/round-end-card.tsx`: end screen with winner announcement, scoring breakdown, payout summary, and claim button integrating claim eligibility logic
  - `components/board-canvas.tsx`: `<canvas>` with `ImageData` for 64x64 board at 8px scale; three render modes (demo with blinker+acorn, live with onchain checkpoint sync, final static) with play/pause/reset/FPS controls and replay link
  - `components/replay-canvas.tsx`: replay viewer with timeline scrubber (shadcn Slider), signature-moment jump buttons (peak, lead-change, extinction), play/pause/reset/FPS controls
  - `components/participant-list.tsx`: scrollable table with player address, team badge, slot, lifecycle status, payout
  - `components/keeper-feed.tsx`: ranked table with keeper address, step count, gens advanced, cumulative reward
  - `hooks/use-round-live.ts`: polls `/api/round/live` every 5s with error state
  - `hooks/use-board-state.ts`: calls contract `getBoardState()` when phase 2/3, caches by generation
  - `lib/board-summary.ts`: board population accounting + overlap/width invariants
  - `lib/board-renderer.ts`: pure `renderBoardPixels()` converting `BoardState` bigint rows to scaled RGBA pixel array
  - `lib/board-animation.ts`: forward-simulation animation controller with pause/maxGen/extinction guards
  - `lib/board-fetch.ts`: contract row conversion to `BoardState` with validation
  - `lib/wagmi-config.ts`: Shape Sepolia chain/config transport setup for wagmi
  - `lib/wallet-onboarding.ts`: deterministic signup-state gating helper for connect/switch/ready transitions
  - `lib/seed.ts`: deterministic seed editing primitives, 8 presets (glider through LWSS), and transforms (rotate/mirror/translate)
  - `lib/seed-link.ts`: URL-based seed link encoding/decoding with preset ID, transforms (shorthand notation), slot index, and team suggestion
  - `lib/seed-contribution.ts`: offchain seed survival simulation, per-seed territory and population tracking at final gen
  - `lib/wallet-signing.ts`: deterministic tx-write request and error-normalization helpers for commit/reveal/claim
  - `lib/wallet-submit.ts`: commit/reveal/claim input validation (territory, budget, salt format)
  - `lib/wallet-tx-feedback.ts`: tx lifecycle messaging + badge-state mapping for UI status rendering
  - `lib/round-rules.ts`: game constants (team IDs, slot counts, seed budget, scoring weights, territory validation)
  - `lib/round-live.ts`: persisted read-model parsing + normalization for API responses with participant/keeper feed construction
  - `lib/round-end.ts`: winner announcement, claim eligibility, payout summary derivation from finalized round state
  - `lib/round-feeds.ts`: participant roster builder from committed/revealed/claimed events, keeper leaderboard aggregation from stepped events
  - `lib/round-tx.ts`: commit-hash + tx-calldata builders for round contract calls
  - `lib/replay.ts`: pre-computes full replay timeline from initial board state with signature moment detection (peak-population, lead-change, mass-extinction, board-empty)
  - `test/*.test.ts`: 17 test files covering all deterministic lib logic and API routes
    - includes board renderer, animation, and fetch tests
    - includes seed transform/preset, seed-link encode/decode, and seed-contribution tests
    - includes wallet onboarding, signing, and submit validation tests
    - includes round rules, round-tx, round-end, round-feeds, and round-live tests
    - includes replay timeline and signature moment tests
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
  - `test/round-sync.test.ts`:
    - Incremental log merge with previous read model, deterministic ordering, reorg-safe overlap replacement
  - `test/sync-window.test.ts`:
    - Cursor window derivation, confirmation-depth clamping, explicit block bound overrides

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
- `GET /api/round/live` reads the persisted indexer round snapshot and normalizes bigint-heavy payloads for client consumption, including participant roster and keeper leaderboard.
- Landing page renders via `RoundDashboard`:
  - live spectator panel (polling `/api/round/live`) with freshness badge
  - wagmi-backed wallet journey panel with signup gating and `simulate -> sign -> receipt` tx flow
  - 64x64 board canvas with local TS forward-simulation between onchain checkpoints (demo/live/final modes)
  - participant list and keeper feed tables
  - end screen card with winner announcement, scoring, and claim button
- Replay page (`/replay`) renders:
  - seed-link-driven or demo board replay with full timeline scrubber
  - signature moment detection and jump buttons (peak, lead-change, extinction)

## 5. Planned Architecture (From plan.md, Not Fully Implemented Yet)

The plan defines eventual expansion to:

- Optional NFT artifact contract (`RoundArtifactNFT`).
- Shape-native features: Gasback registration/treasury loop, Stack medal integrations, VRF tiebreaks.
- Browser-automation end-to-end tests (real UI interaction harness).

Status snapshot:

- Implemented: TS engine with full parity suite, Solidity engine + round lifecycle contract (commit/reveal/sim/claim with accounting), ArenaRegistry for round discovery, chain-ingesting indexer with reorg-safe sync, full spectator UI (board canvas, participant/keeper feeds, end screen, replay page with seed links), keeper automation tooling (status/tick/loop), and Hardhat+Ignition deployment scaffold.
- Pending/high impact next: execute Sepolia benchmark run with deployment metadata, then lock `maxBatch` from measured artifact (blocked on env/deployment inputs).

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

## 8. Architecture Diagrams

### 8.1 System Architecture Overview

High-level monorepo topology: packages, their responsibilities, and cross-package dependencies.

```mermaid
graph TB
    subgraph "Bun Monorepo (bun@1.3.6)"
        subgraph "apps/web [Next.js 15 / React 19]"
            WEB_PAGES["Pages<br/>/ (spectator dashboard)<br/>/replay (seed replay)"]
            WEB_API["API Routes<br/>GET /api/health<br/>GET /api/round/live"]
            WEB_COMPONENTS["Components<br/>RoundDashboard<br/>BoardCanvas / ReplayCanvas<br/>RoundWalletPanel<br/>RoundLivePanel / RoundEndCard<br/>ParticipantList / KeeperFeed"]
            WEB_LIB["Lib (deterministic logic)<br/>board-renderer / board-animation<br/>seed / seed-link / replay<br/>round-tx / round-live / round-end<br/>wallet-onboarding / wallet-signing<br/>wallet-submit / wallet-tx-feedback"]
            WEB_HOOKS["Hooks<br/>useRoundLive (5s poll)<br/>useBoardState (contract read)"]
        end

        subgraph "packages/sim [TS Engine]"
            SIM_ENGINE["engine.ts<br/>stepGeneration()<br/>packRows() / unpackRows()<br/>BoardState type"]
        end

        subgraph "packages/contracts [Solidity + Foundry + Hardhat]"
            SOL_ENGINE["ConwayEngine.sol<br/>(library: step, pack/unpack, popcount)"]
            SOL_ROUND["ConwayArenaRound.sol<br/>(state machine + accounting)"]
            SOL_REGISTRY["ArenaRegistry.sol<br/>(round discovery)"]
            IGNITION["Ignition Modules<br/>+ shape-sepolia.json params"]
            SCRIPTS["Keeper Scripts<br/>status / tick / loop<br/>benchmark / smoke / rollout"]
        end

        subgraph "packages/indexer [TS Indexer]"
            IDX_INGEST["ingest-round-read-model.ts<br/>(viem log fetcher + state reader)"]
            IDX_RECONCILE["reconcile-round-events.ts<br/>(accounting invariant checks)"]
            IDX_SYNC["sync-round-read-model.ts<br/>(CLI: cursor + reorg-safe)"]
            IDX_STORE["round-read-model-store.ts<br/>(BigInt-safe JSON persistence)"]
        end

        FIXTURES["fixtures/engine/parity.v1.json<br/>(cross-language golden vectors)"]
    end

    SIM_ENGINE -->|"imported by"| WEB_LIB
    SIM_ENGINE -.->|"parity contract"| FIXTURES
    SOL_ENGINE -.->|"parity contract"| FIXTURES
    SOL_ENGINE -->|"used by"| SOL_ROUND
    IDX_INGEST -->|"reads events from"| SOL_ROUND
    IDX_INGEST -->|"reads state from"| SOL_ROUND
    IDX_STORE -->|"persisted JSON"| WEB_API
    WEB_API -->|"serves"| WEB_HOOKS
    WEB_HOOKS -->|"feeds"| WEB_COMPONENTS
    WEB_LIB -->|"used by"| WEB_COMPONENTS
    IGNITION -->|"deploys"| SOL_ROUND
    IGNITION -->|"deploys"| SOL_REGISTRY
    SCRIPTS -->|"calls via cast"| SOL_ROUND
```

### 8.2 Round Lifecycle State Machine

The 4-phase state machine governing every round, with transition guards and actor permissions.

```mermaid
stateDiagram-v2
    [*] --> Commit: createRound() [owner]

    Commit --> Reveal: beginReveal() [anyone, after commitEnd]
    Commit --> Commit: commit(team, slot, hash) [player, before commitEnd]

    Reveal --> Reveal: reveal(roundId, team, slot, seedBits, salt) [committed player, before revealEnd]
    Reveal --> Sim: initialize() [anyone, after revealEnd]

    Sim --> Sim: stepBatch(steps) [anyone/keeper, gen < maxGen]
    Sim --> Claim: finalize() [anyone, gen==maxGen OR team extinct]

    Claim --> Claim: claim(slotIndex) [revealed slot owner, once per slot]
    Claim --> [*]: all claims settled

    note right of Commit
        Guards: valid team/slot territory,
        empty slot, one slot per address,
        before commitEnd timestamp
    end note

    note right of Reveal
        Guards: caller == committed player,
        preimage matches commitHash,
        seedBits popcount <= 12 (budget),
        not already revealed
    end note

    note right of Sim
        actualSteps = min(requested, maxBatch, maxGen - gen)
        Keeper reward = actualSteps * rewardPerGen
        clamped to keeperPoolRemaining
    end note

    note right of Claim
        nonReentrant guard,
        pull-payment pattern,
        dust routed to treasury
    end note
```

### 8.3 Player Journey

End-to-end user experience from spectating to claiming rewards.

```mermaid
flowchart TD
    START([Spectator visits /]) --> WATCH[Watch live board canvas<br/>See participant list + keeper feed]
    WATCH --> DECIDE{Join round?}
    DECIDE -->|No| WATCH

    DECIDE -->|Yes| CONNECT[Connect wallet via wagmi<br/>Injected connector]
    CONNECT --> CHAIN_CHECK{On Shape Sepolia?}
    CHAIN_CHECK -->|No| SWITCH[Switch network prompt]
    SWITCH --> CHAIN_CHECK
    CHAIN_CHECK -->|Yes| READY[Wallet ready]

    READY --> PICK_TEAM[Choose Blue or Red team]
    PICK_TEAM --> PICK_SLOT[Pick slot from<br/>team territory grid<br/>Blue: tileX 0-3<br/>Red: tileX 4-7]
    PICK_SLOT --> EDIT_SEED[8x8 seed editor<br/>Presets: Glider, R-pentomino, Acorn...<br/>Transforms: rotate/mirror/translate<br/>Budget meter: max 12 live cells]
    EDIT_SEED --> GEN_SALT[Generate random salt<br/>client-side]

    GEN_SALT --> COMMIT_TX[Submit commit tx<br/>commitHash = keccak256(<br/>  roundId, chainId, arena,<br/>  player, team, slot, seedBits, salt)]
    COMMIT_TX --> TX_FLOW_1[simulate -> sign -> confirm]
    TX_FLOW_1 --> WAIT_REVEAL[Wait for reveal phase]

    WAIT_REVEAL --> REVEAL_TX[Submit reveal tx<br/>reveal(roundId, team, slot, seedBits, salt)]
    REVEAL_TX --> TX_FLOW_2[simulate -> sign -> confirm]
    TX_FLOW_2 --> SPECTATE[Watch simulation unfold<br/>Board canvas: live mode<br/>Local TS forward-sim<br/>between onchain checkpoints]

    SPECTATE --> END_SCREEN[End screen appears<br/>Winner, scores, payout summary]
    END_SCREEN --> ELIGIBLE{Eligible to claim?}
    ELIGIBLE -->|Winner or Draw| CLAIM_TX[Submit claim tx]
    ELIGIBLE -->|Lost| REPLAY[View replay with<br/>signature moments]
    CLAIM_TX --> TX_FLOW_3[simulate -> sign -> confirm]
    TX_FLOW_3 --> REPLAY

    REPLAY --> SHARE[Share seed link<br/>?preset=acorn&t=r90,mx&slot=5&team=blue]
```

### 8.4 Data Flow: Onchain to UI

How data flows from Shape L2 contract state through the indexer to the browser.

```mermaid
flowchart LR
    subgraph "Shape L2 (Sepolia / Mainnet)"
        CONTRACT["ConwayArenaRound<br/>contract state"]
        EVENTS["Contract Events<br/>Committed, Revealed,<br/>Initialized, Stepped,<br/>Finalized, PlayerClaimed"]
    end

    subgraph "Indexer (packages/indexer)"
        VIEM_CLIENT["viem publicClient<br/>(Alchemy RPC)"]
        INGEST["buildRoundReadModel()<br/>parallel: readState + getLogs"]
        RECONCILE["reconcileRoundEvents()<br/>keeper-reward consistency<br/>accounting invariant check"]
        STORE["JSON snapshot file<br/>round-read-model.latest.json<br/>(BigInt-safe serialization)"]
        CURSOR["Cursor file<br/>round-read-model.cursor.json<br/>(resumable sync window)"]
    end

    subgraph "Web Server (Next.js)"
        API_LIVE["GET /api/round/live<br/>reads persisted snapshot<br/>normalizes bigint payloads<br/>builds participant roster<br/>builds keeper leaderboard"]
    end

    subgraph "Browser (React 19)"
        POLL_HOOK["useRoundLive()<br/>polls /api/round/live<br/>every 5 seconds"]
        BOARD_HOOK["useBoardState()<br/>direct contract read<br/>getBoardState() view<br/>cached by generation"]
        DASHBOARD["RoundDashboard<br/>(owns poll state,<br/>distributes to children)"]
        CANVAS["BoardCanvas<br/>onchain checkpoint +<br/>local TS forward-sim<br/>between checkpoints"]
    end

    CONTRACT -->|"state reads"| VIEM_CLIENT
    EVENTS -->|"log queries"| VIEM_CLIENT
    VIEM_CLIENT --> INGEST
    INGEST --> RECONCILE
    RECONCILE --> STORE
    INGEST --> CURSOR

    STORE -->|"file read"| API_LIVE
    API_LIVE -->|"JSON response"| POLL_HOOK
    POLL_HOOK --> DASHBOARD
    CONTRACT -->|"direct RPC read<br/>(wagmi publicClient)"| BOARD_HOOK
    BOARD_HOOK --> CANVAS
    DASHBOARD --> CANVAS
```

### 8.5 Board Representation and Rendering Pipeline

How board state is represented, packed for storage, and rendered to pixels.

```mermaid
flowchart TD
    subgraph "Canonical Board (TS: BoardState)"
        TS_BOARD["width: 64, height: 64<br/>blueRows: bigint[64]<br/>redRows: bigint[64]<br/>Each row: 64-bit, bit x = (1n << BigInt(x))"]
    end

    subgraph "Onchain Storage (Solidity)"
        PACKED["uint256[16] bluePacked<br/>uint256[16] redPacked<br/>(4 rows per word: 4 x 64 = 256 bits)"]
        MEMORY["In-memory stepping:<br/>uint64[64] blueRows<br/>uint64[64] redRows"]
    end

    subgraph "Stepping (one generation)"
        STEP_ALGO["For each cell (x, y):<br/>1. Count 8 Moore neighbors<br/>   Y: cylinder wrap (mod height)<br/>   X: hard edges (out-of-bounds = dead)<br/>2. B3/S23 rule:<br/>   dead + 3 neighbors = born<br/>   alive + 2-3 neighbors = survive<br/>3. Immigration color rule:<br/>   survivor keeps color<br/>   newborn = majority color of 3 parents<br/>4. Mask to width, assert no overlap"]
    end

    subgraph "Board Rendering (browser)"
        FETCH["contractRowsToBoardState()<br/>convert uint64[] to bigint[]<br/>with validation"]
        RENDER["renderBoardPixels(board, scale=8)<br/>For each cell (x, y):<br/>  test bit: (row >> BigInt(x)) & 1n<br/>  Blue: #3B82F6<br/>  Red: #EF4444<br/>  Dead: #1A1A2E<br/>Output: Uint8ClampedArray RGBA"]
        CANVAS_EL["canvas 512x512<br/>ImageData + putImageData<br/>(64x64 board at 8px scale)"]
        ANIMATION["createAnimationState()<br/>stepAnimation()<br/>uses stepGeneration() from sim<br/>pause / maxGen / extinction guards"]
    end

    TS_BOARD -->|"stepGeneration()"| STEP_ALGO
    STEP_ALGO -->|"new BoardState"| TS_BOARD

    PACKED -->|"unpackRows()"| MEMORY
    MEMORY -->|"ConwayEngine.step()"| MEMORY
    MEMORY -->|"packRows()"| PACKED

    PACKED -->|"getBoardState() view"| FETCH
    FETCH --> RENDER
    RENDER --> CANVAS_EL
    TS_BOARD -->|"local forward-sim"| ANIMATION
    ANIMATION --> RENDER
```

### 8.6 Wallet Transaction Pipeline

The full tx signing flow from draft to confirmation.

```mermaid
sequenceDiagram
    participant User as Player (Browser)
    participant WO as wallet-onboarding
    participant WS as wallet-submit
    participant WSig as wallet-signing
    participant TxFb as wallet-tx-feedback
    participant Wagmi as wagmi/viem
    participant Chain as Shape L2 (RPC)

    User->>WO: deriveWalletOnboardingState()
    WO-->>User: stage: missing-round / connect / switch / ready

    Note over User: canSubmitTx = true when ready

    User->>WS: validateWalletSubmissionDraft()
    WS-->>User: validated draft (territory, budget, salt checks)

    User->>WSig: buildWalletWriteRequest(action, draft)
    Note over WSig: commit: compute commitHash (domain-separated)<br/>reveal: pass through preimage<br/>claim: slot index only
    WSig-->>User: WalletWriteRequest {abi, address, functionName, args}

    User->>TxFb: createTxFeedback({action, stage: "pending"})
    TxFb-->>User: "Commit pending. Validating and simulating..."

    User->>Wagmi: simulateContract(writeRequest)
    Wagmi->>Chain: eth_call (simulation)
    Chain-->>Wagmi: success / revert
    Wagmi-->>User: simulation result

    User->>TxFb: createTxFeedback({action, stage: "sign"})
    TxFb-->>User: "Sign commit transaction in wallet."

    User->>Wagmi: writeContract(writeRequest)
    Note over Wagmi: wallet popup for signature
    Wagmi-->>User: txHash

    User->>TxFb: createTxFeedback({action, stage: "confirming", txHash})
    TxFb-->>User: "Commit submitted (0xabc123...), waiting..."

    User->>Wagmi: waitForTransactionReceipt(txHash)
    Wagmi->>Chain: poll for receipt
    Chain-->>Wagmi: receipt {blockNumber}
    Wagmi-->>User: confirmed

    User->>TxFb: createTxFeedback({action, stage: "success", blockNumber})
    TxFb-->>User: "Commit success. Confirmed in block 12345."
```

### 8.7 Keeper Automation Loop

How keepers advance the simulation from commit through finalize.

```mermaid
flowchart TD
    subgraph "Keeper Toolchain"
        STATUS["sepolia-keeper-status.ts<br/>Reads: phase, timestamps,<br/>gen, maxGen, extinction flags<br/>Outputs: KeeperRecommendation"]
        TICK["sepolia-keeper-tick.ts<br/>Loads status output<br/>Builds cast send args<br/>--execute flag for live tx"]
        LOOP["sepolia-keeper-loop.ts<br/>Recurring ticks<br/>configurable interval/iterations<br/>stops on first submitted tx"]
    end

    subgraph "Recommendation Engine"
        R_COMMIT["Phase 0 (Commit)<br/>action: wait-commit<br/>ready: false"]
        R_REVEAL["Phase 0, after commitEnd<br/>action: begin-reveal<br/>ready: true"]
        R_WAIT_REVEAL["Phase 1 (Reveal)<br/>action: wait-reveal<br/>ready: false"]
        R_INIT["Phase 1, after revealEnd<br/>action: initialize<br/>ready: true"]
        R_STEP["Phase 2 (Sim), gen < maxGen<br/>action: step-batch<br/>ready: true<br/>recommendedSteps: maxBatch"]
        R_FINAL["Phase 2, gen==maxGen or extinct<br/>action: finalize<br/>ready: true"]
        R_CLAIM["Phase 3 (Claim)<br/>action: claim<br/>ready: false"]
    end

    subgraph "Shape L2"
        CONTRACT_K["ConwayArenaRound"]
    end

    STATUS -->|"reads via cast call"| CONTRACT_K
    STATUS --> R_COMMIT & R_REVEAL & R_WAIT_REVEAL & R_INIT & R_STEP & R_FINAL & R_CLAIM
    R_REVEAL & R_INIT & R_STEP & R_FINAL -->|"if ready=true"| TICK
    TICK -->|"cast send<br/>(with KEEPER_PRIVATE_KEY)"| CONTRACT_K
    LOOP -->|"invokes"| TICK
```

### 8.8 Scoring and Payout Flow

Accounting flow from round funding through to winner claims and keeper withdrawals.

```mermaid
flowchart TD
    subgraph "Round Configuration"
        FUND["configureAccounting()<br/>totalFunded (from contract balance)<br/>Guard: totalFunded <= address(this).balance"]
        SPLIT["Pool Split (v0.1)<br/>winnerBps: 8000 (80%)<br/>keeperBps: 2000 (20%)<br/>treasuryBps: 0"]
        POOLS["winnerPool = totalFunded * 8000 / 10000<br/>keeperPool = totalFunded * 2000 / 10000"]
    end

    subgraph "During Simulation"
        STEP_REWARD["stepBatch(N):<br/>actualSteps = min(N, maxBatch, maxGen-gen)<br/>reward = actualSteps * rewardPerGen<br/>reward = min(reward, keeperPoolRemaining)<br/>keeperCredit[keeper] += reward<br/>keeperPaid += reward"]
    end

    subgraph "At Finalize"
        SCORE["Score computation:<br/>popBlue = popcount(blue)<br/>popRed = popcount(red)<br/>invBlue = popcount(blue AND rightHalf)<br/>invRed = popcount(red AND leftHalf)<br/>scoreBlue = 3*popBlue + 2*invBlue<br/>scoreRed = 3*popRed + 2*invRed"]
        WINNER["Winner resolution:<br/>if one team extinct: other wins<br/>else: higher score wins<br/>equal scores: draw"]
        ROLLOVER["keeperRemainder = keeperPool - keeperPaid<br/>winnerPoolFinal = winnerPool + keeperRemainder"]
        ZERO_CHECK{Any eligible<br/>revealed slots?}
        PAYOUT_CALC["payoutPerClaim = winnerPoolFinal / eligibleCount<br/>dust = winnerPoolFinal % eligibleCount<br/>treasuryDust += dust"]
        DUST_ROUTE["winnerPoolFinal -> treasuryDust<br/>(no claims possible)"]
    end

    subgraph "Claims (Phase 3)"
        CLAIM_CHECK["claim(slotIndex):<br/>Guard: revealed, owner, not claimed<br/>nonReentrant"]
        WINNER_CLAIM["If winner team (or draw):<br/>transfer payoutPerClaim to player<br/>winnerPaid += payoutPerClaim"]
        ZERO_CLAIM["If losing team:<br/>transfer 0, mark claimed"]
        KEEPER_WITHDRAW["withdrawKeeperCredit():<br/>Guard: credit > 0, nonReentrant<br/>transfer keeperCredit[msg.sender]"]
    end

    subgraph "Invariant"
        INV["winnerPaid + keeperPaid + treasuryDust <= totalFunded<br/>(always holds, verified by indexer reconciliation)"]
    end

    FUND --> SPLIT --> POOLS
    POOLS --> STEP_REWARD
    STEP_REWARD --> SCORE
    SCORE --> WINNER --> ROLLOVER
    ROLLOVER --> ZERO_CHECK
    ZERO_CHECK -->|Yes| PAYOUT_CALC
    ZERO_CHECK -->|No| DUST_ROUTE
    PAYOUT_CALC --> CLAIM_CHECK
    CLAIM_CHECK --> WINNER_CLAIM & ZERO_CLAIM
    STEP_REWARD --> KEEPER_WITHDRAW
    WINNER_CLAIM & ZERO_CLAIM & KEEPER_WITHDRAW --> INV
```

### 8.9 Parity Testing Architecture

How TS and Solidity engines are verified against each other.

```mermaid
flowchart TD
    subgraph "Golden Fixtures"
        FIXTURE["fixtures/engine/parity.v1.json<br/>version: v1, topology: cylinder<br/>Cases with input boards + expected outputs<br/>Including edge cases:<br/>- hard X edges (no horizontal wrap)<br/>- cylinder Y seam wrap<br/>- immigration majority at boundaries"]
    end

    subgraph "TS Engine (packages/sim)"
        TS_UNIT["engine.test.ts<br/>pack/unpack invertibility<br/>B3/S23 oscillator behavior<br/>immigration majority color"]
        TS_PARITY["parity.test.ts<br/>1. Load golden vectors from fixture<br/>2. Run stepGeneration() on each input<br/>3. Assert output == expected<br/>4. Seeded random fuzz: generate N boards<br/>   run M steps, compare vs reference impl"]
    end

    subgraph "Solidity Engine (packages/contracts)"
        SOL_UNIT["ConwayEngineParity.t.sol<br/>1. Fixed vectors mirroring fixture cases<br/>2. Seeded random fuzz parity vs<br/>   Solidity in-test reference engine"]
        SOL_LIFECYCLE["11 test files covering:<br/>StateMachine, CommitReveal, Simulation,<br/>Accounting, WinnerPayout, E2E, Gas,<br/>ClaimSafety, Reentrancy, KeeperWithdraw,<br/>CommitHash, Events, ArenaRegistry"]
    end

    subgraph "Gas Regression"
        GAS[".gas-snapshot<br/>forge snapshot --check<br/>local gate blocks regression"]
    end

    subgraph "Indexer Verification"
        IDX_TEST["reconcile-round-events.test.ts<br/>ingest-round-read-model.test.ts<br/>round-sync.test.ts<br/>sync-window.test.ts"]
    end

    subgraph "Web Logic Tests (Vitest)"
        WEB_TEST["17 test files covering:<br/>board-renderer, board-animation, board-fetch<br/>seed, seed-link, seed-contribution<br/>wallet-onboarding, wallet-signing, wallet-submit<br/>round-rules, round-tx, round-end<br/>round-feeds, round-live, replay<br/>health-route, board-summary"]
    end

    FIXTURE --> TS_PARITY
    FIXTURE -.->|"semantics mirrored"| SOL_UNIT
    TS_PARITY -.->|"same rules,<br/>same outputs"| SOL_UNIT
    SOL_UNIT --> GAS
    SOL_LIFECYCLE --> GAS
```

### 8.10 Deployment and Operations Topology

How the system is deployed and operated on Shape Sepolia.

```mermaid
flowchart TB
    subgraph "Operator Workstation"
        DEPLOY["Hardhat Ignition<br/>deploy:contracts:shape-sepolia<br/>ConwayArenaRoundModule<br/>ArenaRegistryModule"]
        VERIFY["verify:contracts:shape-sepolia<br/>(constructor-arg-aware)"]
        BENCH["benchmark:sepolia:max-batch<br/>(cast estimate stepBatch gas)"]
        LOCK["lock:sepolia:max-batch<br/>(writes to ignition params)"]
        SMOKE["smoke:sepolia:round<br/>(chain id, bytecode, state reads)"]
    end

    subgraph "Shape Sepolia (chainId 11011)"
        ROUND["ConwayArenaRound<br/>(deployed via Ignition)"]
        REGISTRY["ArenaRegistry<br/>(round discovery +<br/>season metadata)"]
    end

    subgraph "Keeper Infrastructure"
        K_STATUS["observe:sepolia:keeper<br/>(status + recommendation)"]
        K_TICK["tick:sepolia:keeper<br/>(one-shot tx submission)"]
        K_LOOP["loop:sepolia:keeper<br/>(recurring automation)"]
    end

    subgraph "Indexer Pipeline"
        SYNC["indexer:sync:round<br/>(CLI: --rpc --round)"]
        SNAPSHOT["round-read-model.latest.json<br/>(persisted to disk)"]
    end

    subgraph "Web App (Next.js)"
        APP["apps/web<br/>bun run dev / bun run build"]
    end

    subgraph "RPC Provider"
        ALCHEMY["Alchemy<br/>SHAPE_SEPOLIA_RPC_URL"]
    end

    DEPLOY -->|"deploys"| ROUND & REGISTRY
    VERIFY -->|"verifies on explorer"| ROUND & REGISTRY
    BENCH -->|"cast estimate"| ROUND
    LOCK -->|"updates params JSON"| DEPLOY
    SMOKE -->|"cast call"| ROUND

    K_STATUS -->|"cast call"| ROUND
    K_TICK -->|"cast send"| ROUND
    K_LOOP -->|"invokes"| K_TICK

    SYNC -->|"viem getLogs + readContract"| ROUND
    SYNC -->|"writes"| SNAPSHOT
    SNAPSHOT -->|"file read"| APP

    ROUND & REGISTRY & K_STATUS & K_TICK & SYNC ---|"via"| ALCHEMY
```

### 8.11 Component Hierarchy (Web UI)

React component tree showing data flow from hooks to leaf components.

```mermaid
flowchart TD
    subgraph "app/layout.tsx"
        PROVIDERS["Providers<br/>(WagmiProvider + QueryClientProvider)<br/>SSR cookie hydration"]
    end

    subgraph "app/page.tsx"
        PAGE["Home Page"]
    end

    subgraph "RoundDashboard (orchestrator)"
        POLL["useRoundLive() hook<br/>owns: payload, error state"]
    end

    PROVIDERS --> PAGE --> POLL

    POLL -->|"payload, error"| LIVE_PANEL["RoundLivePanel<br/>Phase, gen, timestamps<br/>Accounting, reconciliation<br/>Freshness badge (Live/Stale)"]

    POLL -->|"payload"| WALLET_PANEL["RoundWalletPanel<br/>Connect/Switch/Ready gating<br/>Team picker, Slot grid<br/>8x8 Seed editor + presets<br/>Commit/Reveal/Claim tx flow<br/>Tx feedback status panel"]

    POLL -->|"payload.participants"| PARTICIPANTS["ParticipantList<br/>Player address, team badge<br/>Slot, lifecycle status, payout"]

    POLL -->|"payload.keepers"| KEEPERS["KeeperFeed<br/>Ranked by reward<br/>Steps, gens advanced"]

    POLL -->|"payload + board hook"| BOARD["BoardCanvas<br/>3 modes: demo / live / final<br/>useBoardState() for checkpoints<br/>Local TS forward-sim animation<br/>Play/Pause/Reset/FPS controls<br/>Replay link button"]

    POLL -->|"payload (finalized)"| END_CARD["RoundEndCard<br/>Winner announcement<br/>Score breakdown<br/>Payout summary<br/>Claim button"]

    subgraph "app/replay/page.tsx"
        REPLAY_PAGE["Replay Page<br/>Seed-link query params<br/>or demo board fallback"]
        REPLAY_CANVAS["ReplayCanvas<br/>Timeline scrubber (Slider)<br/>Signature moment jumps<br/>(peak, lead-change, extinction)<br/>Play/Pause/Reset/FPS"]
    end

    REPLAY_PAGE --> REPLAY_CANVAS
```

### 8.12 Commit/Reveal Cryptographic Flow

Domain-separated commit hash construction and reveal verification.

```mermaid
sequenceDiagram
    participant Player as Player (Browser)
    participant RoundTx as lib/round-tx
    participant Contract as ConwayArenaRound

    Note over Player: Phase 0: Commit

    Player->>Player: Choose team, slot, design seed (8x8, max 12 cells)
    Player->>Player: Generate random 32-byte salt

    Player->>RoundTx: computeCommitHash({roundId, chainId, arena, player, team, slotIndex, seedBits, salt})
    Note over RoundTx: keccak256(abi.encode(<br/>  roundId,<br/>  chainId,       // replay protection<br/>  arena,         // cross-deploy protection<br/>  player,        // impersonation protection<br/>  team,<br/>  slotIndex,<br/>  seedBits,<br/>  salt           // hiding<br/>))
    RoundTx-->>Player: commitHash (bytes32)

    Player->>Contract: commit(team, slotIndex, commitHash)
    Note over Contract: Guards:<br/>phase == Commit<br/>block.timestamp < commitEnd<br/>slot empty<br/>no prior reservation for player<br/>team matches slot territory<br/>Stores: slots[slotIndex] = {player, team, commitHash}
    Contract-->>Player: emit Committed(player, team, slotIndex)

    Note over Player: Phase 1: Reveal

    Player->>Contract: reveal(roundId, team, slotIndex, seedBits, salt)
    Note over Contract: Guards:<br/>phase == Reveal<br/>block.timestamp < revealEnd<br/>msg.sender == slots[slotIndex].player<br/>not already revealed<br/>popcount(seedBits) <= seedBudget (12)<br/>hashCommit(roundId, chainId, this, player, team, slot, seedBits, salt)<br/>  == slots[slotIndex].commitHash
    Contract-->>Player: emit Revealed(player, team, slotIndex)
```

### 8.13 Board Topology and Slot Territory Layout

Visual representation of the 64x64 board, cylinder topology, slot grid, and team territories.

```mermaid
flowchart TD
    subgraph "64x64 Board (Cylinder Topology)"
        subgraph "Y-axis: Wraps (cylinder)"
            ROW0["Row 0"]
            ROW1["Row 1"]
            DOTS1["..."]
            ROW63["Row 63"]
            ROW0 -.->|"wraps to"| ROW63
            ROW63 -.->|"wraps to"| ROW0
        end

        subgraph "X-axis: Hard edges (no wrap)"
            COL_NOTE["x=0 (left edge, dead beyond)<br/>...<br/>x=31 (Blue/Red boundary)<br/>x=32<br/>...<br/>x=63 (right edge, dead beyond)"]
        end
    end

    subgraph "8x8 Slot Grid (64 total slots)"
        subgraph "Blue Territory (tileX 0-3)"
            BT["Slots where slotIndex % 8 < 4<br/>32 slots on left half<br/>x: 0-31"]
        end
        subgraph "Red Territory (tileX 4-7)"
            RT["Slots where slotIndex % 8 >= 4<br/>32 slots on right half<br/>x: 32-63"]
        end
    end

    subgraph "Invasion Scoring Masks"
        BLUE_INV["Blue invasion = popcount(blue AND rightHalf)<br/>rightHalf: bits x >= 32"]
        RED_INV["Red invasion = popcount(red AND leftHalf)<br/>leftHalf: bits x < 32"]
    end

    BT -->|"Blue spawns here"| BLUE_INV
    RT -->|"Red spawns here"| RED_INV
```

### 8.14 Indexer Reconciliation and Sync Pipeline

Detailed view of how the indexer maintains accounting integrity with reorg safety.

```mermaid
flowchart TD
    subgraph "Sync CLI (sync-round-read-model.ts)"
        ARGS["CLI args: --rpc, --round,<br/>--from-block, --to-block,<br/>--confirmations (default 2),<br/>--reorg-lookback (default 12)"]
        WINDOW["computeSyncWindow()<br/>confirmedTip = latest - confirmations<br/>fromBlock = cursor - reorgLookback<br/>(overlap reprocessing for reorg safety)"]
    end

    subgraph "Ingestion (ingest-round-read-model.ts)"
        PARALLEL["Promise.all([<br/>  getChainId(),<br/>  readRoundState(),<br/>  getSteppedEvents(),<br/>  getFinalizedEvents(),<br/>  getClaimedEvents(),<br/>  getPlayerClaimedEvents(),<br/>  getCommittedEvents(),<br/>  getRevealedEvents()<br/>])"]
        MERGE["Merge with previousModel:<br/>1. Keep events before fromBlock<br/>2. Replace overlap range with fresh<br/>3. Sort by (blockNumber, logIndex)"]
    end

    subgraph "Reconciliation (reconcile-round-events.ts)"
        R_KEEPER["sum(stepped.reward) == finalized.keeperPaid"]
        R_INVARIANT["winnerPaid + keeperPaid + treasuryDust <= totalFunded"]
        R_STATUS["reconciliationStatus: ok | pending-finalize"]
    end

    subgraph "Persistence"
        MODEL_FILE["round-read-model.latest.json<br/>(BigInt-safe: replacer/reviver)"]
        CURSOR_FILE["round-read-model.cursor.json<br/>{version, chainId, roundAddress,<br/> lastSyncedBlock, syncedAt}"]
    end

    ARGS --> WINDOW
    WINDOW --> PARALLEL
    PARALLEL --> MERGE
    MERGE --> R_KEEPER & R_INVARIANT & R_STATUS
    R_KEEPER & R_INVARIANT & R_STATUS --> MODEL_FILE & CURSOR_FILE
```
