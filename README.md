# Shape of Life

Conway Arena on Shape L2. See `plan.md` for full product spec, phased implementation plan, and all progress tracking.

## Workspace
- Runtime/package manager: Bun
- Package initialized:
  - `apps/web` (Next.js App Router + shadcn/ui baseline)
  - `packages/sim` (TypeScript simulation engine primitives)
  - `packages/contracts` (Foundry Solidity parity harness)
  - `packages/indexer` (event reconciliation checks for round accounting)
- Shared cross-implementation fixtures:
  - `fixtures/engine/parity.v1.json`
- Web UI baseline:
  - shadcn/ui components live in `apps/web/components/ui`
  - Use shadcn out-of-box styles/variants until final design pass
  - Linting baseline uses Next.js recommendations (`next/core-web-vitals` + `next/typescript`)

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
bun test apps/web/test
```

- Run all configured tests (sim + web + contracts):

```bash
bun run test
```

- Run indexer reconciliation tests:

```bash
bun test packages/indexer/test
```

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
