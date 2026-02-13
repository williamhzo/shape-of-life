type TxAction = "commit" | "reveal" | "claim";

export type TxStage = "idle" | "pending" | "sign" | "confirming" | "error" | "success";

export type TxFeedback = {
  action: TxAction | null;
  stage: TxStage;
  message: string;
  txHash: string | null;
};

type CreateTxFeedbackInput =
  | { action: null; stage: "idle" }
  | { action: TxAction; stage: "pending" | "sign"; txHash?: string }
  | { action: TxAction; stage: "confirming"; txHash: string }
  | { action: TxAction; stage: "success"; txHash?: string; blockNumber?: bigint }
  | { action: TxAction; stage: "error"; error: string; txHash?: string };

export type TxBadgeVariant = "default" | "secondary" | "outline" | "destructive";

function actionLabel(action: TxAction): string {
  if (action === "commit") {
    return "Commit";
  }
  if (action === "reveal") {
    return "Reveal";
  }
  return "Claim";
}

export function createTxFeedback(input: CreateTxFeedbackInput): TxFeedback {
  switch (input.stage) {
    case "idle":
      return {
        action: null,
        stage: "idle",
        message: "No transaction in progress.",
        txHash: null,
      };
    case "pending":
      return {
        action: input.action,
        stage: "pending",
        message: `${actionLabel(input.action)} pending. Validating draft and simulating transaction...`,
        txHash: input.txHash ?? null,
      };
    case "sign":
      return {
        action: input.action,
        stage: "sign",
        message: `Sign ${input.action} transaction in wallet.`,
        txHash: input.txHash ?? null,
      };
    case "confirming":
      return {
        action: input.action,
        stage: "confirming",
        message: `${actionLabel(input.action)} submitted (${input.txHash.slice(0, 10)}...), waiting for confirmation...`,
        txHash: input.txHash,
      };
    case "success": {
      const blockDetail = input.blockNumber === undefined ? "" : ` Confirmed in block ${input.blockNumber.toString()}.`;
      return {
        action: input.action,
        stage: "success",
        message: `${actionLabel(input.action)} success.${blockDetail}`,
        txHash: input.txHash ?? null,
      };
    }
    case "error":
      return {
        action: input.action,
        stage: "error",
        message: input.error,
        txHash: input.txHash ?? null,
      };
  }
}

export function txBadgeVariant(stage: TxStage): TxBadgeVariant {
  if (stage === "success") {
    return "default";
  }
  if (stage === "error") {
    return "destructive";
  }
  if (stage === "idle") {
    return "outline";
  }
  return "secondary";
}
