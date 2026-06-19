import type { Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { parseUnits } from "viem";
import {
  decodeApass,
  decodePayment,
  encodeBase64Json,
  explorerTxUrl,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  APASS_HEADER,
  type PaymentPayload,
  type PaymentRequirements,
  type ReceiptRecord,
  type SettlementStatus,
  type TravelRuleReceipt,
} from "@agentcheckout/shared";
import type { ReceiptStore } from "@agentcheckout/shared/store";
import type { CleanverseClient } from "@agentcheckout/cleanverse";
import { buildRequirements, type AssetConfig, type RouteConfig } from "./buildRequirements";
import { makeFacilitatorClient } from "./facilitatorClient";

export interface AgentCheckoutConfig {
  /** merchant recipient address */
  payTo: `0x${string}`;
  facilitatorUrl: string;
  /** lowercase network slug, e.g. "monad" */
  network: string;
  chainId: number;
  asset: AssetConfig;
  /** map of "GET /path" (or "/path") -> route pricing */
  routes: Record<string, RouteConfig>;
  cleanverse: CleanverseClient;
  store?: ReceiptStore;
  merchantName?: string;
  explorerUrl?: string;
  maxTimeoutSeconds?: number;
  /** "exact" = EIP-3009 gasless (MockAToken); "direct" = signed raw transfer (real aUSDC) */
  settlementScheme?: "exact" | "direct";
  /** USD-equivalent threshold above which Travel Rule is flagged required (default 1000) */
  travelRuleThreshold?: number;
  /**
   * A-Token address used for the Cleanverse verify_apass identity check.
   * Defaults to asset.address. Set this to run a live identity gate against the
   * real A-Token while still settling a stand-in token (live verify + gasless mock).
   */
  verifyAToken?: `0x${string}`;
}

const matchRoute = (
  routes: Record<string, RouteConfig>,
  method: string,
  pathName: string,
): RouteConfig | undefined => routes[`${method} ${pathName}`] ?? routes[pathName];

function resourceUrl(req: Request): string {
  return `${req.protocol}://${req.get("host") ?? "localhost"}${req.originalUrl}`;
}

/** Build the AgentCheckout Express middleware: x402 + A-Pass identity + compliance. */
export function agentCheckout(config: AgentCheckoutConfig): RequestHandler {
  const facilitator = makeFacilitatorClient(config.facilitatorUrl);
  const maxTimeoutSeconds = config.maxTimeoutSeconds ?? 120;
  const explorer = config.explorerUrl;
  const thresholdAtomic = parseUnits(
    String(config.travelRuleThreshold ?? 1000),
    config.asset.decimals,
  );

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
    apass: { verified: false },
    compliance: { ok: false },
    travelRule: null,
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

    // decode payment + identity
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
    const xApass = req.header(APASS_HEADER);
    const apassProof = xApass ? safeDecodeApass(xApass) : undefined;

    // bind identity to payment
    if (apassProof && apassProof.address.toLowerCase() !== payer.toLowerCase()) {
      send402("apass_address_mismatch");
      return;
    }

    // a. A-Pass identity gate (the product thesis: identity verified before money moves)
    const verify = await config.cleanverse.verifyAPass({
      chain: config.network,
      atoken: config.verifyAToken ?? config.asset.address,
      address: payer,
    });
    if (!verify.allowed) {
      const r = baseReceipt(requirements, payer, "BLOCKED");
      r.apass = { verified: false, code: verify.code, magicLink: verify.magicLink };
      r.compliance = { ok: false, reason: verify.message ?? `apass_code_${verify.code}` };
      await record(r);
      // code 2 = no A-Pass (recoverable via magicLink) -> 402; code 3 = not allowed -> 403
      const status = verify.code === 2 ? 402 : 403;
      res.status(status).json({
        x402Version: 1,
        error: verify.code === 2 ? "apass_required" : "apass_not_allowed",
        reason: verify.message,
        apassCode: verify.code,
        magicLink: verify.magicLink,
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
      r.apass = { verified: true, code: verify.code };
      r.compliance = { ok: true };
      r.settlement = { status: "FAILED" };
      await record(r);
      send402(s.errorReason ?? "settlement_failed", { message: s.errorMessage });
      return;
    }

    // d. identity details + Travel-Rule receipt
    const apassInfo = await safeQueryAPass(config.cleanverse, config.network, payer);
    const travelRule = await buildTravelRuleReceipt({
      cleanverse: config.cleanverse,
      network: config.network,
      payer,
      payTo: config.payTo,
      merchantName: config.merchantName,
      assetSymbol: config.asset.symbol ?? requirements.asset,
      amount: requirements.maxAmountRequired,
      txHash: s.transaction,
      cvRecordId: apassInfo?.cvRecordId,
      required: BigInt(requirements.maxAmountRequired) >= thresholdAtomic,
    });

    const r = baseReceipt(requirements, payer, "SUCCESS");
    r.apass = {
      verified: true,
      code: verify.code,
      tier: apassInfo?.tier,
      principal: apassInfo?.cvRecordId,
    };
    r.compliance = { ok: true };
    r.travelRule = travelRule;
    r.settlement = {
      status: "SUCCESS",
      txHash: s.transaction,
      explorerUrl: s.transaction ? explorerTxUrl(s.transaction, explorer) : undefined,
    };
    await record(r);

    // e. hand the paid resource back to the merchant route
    res.setHeader(PAYMENT_RESPONSE_HEADER, encodeBase64Json(s));
    (res as Response & { locals: Record<string, unknown> }).locals.x402 = {
      settle: s,
      payer,
      apass: { ...verify, ...apassInfo },
      receiptId: r.id,
    };
    next();
  };
}

function safeDecodeApass(header: string) {
  try {
    return decodeApass(header);
  } catch {
    return undefined;
  }
}

async function safeQueryAPass(cleanverse: CleanverseClient, network: string, address: string) {
  try {
    return await cleanverse.queryAPass({ chain: network, address });
  } catch {
    return undefined;
  }
}

async function buildTravelRuleReceipt(args: {
  cleanverse: CleanverseClient;
  network: string;
  payer: string;
  payTo: string;
  merchantName?: string;
  assetSymbol: string;
  amount: string;
  txHash: string;
  cvRecordId?: string;
  required: boolean;
}): Promise<TravelRuleReceipt> {
  let official: { downloadUrl: string; fileName: string } | null = null;
  try {
    official = await args.cleanverse.downloadTravelRule({
      chain: args.network,
      address: args.payer,
      txHash: args.txHash,
      cvRecordId: args.cvRecordId,
    });
  } catch {
    official = null;
  }
  return {
    required: args.required,
    ruleVersion: "FATF-R16",
    originator: { address: args.payer, apassPrincipal: args.cvRecordId },
    beneficiary: { address: args.payTo, name: args.merchantName },
    asset: args.assetSymbol,
    amount: args.amount,
    generatedAt: new Date().toISOString(),
    officialReportUrl: official?.downloadUrl,
    officialReportFile: official?.fileName,
  };
}
