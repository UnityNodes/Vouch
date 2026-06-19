import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export function loadAgentAccount(pk: string | undefined = process.env.MCP_WALLET_PRIVATE_KEY): PrivateKeyAccount {
  if (!pk) throw new Error("MCP_WALLET_PRIVATE_KEY is not set");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  return privateKeyToAccount(key as `0x${string}`);
}
