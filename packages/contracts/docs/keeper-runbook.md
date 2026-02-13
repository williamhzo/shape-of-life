# Sepolia Keeper Runbook

This runbook is for operating a deployed `ConwayArenaRound` on Shape Sepolia.

## Required Environment

```bash
export SHAPE_SEPOLIA_RPC_URL=<alchemy-or-rpc-url>
export ROUND_ADDRESS=<deployed-round-address>
export KEEPER_PRIVATE_KEY=<hex-private-key>
```

## Operator Loop

1. Read current live round status and recommended next action:

```bash
bun run observe:sepolia:keeper
```

2. Run smoke checks before taking action:

```bash
bun run smoke:sepolia:round
```

3. Optional automation tick:

```bash
bun run tick:sepolia:keeper
bun run tick:sepolia:keeper --execute
```

4. Execute the recommended round transition manually when needed:

```bash
# commit -> reveal
cast send "$ROUND_ADDRESS" "beginReveal()" --private-key "$KEEPER_PRIVATE_KEY" --rpc-url "$SHAPE_SEPOLIA_RPC_URL"

# reveal -> sim
cast send "$ROUND_ADDRESS" "initialize()" --private-key "$KEEPER_PRIVATE_KEY" --rpc-url "$SHAPE_SEPOLIA_RPC_URL"

# sim progression (pick a safe step size, normally maxBatch)
cast send "$ROUND_ADDRESS" "stepBatch(uint16)" 16 --private-key "$KEEPER_PRIVATE_KEY" --rpc-url "$SHAPE_SEPOLIA_RPC_URL"

# terminal sim -> claim
cast send "$ROUND_ADDRESS" "finalize()" --private-key "$KEEPER_PRIVATE_KEY" --rpc-url "$SHAPE_SEPOLIA_RPC_URL"
```

5. During claim phase, do not call `stepBatch` or `finalize`; monitor claims and accounting fields through `smoke:sepolia:round` and indexer sync.

## Failure Modes and Immediate Actions

- `unexpected chain id ... expected 11011`:
  - RPC URL is wrong; switch to Shape Sepolia endpoint.
- `no bytecode found at ...`:
  - Round address is wrong or deployment did not complete.
- `deployed maxBatch ... does not match locked maxBatch ...`:
  - Deployment params drifted from benchmark lockfile. Re-run benchmark+lock and redeploy if needed.
- `RoundNotTerminal` on `finalize()`:
  - Round is still active. Keep calling `stepBatch` until `observe:sepolia:keeper` recommends `finalize`.
- `RevealWindowOpen` or `CommitWindowOpen` on transitions:
  - Phase window has not elapsed yet. Retry once the window closes.

## Pre-Release Checks

```bash
bun run release:gate:sepolia
```

If benchmark lock is stale or missing:

```bash
bun run benchmark:sepolia:max-batch:lock
```
