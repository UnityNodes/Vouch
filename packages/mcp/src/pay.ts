import { randomBytes } from "node:crypto";
import { createPublicClient, defineChain, encodeFunctionData, http, type LocalAccount } from "viem";
import {
  APASS_HEADER,
  ATOKEN_ABI,
  MONAD_TESTNET,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  buildTransferWithAuthorizationTypedData,
  decodeBase64Json,
  encodeApass,
  encodePayment,
  explorerTxUrl,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
} from "@agentcheckout/shared";

export interface PayAndCallResult {
  paid: boolean;
  status: number;
  scheme?: string;
  data?: unknown;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  apassCode?: number;
  magicLink?: string;
  requirements?: PaymentRequirements;
}

function randomNonce(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}`;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/**
 * Buyer-side x402 loop: GET -> 402 -> build payment for the advertised scheme
 * (exact = sign EIP-3009 authorization; direct = sign a raw ERC-20 transfer) ->
 * retry with X-PAYMENT + X-APASS -> read settlement from X-PAYMENT-RESPONSE.
 */
export async function payAndCall(opts: {
  url: string;
  account: LocalAccount;
  maxAmount?: bigint;
  rpcUrl?: string;
  explorerUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<PayAndCallResult> {
  const f = opts.fetchImpl ?? fetch;

  let res = await f(opts.url);
  if (res.status !== 402) {
    return { paid: false, status: res.status, data: await safeJson(res) };
  }

  const body = (await res.json()) as PaymentRequired;
  const req = body.accepts?.[0];
  if (!req) return { paid: false, status: 402, error: "no_requirements" };

  const amount = BigInt(req.maxAmountRequired);
  if (opts.maxAmount !== undefined && amount > opts.maxAmount) {
    return { paid: false, status: 402, error: "amount_exceeds_max", requirements: req };
  }

  let payload: PaymentPayload;
  try {
    payload =
      req.scheme === "direct"
        ? await buildDirectPayload(req, amount, opts)
        : await buildExactPayload(req, amount, opts.account);
  } catch (e) {
    return { paid: false, status: 402, error: `sign_failed: ${(e as Error).message}`, requirements: req };
  }

  res = await f(opts.url, {
    headers: {
      [PAYMENT_HEADER]: encodePayment(payload),
      [APASS_HEADER]: encodeApass({ version: 1, chain: req.network, address: opts.account.address }),
    },
  });

  if (res.status === 200) {
    const xpr = res.headers.get(PAYMENT_RESPONSE_HEADER);
    const settle = xpr ? decodeBase64Json<SettleResponse>(xpr) : undefined;
    const txHash = settle?.transaction;
    return {
      paid: true,
      status: 200,
      scheme: req.scheme,
      data: await safeJson(res),
      txHash,
      explorerUrl: txHash ? explorerTxUrl(txHash, opts.explorerUrl) : undefined,
      requirements: req,
    };
  }

  const errBody = (await safeJson(res)) as
    | { error?: string; apassCode?: number; magicLink?: string }
    | undefined;
  return {
    paid: false,
    status: res.status,
    scheme: req.scheme,
    error: errBody?.error,
    apassCode: errBody?.apassCode,
    magicLink: errBody?.magicLink,
    requirements: req,
  };
}

async function buildExactPayload(
  req: PaymentRequirements,
  amount: bigint,
  account: LocalAccount,
): Promise<PaymentPayload> {
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + (req.maxTimeoutSeconds ?? 120));
  const nonce = randomNonce();

  const typed = buildTransferWithAuthorizationTypedData({
    name: req.extra?.name ?? "",
    version: req.extra?.version ?? "1",
    chainId: req.chainId ?? 0,
    verifyingContract: req.asset as `0x${string}`,
    from: account.address,
    to: req.payTo as `0x${string}`,
    value: amount,
    validAfter,
    validBefore,
    nonce,
  });

  const signature = await account.signTypedData({
    domain: typed.domain,
    types: typed.types,
    primaryType: typed.primaryType,
    message: typed.message,
  });

  return {
    x402Version: 1,
    scheme: "exact",
    network: req.network,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: req.payTo,
        value: amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
}

async function buildDirectPayload(
  req: PaymentRequirements,
  amount: bigint,
  opts: { account: LocalAccount; rpcUrl?: string },
): Promise<PaymentPayload> {
  const rpcUrl = opts.rpcUrl ?? process.env.MONAD_RPC_URL ?? MONAD_TESTNET.defaultRpcUrl;
  const chainId = req.chainId ?? MONAD_TESTNET.chainId;
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });

  const data = encodeFunctionData({
    abi: ATOKEN_ABI,
    functionName: "transfer",
    args: [req.payTo as `0x${string}`, amount],
  });

  const request = await pub.prepareTransactionRequest({
    account: opts.account,
    to: req.asset as `0x${string}`,
    data,
    chain,
    // Fixed gas (skip estimation): a compliant A-Token transfer from a wallet
    // without a valid A-Pass reverts during estimateGas, which would fail before
    // the request ever reaches the gateway's identity gate. With a fixed limit the
    // payment is built and sent; the A-Pass gate then blocks it cleanly (and the
    // doomed tx is never broadcast). Unused gas is refunded for verified payers.
    gas: 500_000n,
  });
  const signedTransaction = await opts.account.signTransaction(request as never);

  return {
    x402Version: 1,
    scheme: "direct",
    network: req.network,
    payload: { signedTransaction, from: opts.account.address },
  };
}
