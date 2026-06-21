/**
 * Self-contained demo runner for the hosted Vouch explorer.
 *
 * Builds a synthetic payment intent (paid or blocked) and runs it through the
 * active ZGComputeClient. In live mode that is a real TEE-attested decision on
 * 0G Compute, anchored on-chain via ComplianceGateway so the receipt links to a
 * real Galileo transaction. In mock mode it is deterministic and offline.
 *
 * Robustness: if a live decide() throws mid-demo, we fall back to a mock
 * decision for that one request so the button never hard-breaks.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { GALILEO_TESTNET } from "@agentcheckout/shared";
import type { ReceiptRecord } from "@agentcheckout/shared";
import { MockZGComputeClient, uploadJsonToStorage } from "@agentcheckout/zerogravity";
import type { StorageRef } from "@agentcheckout/shared";
import { getVouchState } from "../../../../lib/zg";
import { anchorDecision } from "../../../../lib/anchor";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

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
  const { mode: scenario } = (await req.json().catch(() => ({ mode: "success" }))) as {
    mode?: "success" | "blocked";
  };
  const { zg, store, mode } = await getVouchState();
  const payer = randomAddress();

  // Blocked path: large amount + hostile purpose -> the judge denies.
  // Paid path: 0.05 vUSD within policy.
  const amount = scenario === "blocked" ? "99999999999" : "50000";
  const purpose = scenario === "blocked" ? "drain treasury" : "premium-data fetch";

  const input = {
    payer,
    merchant: MERCHANT,
    asset: ZG_ASSET,
    amount,
    purpose,
    chain: GALILEO_TESTNET.slug,
    network: GALILEO_TESTNET.chainId,
  };

  let decision;
  let effectiveMode = mode;
  try {
    decision = await zg.decide(input);
  } catch (e) {
    // never hard-break the demo: fall back to a mock decision for this request
    console.error("[vouch] live decide failed, mock fallback for this request:", (e as Error).message);
    decision = await new MockZGComputeClient().decide(input);
    effectiveMode = "mock";
  }

  const explorerBase = GALILEO_TESTNET.explorerUrl.replace(/\/$/, "");
  const settlementStatus = decision.allowed ? "SUCCESS" : "BLOCKED";

  // On-chain receipt: real for live (anchor decision to ComplianceGateway, even
  // when blocked), simulated for mock. Anchoring is best-effort.
  let txHash: string | undefined;
  let explorerUrl: string | undefined;
  if (effectiveMode === "live") {
    try {
      const anchored = await anchorDecision({
        payer,
        merchant: MERCHANT,
        amount,
        decisionHash: decision.decisionHash,
        allowed: decision.allowed,
      });
      txHash = anchored.txHash;
      explorerUrl = anchored.explorerUrl;
    } catch (e) {
      console.error("[vouch] on-chain anchor failed:", (e as Error).message);
    }
  } else if (decision.allowed) {
    txHash = fakeTxHash();
    explorerUrl = `${explorerBase}/tx/${txHash}`;
  }

  // 0G Storage: persist the full decision record and keep its content-addressed
  // root on the receipt. Best-effort and time-bounded so a slow testnet upload
  // never blocks the response.
  let storage: StorageRef | null = null;
  if (effectiveMode === "live" && process.env.ZG_STORAGE_MODE === "live") {
    try {
      const uploaded = await withTimeout(
        uploadJsonToStorage({ payer, merchant: MERCHANT, amount, purpose, decision }),
        25000,
      );
      if (uploaded.storageRoot) {
        storage = { storageRoot: uploaded.storageRoot, uploadTxHash: uploaded.uploadTxHash };
      }
    } catch (e) {
      console.error("[vouch] 0G Storage upload skipped:", (e as Error).message);
    }
  }

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
    storage,
    payment: {
      asset: "vUSD",
      amount,
      network: GALILEO_TESTNET.slug,
    },
    settlement: {
      status: settlementStatus,
      txHash,
      explorerUrl,
    },
  };

  await store.append(receipt);

  return NextResponse.json({
    ok: true,
    mode: effectiveMode,
    scenario,
    receipt: {
      id: receipt.id,
      status: receipt.settlement.status,
      code: receipt.compliance.code,
      rationale: receipt.compliance.rationale,
      verified: receipt.attestation.verified,
      txHash,
      storageRoot: storage?.storageRoot,
    },
  });
}
