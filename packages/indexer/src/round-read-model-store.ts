import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RoundReadModel } from "./ingest-round-read-model";

const BIGINT_TAG = "__bigint__";

type BigIntRecord = {
  [BIGINT_TAG]: string;
};

function isBigIntRecord(value: unknown): value is BigIntRecord {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 1 && typeof candidate[BIGINT_TAG] === "string";
}

export function stringifyRoundReadModel(model: RoundReadModel): string {
  return (
    JSON.stringify(
      model,
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

export function parseRoundReadModel(raw: string): RoundReadModel {
  return JSON.parse(raw, (_, value) => {
    if (isBigIntRecord(value)) {
      return BigInt(value[BIGINT_TAG]);
    }

    return value;
  }) as RoundReadModel;
}

export function readRoundReadModelFile(path: string): RoundReadModel {
  const raw = readFileSync(path, "utf8");
  return parseRoundReadModel(raw);
}

export function writeRoundReadModelFile(path: string, model: RoundReadModel): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyRoundReadModel(model), "utf8");
}
