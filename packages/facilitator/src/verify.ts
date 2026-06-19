import {
  recoverTypedDataAddress,
  recoverTransactionAddress,
  parseTransaction,
  decodeFunctionData,
  getAddress,
  type TransactionSerialized,
} from "viem";
import {
  ATOKEN_ABI,
  buildTransferWithAuthorizationTypedData,
  type PaymentPayload,
  type PaymentRequirements,
  type VerifyResponse,
} from "@agentcheckout/shared";
import type { FacilitatorClients } from "./viem";

/** Verify an x402 payment payload (exact = EIP-3009, direct = signed raw transfer). */
export async function verifyPayment(
  clients: FacilitatorClients,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  if (payload.scheme === "direct") return verifyDirect(clients, payload, requirements);
  if (payload.scheme !== "exact") return { isValid: false, invalidReason: "unsupported_scheme" };
  return verifyExact(clients, payload, requirements);
}

/* exact: EIP-3009 TransferWithAuthorization */
async function verifyExact(
  clients: FacilitatorClients,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const auth = payload.payload?.authorization;
  const signature = payload.payload?.signature;
  if (!auth || !signature) return { isValid: false, invalidReason: "malformed_payload" };

  const chainId = requirements.chainId ?? clients.chainId;
  const name = requirements.extra?.name ?? "";
  const version = requirements.extra?.version ?? "1";

  let recovered: string;
  try {
    const typed = buildTransferWithAuthorizationTypedData({
      name,
      version,
      chainId,
      verifyingContract: requirements.asset as `0x${string}`,
      from: auth.from as `0x${string}`,
      to: auth.to as `0x${string}`,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce as `0x${string}`,
    });
    recovered = await recoverTypedDataAddress({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return { isValid: false, invalidReason: "invalid_signature", payer: auth.from };
  }
  if (getAddress(recovered) !== getAddress(auth.from)) {
    return { isValid: false, invalidReason: "signature_mismatch", payer: auth.from };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= Number(auth.validAfter)) return { isValid: false, invalidReason: "not_yet_valid", payer: auth.from };
  if (now >= Number(auth.validBefore)) return { isValid: false, invalidReason: "authorization_expired", payer: auth.from };

  if (getAddress(auth.to) !== getAddress(requirements.payTo)) {
    return { isValid: false, invalidReason: "recipient_mismatch", payer: auth.from };
  }
  if (BigInt(auth.value) < BigInt(requirements.maxAmountRequired)) {
    return { isValid: false, invalidReason: "insufficient_value", payer: auth.from };
  }

  const bal = await readBalance(clients, requirements.asset, auth.from);
  if (bal !== null && bal < BigInt(auth.value)) {
    return { isValid: false, invalidReason: "insufficient_balance", payer: auth.from };
  }
  try {
    const used = (await clients.publicClient.readContract({
      address: requirements.asset as `0x${string}`,
      abi: ATOKEN_ABI,
      functionName: "authorizationState",
      args: [auth.from as `0x${string}`, auth.nonce as `0x${string}`],
    })) as boolean;
    if (used) return { isValid: false, invalidReason: "authorization_used", payer: auth.from };
  } catch {
    /* plain ERC20 may not expose authorizationState */
  }
  return { isValid: true, payer: auth.from };
}

/* direct: a signed raw ERC-20 transfer the facilitator will broadcast */
async function verifyDirect(
  clients: FacilitatorClients,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const signedTx = payload.payload?.signedTransaction;
  const claimedFrom = payload.payload?.from;
  if (!signedTx || !claimedFrom) return { isValid: false, invalidReason: "malformed_payload" };

  let parsed: ReturnType<typeof parseTransaction>;
  let sender: string;
  try {
    const serialized = signedTx as TransactionSerialized;
    parsed = parseTransaction(serialized);
    sender = await recoverTransactionAddress({ serializedTransaction: serialized });
  } catch {
    return { isValid: false, invalidReason: "invalid_signed_tx", payer: claimedFrom };
  }

  if (getAddress(sender) !== getAddress(claimedFrom)) {
    return { isValid: false, invalidReason: "signer_mismatch", payer: claimedFrom };
  }
  if (!parsed.to || getAddress(parsed.to) !== getAddress(requirements.asset)) {
    return { isValid: false, invalidReason: "wrong_asset", payer: claimedFrom };
  }
  const chainId = requirements.chainId ?? clients.chainId;
  if (parsed.chainId !== undefined && parsed.chainId !== chainId) {
    return { isValid: false, invalidReason: "wrong_chain", payer: claimedFrom };
  }

  let to: string;
  let value: bigint;
  try {
    const decoded = decodeFunctionData({ abi: ATOKEN_ABI, data: (parsed.data ?? "0x") as `0x${string}` });
    if (decoded.functionName !== "transfer") {
      return { isValid: false, invalidReason: "not_a_transfer", payer: claimedFrom };
    }
    const args = decoded.args as readonly [string, bigint];
    to = args[0];
    value = args[1];
  } catch {
    return { isValid: false, invalidReason: "undecodable_calldata", payer: claimedFrom };
  }

  if (getAddress(to) !== getAddress(requirements.payTo)) {
    return { isValid: false, invalidReason: "recipient_mismatch", payer: claimedFrom };
  }
  if (value < BigInt(requirements.maxAmountRequired)) {
    return { isValid: false, invalidReason: "insufficient_value", payer: claimedFrom };
  }

  const bal = await readBalance(clients, requirements.asset, claimedFrom);
  if (bal !== null && bal < value) {
    return { isValid: false, invalidReason: "insufficient_balance", payer: claimedFrom };
  }
  return { isValid: true, payer: claimedFrom };
}

async function readBalance(
  clients: FacilitatorClients,
  asset: string,
  owner: string,
): Promise<bigint | null> {
  try {
    return (await clients.publicClient.readContract({
      address: asset as `0x${string}`,
      abi: ATOKEN_ABI,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    })) as bigint;
  } catch {
    return null;
  }
}
