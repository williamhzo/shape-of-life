# Shape of Life

Conway Arena on Shape L2. See `plan.md` for full product spec, phased implementation plan, and all progress tracking.

## Workspace
- Runtime/package manager: Bun
- Package initialized:
  - `apps/web` (Next.js App Router + shadcn/ui baseline)
  - `packages/sim` (TypeScript simulation engine primitives)
  - `packages/contracts` (Foundry Solidity parity harness)
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

- Run all configured tests:

```bash
bun test
```

- Build web app:

```bash
cd apps/web && bun run build
```

- Run Solidity parity tests (requires local solc install via Foundry):

```bash
cd packages/contracts && forge test
```

- Run Solidity gas regression check against committed snapshot:

```bash
bun run test:contracts:gas
```
