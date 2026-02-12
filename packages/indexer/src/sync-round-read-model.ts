import { resolve } from "node:path";
import { isAddress, type Address } from "viem";
import { buildRoundReadModel, createViemRoundIndexerClient } from "./ingest-round-read-model";
import { writeRoundReadModelFile } from "./round-read-model-store";

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

function parseRoundAddress(raw: string | undefined): Address {
  if (!raw) {
    throw new Error("--round or ROUND_ADDRESS is required");
  }

  if (!isAddress(raw)) {
    throw new Error(`invalid round address: ${raw}`);
  }

  return raw;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = args.rpc ?? process.env.SHAPE_SEPOLIA_RPC_URL ?? process.env.SHAPE_MAINNET_RPC_URL;
  if (!rpcUrl) {
    throw new Error("--rpc or SHAPE_SEPOLIA_RPC_URL or SHAPE_MAINNET_RPC_URL is required");
  }

  const roundAddress = parseRoundAddress(args.round ?? process.env.ROUND_ADDRESS);
  const fromBlock = parseBlock(args["from-block"], "--from-block") ?? 0n;
  const toBlock = parseBlock(args["to-block"], "--to-block");
  const outPath = resolve(args.out ?? "packages/indexer/data/round-read-model.latest.json");

  const client = createViemRoundIndexerClient(rpcUrl);
  const model = await buildRoundReadModel({
    client,
    roundAddress,
    fromBlock,
    toBlock,
  });

  writeRoundReadModelFile(outPath, model);

  process.stdout.write(
    JSON.stringify(
      {
        outPath,
        chainId: model.chainId,
        roundAddress: model.roundAddress,
        fromBlock: model.cursor.fromBlock.toString(),
        toBlock: model.cursor.toBlock.toString(),
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
