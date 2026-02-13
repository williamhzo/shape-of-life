# Shape of Life

Conway Arena on Shape L2. See `plan.md` for full product spec, phased implementation plan, and all progress tracking.

## Workspace
- Runtime/package manager: Bun
- Package initialized:
  - `apps/web` (Next.js App Router + shadcn/ui baseline)
  - `packages/sim` (TypeScript simulation engine primitives)
  - `packages/contracts` (Foundry Solidity parity harness)
  - `packages/indexer` (chain-ingesting round read-model sync + accounting reconciliation checks)
- Shared cross-implementation fixtures:
  - `fixtures/engine/parity.v1.json`
- Web UI baseline:
  - shadcn/ui components live in `apps/web/components/ui`
  - Use shadcn out-of-box styles/variants until final design pass
  - Linting baseline uses Next.js recommendations (`next/core-web-vitals` + `next/typescript`)
  - Wallet onboarding/sign-in state uses wagmi + viem with SSR cookie hydration

## Commands
- Run web lint (Next.js ESLint baseline + TypeScript rules):

```bash
bun run lint:web
```

- Run simulation tests:

```bash
bun test packages/sim/test
```

- Run web tests:

```bash
cd apps/web && bun run test
```

Web Vitest scope is intentionally limited to API routes and deterministic `apps/web/lib/*` logic (no component-markup UI tests).

- Validate web UI behavior in a browser session:

```bash
cd apps/web && bun run dev
```

- Run all configured tests (sim + web + indexer + contract scripts + contracts):

```bash
bun run test
```

- Run indexer reconciliation tests:

```bash
bun test packages/indexer/test
```

- Sync persisted round read model from chain events/state:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run indexer:sync:round
```

- Sync with resumable cursor + confirmation/reorg controls:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run indexer:sync:round --confirmations 2 --reorg-lookback 12
```

- Run web app with wallet + live round panels enabled:

```bash
NEXT_PUBLIC_ROUND_ADDRESS=<deployed-round-address> \
NEXT_PUBLIC_SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
cd apps/web && bun run dev
```

The wallet panel now includes a wagmi-based signup flow (connect + target-chain gating), a team-aware slot picker, 8x8 seed editor with presets/transforms + budget meter, and explicit tx status stages (`pending`, `sign`, `confirming`, `error`, `success`) driven by `simulateContract -> writeContract -> waitForTransactionReceipt`.

- Run benchmark utility tests for Sepolia maxBatch lock tooling:

```bash
bun test packages/contracts/scripts/*.test.ts
```

- Build web app:

```bash
cd apps/web && bun run build
```

- Run Solidity parity tests (requires local solc install via Foundry):

```bash
cd packages/contracts && forge test --offline
```

- Run Solidity gas regression check against committed snapshot:

```bash
bun run test:contracts:gas
```

- Compile contracts with Hardhat (viem toolbox + ignition scaffold):

```bash
bun run contracts:hardhat:compile
```

- Deploy `ConwayArenaRound` to Shape Sepolia via Hardhat Ignition:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
DEPLOYER_PRIVATE_KEY=<hex-private-key> \
bun run deploy:contracts:shape-sepolia
```

- Print latest Shape Sepolia deployed round address from Ignition artifacts:

```bash
bun run show:contracts:shape-sepolia:round
```

- Verify latest Shape Sepolia deployment (requires explorer endpoints/api key):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
DEPLOYER_PRIVATE_KEY=<hex-private-key> \
SHAPE_SEPOLIA_VERIFY_API_URL=<explorer-api-url> \
SHAPE_SEPOLIA_BROWSER_URL=<explorer-browser-url> \
SHAPE_SEPOLIA_VERIFY_API_KEY=<explorer-api-key> \
bun run verify:contracts:shape-sepolia
```

- Benchmark `stepBatch` gas on Shape Sepolia and write a lock recommendation artifact:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run benchmark:sepolia:max-batch
```

- Lock `maxBatch` in Sepolia ignition params from the latest benchmark artifact:

```bash
bun run lock:sepolia:max-batch
```

- Run benchmark + lock sequence in one command:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run benchmark:sepolia:max-batch:lock
```

- Run deploy/address-resolve + benchmark + lock + smoke in one command:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
DEPLOYER_PRIVATE_KEY=<hex-private-key> \
bun run rollout:sepolia:max-batch
```

Optional:
- `--round <address>` to use a specific deployed round without resolving/deploying.
- `--skip-deploy` to fail fast instead of deploying when no round address is available.

- Run Sepolia round smoke checks (chain ID, deployed bytecode, key round state reads, optional lockfile match):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run smoke:sepolia:round
```

- Run keeper observability status on Sepolia (phase windows, terminal state, and recommended next onchain action):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run observe:sepolia:keeper
```

Output includes `recommendedCommand` when a keeper transition call should be executed.

- Run one keeper tick in dry-run mode (prints whether a transition is executable now):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run tick:sepolia:keeper
```

- Execute the recommended keeper transition when one is ready:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
KEEPER_PRIVATE_KEY=<hex-private-key> \
bun run tick:sepolia:keeper --execute
```

- Run recurring keeper ticks (default 15s interval, dry-run):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run loop:sepolia:keeper --interval 15 --iterations 20
```

Execute mode with stop-on-first-submitted transition:

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
KEEPER_PRIVATE_KEY=<hex-private-key> \
bun run loop:sepolia:keeper --execute --interval 15
```

Keeper operator runbook: `packages/contracts/docs/keeper-runbook.md`.

- Run full Sepolia release gate (local test/lint/build gates + Sepolia smoke):

```bash
SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url> \
ROUND_ADDRESS=<deployed-round-address> \
bun run release:gate:sepolia
```
