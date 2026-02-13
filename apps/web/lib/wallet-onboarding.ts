export type WalletOnboardingStage = "missing-round" | "connect-wallet" | "switch-network" | "ready";

export type WalletOnboardingInput = {
  roundConfigured: boolean;
  connected: boolean;
  chainId: number | undefined;
  targetChainId: number;
};

export type WalletOnboardingState = {
  stage: WalletOnboardingStage;
  canSubmitTx: boolean;
};

export function deriveWalletOnboardingState(input: WalletOnboardingInput): WalletOnboardingState {
  if (!input.roundConfigured) {
    return {
      stage: "missing-round",
      canSubmitTx: false,
    };
  }

  if (!input.connected) {
    return {
      stage: "connect-wallet",
      canSubmitTx: false,
    };
  }

  if (input.chainId !== input.targetChainId) {
    return {
      stage: "switch-network",
      canSubmitTx: false,
    };
  }

  return {
    stage: "ready",
    canSubmitTx: true,
  };
}
