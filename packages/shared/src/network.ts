import { defineChain } from "viem";

/**
 * 0G Galileo testnet constants.
 *
 * RPC, explorer, and faucet are documented at
 * https://docs.0g.ai/developer-hub/testnet/testnet-overview . Contract
 * addresses below are populated at deploy time (Phase 6) and exposed via env.
 */
export const GALILEO_TESTNET = {
  chainId: 16602,
  /** lowercase slug used in DecideInput.chain */
  slug: "0g-galileo",
  displayName: "0G Galileo Testnet",
  nativeCurrency: "OG",
  defaultRpcUrl: "https://evmrpc-testnet.0g.ai",
  explorerUrl: "https://chainscan-galileo.0g.ai",
  faucetUrl: "https://faucet.0g.ai",
  storage: {
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  },
  contracts: {
    /** AgentCheckoutToken (EIP-3009 acUSD) - populated after Phase 6 deploy */
    aToken: (process.env.GALILEO_ATOKEN_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    /** ComplianceGateway - populated after Phase 6 deploy */
    gateway: (process.env.GALILEO_GATEWAY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  },
} as const;

/**
 * Monad testnet - kept as a reference (donor repo targeted it). NOT used at
 * runtime in agentcheckout-0g. Safe to delete once the donor handler is
 * fully refactored in Phase 4.
 */
export const MONAD_TESTNET = {
  chainId: 10143,
  slug: "monad",
  displayName: "Monad Testnet",
  nativeCurrency: "MON",
  defaultRpcUrl: "https://testnet-rpc.monad.xyz",
  explorerUrl: "https://testnet.monadvision.com",
  contracts: {
    apass: "0xbA82D189540CaC9DC6FF46B6837CaC1BFdEC58B9",
    aUSDC: "0xaC0893567D43C3E7e6e35a72803df05416C1f20D",
    usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    accessCore: "0x8F118338a1fa41E7Fa86Be19A4e8B99Ed58A6EcC",
    depositGateway: "0x8e084646080a35347B2D053Dd72F550f12245c8B",
  },
} as const;

/** viem chain for 0G Galileo testnet, optionally with a custom RPC URL. */
export function galileoChain(rpcUrl: string = GALILEO_TESTNET.defaultRpcUrl) {
  return defineChain({
    id: GALILEO_TESTNET.chainId,
    name: GALILEO_TESTNET.displayName,
    nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: "0G Chainscan", url: GALILEO_TESTNET.explorerUrl },
    },
    testnet: true,
  });
}

/** kept for compatibility with donor middleware/facilitator that imported it */
export function monadChain(rpcUrl: string = MONAD_TESTNET.defaultRpcUrl) {
  return defineChain({
    id: MONAD_TESTNET.chainId,
    name: MONAD_TESTNET.displayName,
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: "MonadVision", url: MONAD_TESTNET.explorerUrl },
    },
    testnet: true,
  });
}

export function explorerTxUrl(
  txHash: string,
  explorerUrl: string = GALILEO_TESTNET.explorerUrl,
): string {
  return `${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function explorerAddressUrl(
  address: string,
  explorerUrl: string = GALILEO_TESTNET.explorerUrl,
): string {
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
