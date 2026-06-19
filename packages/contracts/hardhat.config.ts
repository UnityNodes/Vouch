import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import * as dotenv from "dotenv";
import * as path from "path";

// load the monorepo-root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;
