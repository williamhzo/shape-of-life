import { describe, expect, it } from "vitest";

import { deriveWalletOnboardingState } from "../lib/wallet-onboarding";

describe("deriveWalletOnboardingState", () => {
  it("blocks progress when round address is missing", () => {
    const state = deriveWalletOnboardingState({
      roundConfigured: false,
      connected: false,
      chainId: undefined,
      targetChainId: 11011,
    });

    expect(state.stage).toBe("missing-round");
    expect(state.canSubmitTx).toBe(false);
  });

  it("keeps user in connect stage when wallet is disconnected", () => {
    const state = deriveWalletOnboardingState({
      roundConfigured: true,
      connected: false,
      chainId: undefined,
      targetChainId: 11011,
    });

    expect(state.stage).toBe("connect-wallet");
    expect(state.canSubmitTx).toBe(false);
  });

  it("requires chain switch when wallet is connected to wrong network", () => {
    const state = deriveWalletOnboardingState({
      roundConfigured: true,
      connected: true,
      chainId: 1,
      targetChainId: 11011,
    });

    expect(state.stage).toBe("switch-network");
    expect(state.canSubmitTx).toBe(false);
  });

  it("allows tx submission once connected on target chain with round configured", () => {
    const state = deriveWalletOnboardingState({
      roundConfigured: true,
      connected: true,
      chainId: 11011,
      targetChainId: 11011,
    });

    expect(state.stage).toBe("ready");
    expect(state.canSubmitTx).toBe(true);
  });
});
