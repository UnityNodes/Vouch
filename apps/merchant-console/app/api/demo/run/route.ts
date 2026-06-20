/**
 * Self-contained demo runner for the hosted Vouch explorer.
 *
 * Generates a synthetic payment intent (paid or blocked), runs it through the
 * shared MockZGComputeClient, and records a receipt directly in the in-memory
 * store. No demo-merchant required, no chain required - perfect for a
 * Vercel/Ubuntu single-process deployment.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { GALILEO_TESTNET } from "@agentcheckout/shared";
import type { ReceiptRecord } from "@agentcheckout/shared";
import { getVouchState } from "../../../../lib/zg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomAddress(): `0x${string}` {
  return `0x${randomBytes(20).toString("hex")}` as `0x${string}`;
}

function fakeTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

const MERCHANT =
  (process.env.MERCHANT_ADDRESS as `0x${string}` | undefined) ?? randomAddress();
const ZG_ASSET =
  (process.env.GALILEO_ATOKEN_ADDRESS as `0x${string}` | undefined) ??
  ("0x0000000000000000000000000000000000000000" as const);

export async function POST(req: Request) {
  const { mode } = (await req.json().catch(() => ({ mode: "success" }))) as {
    mode?: "success" | "blocked";
  };
  const { zg, store } = getVouchState();
  const payer = randomAddress();

  // Blocked path: large amount triggers the mock per-tx cap (10 vUSD).
  // Paid path: 0.05 vUSD within policy.
  const amount = mode === "blocked" ? "99999999999" : "50000";
  const purpose = mode === "blocked" ? "drain treasury" : "premium-data fetch";

  const decision = await zg.decide({
    payer,
    merchant: MERCHANT,
    asset: ZG_ASSET,
    amount,
    purpose,
    chain: GALILEO_TESTNET.slug,
    network: GALILEO_TESTNET.chainId,
  });

  const explorerBase = GALILEO_TESTNET.explorerUrl;
  const settlementStatus = decision.allowed ? "SUCCESS" : "BLOCKED";
  const txHash = decision.allowed ? fakeTxHash() : undefined;

  const receipt: ReceiptRecord = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    resource: `https://demo.vouch/premium-data`,
    payer,
    attestation: {
      providerAddress: decision.attestation.providerAddress,
      chatId: decision.attestation.chatId,
      verified: decision.attestation.verified,
      verifiabilityKind: decision.attestation.verifiabilityKind,
    },
    compliance: {
      allowed: decision.allowed,
      code: decision.code,
      rationale: decision.rationale,
      decisionHash: decision.decisionHash,
      ...(decision.allowed ? {} : { reason: "compliance_denied" }),
    },
    storage: null,
    payment: {
      asset: "vUSD",
      amount,
      network: GALILEO_TESTNET.slug,
    },
    settlement: {
      status: settlementStatus,
      txHash,
      explorerUrl: txHash ? `${explorerBase.replace(/\/$/, "")}/tx/${txHash}` : undefined,
    },
  };

  await store.append(receipt);

  return NextResponse.json({
    ok: true,
    mode,
    receipt: {
      id: receipt.id,
      status: receipt.settlement.status,
      code: receipt.compliance.code,
      rationale: receipt.compliance.rationale,
      txHash,
    },
  });
}
