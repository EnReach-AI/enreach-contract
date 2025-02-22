import dotenv from "dotenv";
import "@typechain/hardhat";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";

import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";

dotenv.config();

const chainIds = {
  hardhat: 31337,
  ganache: 1337,
  mainnet: 1,
  sepolia: 11155111,
  holesky: 17000
};

// Ensure that we have all the environment variables we need.
const deployerKey: string = process.env.DEPLOYER_KEY || "";
const infuraKey: string = process.env.INFURA_KEY || "";

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  if (!infuraKey) {
    throw new Error("Missing INFURA_KEY");
  }

  let nodeUrl;
  switch (network) {
    case "mainnet":
      nodeUrl = `https://mainnet.infura.io/v3/${infuraKey}`;
      break;
    case "sepolia":
      nodeUrl = `https://sepolia.infura.io/v3/${infuraKey}`;
      break;
    case "holesky":
      nodeUrl = `https://holesky.infura.io/v3/${infuraKey}`;
      break;
  }

  return {
    chainId: chainIds[network],
    url: nodeUrl,
    accounts: [`${deployerKey}`],
  };
}

const config: HardhatUserConfig = {
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          metadata: {
            bytecodeHash: "ipfs",
          },
          // You should disable the optimizer when debugging
          // https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: true,
            runs: 100,
            // https://hardhat.org/hardhat-runner/docs/reference/solidity-support#support-for-ir-based-codegen
            // details: {
            //   yulDetails: {
            //     optimizerSteps: "u",
            //   },
            // },
          },
          viaIR: true
        },
      },
    ],
  },
  abiExporter: {
    flat: true,
  },
  gasReporter: {
    enabled: false
  },
  mocha: {
    parallel: false,
    timeout: 100000000
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
  sourcify: {
    enabled: false
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY || "",
      sepolia: process.env.ETHERSCAN_KEY || "",
      holesky: process.env.ETHERSCAN_KEY || ""
    },
    customChains: [

    ]
  },
};

if (deployerKey) {
  config.networks = {
    mainnet: createTestnetConfig("mainnet"),
    sepolia: createTestnetConfig("sepolia"),
    holesky: createTestnetConfig("holesky"),
  };
}

config.networks = {
  ...config.networks,
  hardhat: {
    chainId: 1337,
    gas: "auto",
    gasPrice: "auto",
    allowUnlimitedContractSize: true,
  },
};

export default config;
