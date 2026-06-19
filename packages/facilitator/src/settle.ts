import {
  ATOKEN_ABI,
  type PaymentPayload,
  type PaymentRequirements,
  type SettleResponse,
} from "@agentcheckout/shared";
import type { FacilitatorClients } from "./viem";

/** Settle a verified payment on-chain and return the real txHash. */
export async function settlePayment(
  clients: FacilitatorClients,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  const network = requirements.network;

  // direct: broadcast the payer's pre-signed raw transfer (payer paid gas)
  if (payload.scheme === "direct") {
    const signedTx = payload.payload?.signedTransaction;
    if (!signedTx) return { success: false, errorReason: "malformed_payload", transaction: "", network };
    try {
      const hash = await clients.publicClient.sendRawTransaction({
        serializedTransaction: signedTx as `0x${string}`,
      });
      const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
      return {
        success: receipt.status === "success",
        transaction: hash,
        network,
        payer: payload.payload?.from,
        errorReason: receipt.status === "success" ? undefined : "transaction_reverted",
      };
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      return {
        success: false,
        errorReason: "settle_failed",
        errorMessage: err.shortMessage ?? err.message ?? String(e),
        transaction: "",
        network,
        payer: payload.payload?.from,
      };
    }
  }

  // exact: relay the EIP-3009 authorization from the facilitator's hot wallet (gasless for payer)
  if (!clients.walletClient || !clients.account) {
    return { success: false, errorReason: "no_facilitator_wallet", transaction: "", network };
  }
  const auth = payload.payload.authorization;
  if (!auth || !payload.payload.signature) {
    return { success: false, errorReason: "malformed_payload", transaction: "", network };
  }

  try {
    const hash = await clients.walletClient.writeContract({
      account: clients.account,
      chain: clients.walletClient.chain,
      address: requirements.asset as `0x${string}`,
      abi: ATOKEN_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from as `0x${string}`,
        auth.to as `0x${string}`,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce as `0x${string}`,
        payload.payload.signature as `0x${string}`,
      ],
    });

    const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
    return {
      success: receipt.status === "success",
      transaction: hash,
      network,
      payer: auth.from,
      errorReason: receipt.status === "success" ? undefined : "transaction_reverted",
    };
  } catch (e) {
    const err = e as { shortMessage?: string; message?: string };
    return {
      success: false,
      errorReason: "settle_failed",
      errorMessage: err.shortMessage ?? err.message ?? String(e),
      transaction: "",
      network,
      payer: auth.from,
    };
  }
}
