import { shapeSepolia } from "viem/chains";
import { injected } from "@wagmi/core";
import { cookieStorage, createConfig, createStorage, http } from "wagmi";

const defaultShapeSepoliaRpcUrl = shapeSepolia.rpcUrls.default.http[0];

export const TARGET_CHAIN = shapeSepolia;

export function getWagmiConfig() {
  return createConfig({
    chains: [TARGET_CHAIN],
    connectors: [injected()],
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [TARGET_CHAIN.id]: http(process.env.NEXT_PUBLIC_SHAPE_SEPOLIA_RPC_URL ?? defaultShapeSepoliaRpcUrl),
    },
  });
}
