import "dotenv/config";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";

type CustomChain = {
  network: string;
  chainId: number;
  urls: {
    apiURL: string;
    browserURL: string;
  };
};

const customChains: CustomChain[] = [];

const shapeSepoliaApiUrl = process.env.SHAPE_SEPOLIA_VERIFY_API_URL;
const shapeSepoliaBrowserUrl = process.env.SHAPE_SEPOLIA_BROWSER_URL;
if (shapeSepoliaApiUrl && shapeSepoliaBrowserUrl) {
  customChains.push({
    network: "shapeSepolia",
    chainId: 11011,
    urls: {
      apiURL: shapeSepoliaApiUrl,
      browserURL: shapeSepoliaBrowserUrl,
    },
  });
}

const shapeMainnetApiUrl = process.env.SHAPE_MAINNET_VERIFY_API_URL;
const shapeMainnetBrowserUrl = process.env.SHAPE_MAINNET_BROWSER_URL;
if (shapeMainnetApiUrl && shapeMainnetBrowserUrl) {
  customChains.push({
    network: "shapeMainnet",
    chainId: 360,
    urls: {
      apiURL: shapeMainnetApiUrl,
      browserURL: shapeMainnetBrowserUrl,
    },
  });
}

export default defineConfig({
  plugins: [hardhatToolboxViem, hardhatIgnition, hardhatVerify],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache/hardhat",
    artifacts: "./artifacts/hardhat",
  },
  networks: {
    shapeSepolia: {
      type: "http",
      chainType: "op",
      chainId: 11011,
      url: configVariable("SHAPE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
    shapeMainnet: {
      type: "http",
      chainType: "op",
      chainId: 360,
      url: configVariable("SHAPE_MAINNET_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
  etherscan: {
    apiKey: {
      shapeSepolia: process.env.SHAPE_SEPOLIA_VERIFY_API_KEY ?? "",
      shapeMainnet: process.env.SHAPE_MAINNET_VERIFY_API_KEY ?? "",
    },
    customChains,
  },
});
