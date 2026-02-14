import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createPublicClient, http, isAddress, parseAbi, type Address } from "viem";

import { buildRoundReadModel, createViemRoundIndexerClient } from "./ingest-round-read-model";
import { readRoundReadModelFile, writeRoundReadModelFile } from "./round-read-model-store";

const BIGINT_TAG = "__bigint__";

export type RoundSyncCursor = {
  version: "v1";
  chainId: number;
  roundAddress: Address;
  lastSyncedBlock: bigint;
  syncedAt: string;
};

export type ComputeSyncWindowParams = {
  latestBlock: bigint;
  confirmations: bigint;
  reorgLookback: bigint;
  cursor: RoundSyncCursor | null;
  explicitFromBlock: bigint | undefined;
  explicitToBlock: bigint | undefined;
};

export type SyncWindow = {
  fromBlock: bigint;
  toBlock: bigint;
  usedCursor: boolean;
};

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }

    parsed[key] = value;
    i += 1;
  }

  return parsed;
}

function parseBlock(raw: string | undefined, optionName: string): bigint | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${optionName} must be a decimal block number`);
  }

  return BigInt(raw);
}

function parseNonNegativeBigInt(raw: string, optionName: string): bigint {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${optionName} must be a non-negative integer`);
  }

  return BigInt(raw);
}

function parseRoundAddress(raw: string | undefined): Address {
  if (!raw) {
    throw new Error("--round or ROUND_ADDRESS is required");
  }

  if (!isAddress(raw)) {
    throw new Error(`invalid round address: ${raw}`);
  }

  return raw;
}

const REGISTRY_ABI = parseAbi(["function currentRound() view returns (address)"]);

async function resolveRoundAddress(args: Record<string, string>, rpcUrl: string): Promise<Address> {
  const explicit = args.round ?? process.env.ROUND_ADDRESS;
  if (explicit) {
    return parseRoundAddress(explicit);
  }

  const registryAddr = args.registry ?? process.env.ARENA_REGISTRY_ADDRESS;
  if (!registryAddr) {
    throw new Error("--round, ROUND_ADDRESS, --registry, or ARENA_REGISTRY_ADDRESS is required");
  }
  if (!isAddress(registryAddr)) {
    throw new Error(`invalid registry address: ${registryAddr}`);
  }

  const registryClient = createPublicClient({ transport: http(rpcUrl) });
  const currentRound = await registryClient.readContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "currentRound",
  });

  if (!currentRound || currentRound === "0x0000000000000000000000000000000000000000") {
    throw new Error("registry has no current round set");
  }

  return currentRound;
}

function parseCursor(raw: string): RoundSyncCursor {
  const parsed = JSON.parse(raw, (_, value) => {
    if (
      value !== null
      && typeof value === "object"
      && BIGINT_TAG in (value as Record<string, unknown>)
      && typeof (value as Record<string, unknown>)[BIGINT_TAG] === "string"
    ) {
      return BigInt((value as Record<string, string>)[BIGINT_TAG]);
    }

    return value;
  }) as Partial<RoundSyncCursor>;

  if (parsed.version !== "v1") {
    throw new Error("invalid cursor version");
  }
  if (!Number.isInteger(parsed.chainId)) {
    throw new Error("invalid cursor chainId");
  }
  if (!parsed.roundAddress || !isAddress(parsed.roundAddress)) {
    throw new Error("invalid cursor roundAddress");
  }
  if (typeof parsed.lastSyncedBlock !== "bigint") {
    throw new Error("invalid cursor lastSyncedBlock");
  }
  if (typeof parsed.syncedAt !== "string") {
    throw new Error("invalid cursor syncedAt");
  }

  return {
    version: "v1",
    chainId: parsed.chainId,
    roundAddress: parsed.roundAddress,
    lastSyncedBlock: parsed.lastSyncedBlock,
    syncedAt: parsed.syncedAt,
  };
}

function stringifyCursor(cursor: RoundSyncCursor): string {
  return (
    JSON.stringify(
      cursor,
      (_, value) => {
        if (typeof value === "bigint") {
          return { [BIGINT_TAG]: value.toString() };
        }

        return value;
      },
      2,
    ) + "\n"
  );
}

function readRoundSyncCursorFile(path: string): RoundSyncCursor | null {
  if (!existsSync(path)) {
    return null;
  }

  return parseCursor(readFileSync(path, "utf8"));
}

function writeRoundSyncCursorFile(path: string, cursor: RoundSyncCursor): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyCursor(cursor), "utf8");
}

export function computeSyncWindow(params: ComputeSyncWindowParams): SyncWindow {
  if (params.confirmations < 0n) {
    throw new Error("confirmations must be non-negative");
  }
  if (params.reorgLookback < 0n) {
    throw new Error("reorgLookback must be non-negative");
  }

  const confirmedTip = params.latestBlock > params.confirmations ? params.latestBlock - params.confirmations : 0n;
  const toBlock = params.explicitToBlock ?? confirmedTip;

  const usedCursor = params.explicitFromBlock === undefined && params.cursor !== null;
  let fromBlock = params.explicitFromBlock ?? 0n;

  if (params.explicitFromBlock === undefined && params.cursor !== null) {
    fromBlock = params.cursor.lastSyncedBlock > params.reorgLookback ? params.cursor.lastSyncedBlock - params.reorgLookback : 0n;
  }

  if (toBlock < fromBlock) {
    return {
      fromBlock: toBlock,
      toBlock,
      usedCursor,
    };
  }

  return {
    fromBlock,
    toBlock,
    usedCursor,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = args.rpc ?? process.env.SHAPE_SEPOLIA_RPC_URL ?? process.env.SHAPE_MAINNET_RPC_URL;
  if (!rpcUrl) {
    throw new Error("--rpc or SHAPE_SEPOLIA_RPC_URL or SHAPE_MAINNET_RPC_URL is required");
  }

  const roundAddress = await resolveRoundAddress(args, rpcUrl);
  const explicitFromBlock = parseBlock(args["from-block"], "--from-block");
  const explicitToBlock = parseBlock(args["to-block"], "--to-block");
  const confirmations = parseNonNegativeBigInt(args.confirmations ?? "2", "--confirmations");
  const reorgLookback = parseNonNegativeBigInt(args["reorg-lookback"] ?? "12", "--reorg-lookback");

  const outPath = resolve(args.out ?? "packages/indexer/data/round-read-model.latest.json");
  const cursorPath = resolve(args.cursor ?? "packages/indexer/data/round-read-model.cursor.json");

  const client = createViemRoundIndexerClient(rpcUrl);
  const latestBlock = await client.getLatestBlockNumber?.();
  if (latestBlock === undefined) {
    throw new Error("client does not expose latest block number");
  }

  const previousModel = existsSync(outPath) ? readRoundReadModelFile(outPath) : undefined;
  const cursor = explicitFromBlock === undefined ? readRoundSyncCursorFile(cursorPath) : null;

  if (cursor && cursor.chainId !== previousModel?.chainId && previousModel) {
    throw new Error("cursor chain id does not match existing read model chain id");
  }
  if (cursor && cursor.roundAddress.toLowerCase() !== roundAddress.toLowerCase()) {
    throw new Error("cursor round address does not match requested round");
  }

  const window = computeSyncWindow({
    latestBlock,
    confirmations,
    reorgLookback,
    cursor,
    explicitFromBlock,
    explicitToBlock,
  });

  const model = await buildRoundReadModel({
    client,
    roundAddress,
    fromBlock: window.fromBlock,
    toBlock: window.toBlock,
    previousModel,
  });

  writeRoundReadModelFile(outPath, model);

  const nextCursor: RoundSyncCursor = {
    version: "v1",
    chainId: model.chainId,
    roundAddress: model.roundAddress,
    lastSyncedBlock: model.cursor.toBlock,
    syncedAt: model.syncedAt,
  };
  writeRoundSyncCursorFile(cursorPath, nextCursor);

  process.stdout.write(
    JSON.stringify(
      {
        outPath,
        cursorPath,
        chainId: model.chainId,
        roundAddress: model.roundAddress,
        fromBlock: model.cursor.fromBlock.toString(),
        toBlock: model.cursor.toBlock.toString(),
        confirmations: confirmations.toString(),
        reorgLookback: reorgLookback.toString(),
        usedCursor: window.usedCursor,
        finalized: model.lifecycle.finalized,
        reconciliationStatus: model.accounting.reconciliationStatus,
      },
      null,
      2,
    ) + "\n",
  );
}

if (import.meta.main) {
  main();
}
