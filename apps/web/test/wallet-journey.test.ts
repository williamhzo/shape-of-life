import { describe, expect, it } from "bun:test";
import { decodeFunctionData } from "viem";

import { ROUND_ABI } from "../lib/round-tx";
import { submitWalletAction, type WalletProvider } from "../lib/wallet-journey";

function createProvider(responses: Record<string, unknown>): {
  provider: WalletProvider;
  calls: { method: string; params?: unknown[] }[];
} {
  const calls: { method: string; params?: unknown[] }[] = [];

  const provider: WalletProvider = {
    async request({ method, params }) {
      calls.push({ method, params });
      const value = responses[method];
      if (value instanceof Error) {
        throw value;
      }

      return value;
    },
  };

  return { provider, calls };
}

describe("submitWalletAction", () => {
  it("switches chain when needed and sends commit transaction", async () => {
    const { provider, calls } = createProvider({
      eth_chainId: "0x1",
      wallet_switchEthereumChain: null,
      eth_sendTransaction: "0xabc",
    });

    const result = await submitWalletAction({
      provider,
      action: "commit",
      account: "0x2222222222222222222222222222222222222222",
      roundAddress: "0x1111111111111111111111111111111111111111",
      draft: {
        roundId: "1",
        team: 0,
        slotIndex: 0,
        seedBits: 3n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        claimSlotIndex: "0",
      },
    });

    expect(result.txHash).toBe("0xabc");
    expect(result.chainId).toBe(11011n);
    expect(calls.map((call) => call.method)).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_sendTransaction",
    ]);

    const tx = (calls[2]?.params?.[0] as { data: `0x${string}` }) ?? null;
    expect(tx).not.toBeNull();

    const decoded = decodeFunctionData({ abi: ROUND_ABI, data: tx.data });
    expect(decoded.functionName).toBe("commit");
  });

  it("sends reveal without switching when already on shape sepolia", async () => {
    const { provider, calls } = createProvider({
      eth_chainId: "0x2b03",
      eth_sendTransaction: "0xdef",
    });

    await submitWalletAction({
      provider,
      action: "reveal",
      account: "0x2222222222222222222222222222222222222222",
      roundAddress: "0x1111111111111111111111111111111111111111",
      draft: {
        roundId: "9",
        team: 1,
        slotIndex: 40,
        seedBits: 255n,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        claimSlotIndex: "0",
      },
    });

    expect(calls.map((call) => call.method)).toEqual(["eth_chainId", "eth_sendTransaction"]);
    const tx = (calls[1]?.params?.[0] as { data: `0x${string}` }) ?? null;
    const decoded = decodeFunctionData({ abi: ROUND_ABI, data: tx.data });
    expect(decoded.functionName).toBe("reveal");
  });

  it("propagates provider failures for optimistic UI handling", async () => {
    const { provider } = createProvider({
      eth_chainId: "0x2b03",
      eth_sendTransaction: new Error("user rejected"),
    });

    await expect(
      submitWalletAction({
        provider,
        action: "claim",
        account: "0x2222222222222222222222222222222222222222",
        roundAddress: "0x1111111111111111111111111111111111111111",
        draft: {
          roundId: "1",
          team: 0,
          slotIndex: 0,
          seedBits: 0n,
          salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
          claimSlotIndex: "0",
        },
      }),
    ).rejects.toThrow("user rejected");
  });
});
