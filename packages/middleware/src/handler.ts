import type { Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { parseUnits } from "viem";
import {
  decodePayment,
  encodeBase64Json,
  explorerTxUrl,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentPayload,
  type PaymentRequirements,
  type ReceiptRecord,
  type SettlementStatus,
} from "@agentcheckout/shared";
import type { ReceiptStore } from "@agentcheckout/shared/store";
import type { ZGComputeClient } from "@agentcheckout/zerogravity";
import { buildRequirements, type AssetConfig, type RouteConfig } from "./buildRequirements";
import { makeFacilitatorClient } from "./facilitatorClient";

/**
 * agentCheckoutConfig — the merchant's one-line integration point.
 *
 * The compliance gate (the product thesis) is the call to `zg.decide(...)`:
 * an LLM running in a 0G Compute TEE evaluates the payment intent against a
 * policy and returns a verifiable attestation. The receipt persists both the
 * verdict AND the attestation proof so anyone can re-verify later.
 */
export interface AgentCheckoutConfig {
  payTo: `0x${string}`;
  facilitatorUrl: string;
  /** lowercase network slug, e.g. "0g-galileo" */
  network: string;
  chainId: number;
  asset: AssetConfig;
  /** map of "GET /path" (or "/path") -> route pricing */
  routes: Record<string, RouteConfig>;
  /** the TEE-attested compliance client (live broker or deterministic mock) */
  zg: ZGComputeClient;
  store?: ReceiptStore;
  merchantName?: string;
  explorerUrl?: string;
  maxTimeoutSeconds?: number;
  /** "exact" = EIP-3009 gasless; "direct" = signed raw transfer */
  settlementScheme?: "exact" | "direct";
}

const matchRoute = (
  routes: Record<string, RouteConfig>,
  method: string,
  pathName: string,
): RouteConfig | undefined => routes[`${method} ${pathName}`] ?? routes[pathName];

function resourceUrl(req: Request): string {
  return `${req.protocol}://${req.get("host") ?? "localhost"}${req.originalUrl}`;
}

/** Build the AgentCheckout Express middleware: x402 + TEE-attested compliance + settlement. */
export function agentCheckout(config: AgentCheckoutConfig): RequestHandler {
  const facilitator = makeFacilitatorClient(config.facilitatorUrl);
  const maxTimeoutSeconds = config.maxTimeoutSeconds ?? 120;
  const explorer = config.explorerUrl;

  const record = async (r: ReceiptRecord) => {
    if (config.store) {
      try {
        await config.store.append(r);
      } catch {
        /* never let receipt persistence break the response */
      }
    }
  };

  const baseReceipt = (
    requirements: PaymentRequirements,
    payer: string,
    status: SettlementStatus,
  ): ReceiptRecord => ({
    id: randomUUID(),
    ts: new Date().toISOString(),
    resource: requirements.resource,
    payer,
    attestation: {
      providerAddress: "",
      chatId: "",
      verified: false,
      verifiabilityKind: "mock",
    },
    compliance: {
      allowed: false,
      code: "DENIED",
      rationale: "",
      decisionHash: "",
    },
    storage: null,
    payment: {
      asset: config.asset.symbol ?? requirements.asset,
      amount: requirements.maxAmountRequired,
      network: config.network,
    },
    settlement: { status },
  });

  return async (req, res, next) => {
    const route = matchRoute(config.routes, req.method, req.path);
    if (!route) return next();

    const requirements = buildRequirements({
      network: config.network,
      chainId: config.chainId,
      payTo: config.payTo,
      asset: config.asset,
      route,
      resource: resourceUrl(req),
      maxTimeoutSeconds,
      scheme: config.settlementScheme ?? "exact",
    });

    const send402 = (error: string, extra?: Record<string, unknown>) =>
      res.status(402).json({ x402Version: 1, error, accepts: [requirements], ...extra });

    // 0. no payment yet -> advertise requirements
    const xPayment = req.header(PAYMENT_HEADER);
    if (!xPayment) {
      send402("payment_required");
      return;
    }

    // decode payment
    let payload: PaymentPayload;
    try {
      payload = decodePayment(xPayment);
    } catch {
      send402("malformed_payment_header");
      return;
    }
    const payer =
      payload.scheme === "direct"
        ? (payload.payload?.from ?? "")
        : (payload.payload?.authorization?.from ?? "");
    if (!payer) {
      send402("malformed_payment_header");
      return;
    }

    // a. compliance gate — TEE-attested LLM verdict (the product thesis)
    const decision = await config.zg.decide({
      payer,
      merchant: config.payTo,
      asset: config.asset.address,
      amount: requirements.maxAmountRequired,
      purpose: (req.header("X-AGENT-PURPOSE") ?? req.header("x-agent-purpose")) ?? undefined,
      chain: config.network,
      network: config.chainId,
    });

    const fillDecision = (r: ReceiptRecord) => {
      r.attestation = {
        providerAddress: decision.attestation.providerAddress,
        chatId: decision.attestation.chatId,
        verified: decision.attestation.verified,
        verifiabilityKind: decision.attestation.verifiabilityKind,
      };
      r.compliance = {
        allowed: decision.allowed,
        code: decision.code,
        rationale: decision.rationale,
        decisionHash: decision.decisionHash,
      };
    };

    if (!decision.allowed) {
      const r = baseReceipt(requirements, payer, "BLOCKED");
      fillDecision(r);
      r.compliance.reason = decision.attestation.verified
        ? "compliance_denied"
        : "attestation_failed";
      await record(r);
      res.status(403).json({
        x402Version: 1,
        error: r.compliance.reason,
        rationale: decision.rationale,
        decisionHash: decision.decisionHash,
        attestation: {
          providerAddress: decision.attestation.providerAddress,
          chatId: decision.attestation.chatId,
          verified: decision.attestation.verified,
          verifiabilityKind: decision.attestation.verifiabilityKind,
        },
        accepts: [requirements],
      });
      return;
    }

    // b. facilitator verifies the signed authorization
    const v = await facilitator.verify(payload, requirements);
    if (!v.isValid) {
      send402(v.invalidReason ?? "payment_invalid");
      return;
    }

    // c. settle on-chain (real A-Token transfer -> txHash)
    const s = await facilitator.settle(payload, requirements);
    if (!s.success) {
      const r = baseReceipt(requirements, payer, "FAILED");
      fillDecision(r);
      r.settlement = { status: "FAILED" };
      await record(r);
      send402(s.errorReason ?? "settlement_failed", { message: s.errorMessage });
      return;
    }

    const r = baseReceipt(requirements, payer, "SUCCESS");
    fillDecision(r);
    r.settlement = {
      status: "SUCCESS",
      txHash: s.transaction,
      explorerUrl: s.transaction ? explorerTxUrl(s.transaction, explorer) : undefined,
    };
    await record(r);

    // d. hand the paid resource back to the merchant route
    res.setHeader(PAYMENT_RESPONSE_HEADER, encodeBase64Json(s));
    (res as Response & { locals: Record<string, unknown> }).locals.x402 = {
      settle: s,
      payer,
      decision: {
        code: decision.code,
        rationale: decision.rationale,
        attestation: decision.attestation,
      },
      receiptId: r.id,
    };
    next();
  };
}
