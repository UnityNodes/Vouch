/**
 * Real EIP-3009 settlement of vUSD on the deployed VouchToken (0G Galileo).
 *
 * The demo payer signs a TransferWithAuthorization off-chain; the merchant key
 * relays it on-chain via transferWithAuthorization, so the payer spends only
 * vUSD and never needs gas. This produces a real payment transaction for every
 * allowed decision. We do not wait for the receipt: writeContract returns the
 * hash once broadcast, which is all the UI link needs.
 */
import { createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { ATOKEN_ABI, buildTransferWithAuthorizationTypedData } from "@agentcheckout/shared";

const RPC = process.env.GALILEO_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = Number(process.env.GALILEO_CHAIN_ID ?? 16602);
const EXPLORER = (process.env.GALILEO_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai").replace(/\/$/, "");

const galileo = defineChain({
  id: CHAIN_ID,
  name: "0G Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function payerAccount() {
  const pk = process.env.DEMO_PAYER_PRIVATE_KEY as Hex | undefined;
  return pk && pk.length >= 64 ? privateKeyToAccount(pk) : null;
}

function relayerAccount() {
  const pk = process.env.PRIMARY_PRIVATE_KEY as Hex | undefined;
  if (!pk || pk.length < 64) throw new Error("PRIMARY_PRIVATE_KEY missing");
  return privateKeyToAccount(pk);
}

export function demoPayerAddress(): string | null {
  return payerAccount()?.address ?? null;
}

export interface SettleResult {
  txHash: string;
  explorerUrl: string;
  payer: string;
}

export async function settleVUSD(merchant: string, amountAtomic: string): Promise<SettleResult> {
  const token = process.env.GALILEO_ATOKEN_ADDRESS as Hex | undefined;
  if (!token) throw new Error("GALILEO_ATOKEN_ADDRESS missing");
  const payer = payerAccount();
  if (!payer) throw new Error("DEMO_PAYER_PRIVATE_KEY missing");
  const relayer = relayerAccount();

  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = (`0x${randomBytes(32).toString("hex")}`) as Hex;
  const value = BigInt(amountAtomic);

  const typed = buildTransferWithAuthorizationTypedData({
    name: "Vouch USD",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: token,
    from: payer.address,
    to: merchant as Hex,
    value,
    validAfter: 0n,
    validBefore,
    nonce,
  });
  const signature = await payer.signTypedData(typed);

  const wallet = createWalletClient({ account: relayer, chain: galileo, transport: http(RPC) });
  const txHash = await wallet.writeContract({
    address: token,
    abi: ATOKEN_ABI,
    functionName: "transferWithAuthorization",
    args: [payer.address, merchant as Hex, value, 0n, validBefore, nonce, signature],
  });

  return { txHash, explorerUrl: `${EXPLORER}/tx/${txHash}`, payer: payer.address };
}
