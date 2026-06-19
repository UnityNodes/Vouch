import { z } from "zod";

export type SettlementStatus = "SUCCESS" | "BLOCKED" | "FAILED";

/**
 * Travel Rule receipt. AgentCheckout generates this JSON from the verified
 * A-Pass identity + payment. When a settlement tx exists, we also attach the
 * OFFICIAL Cleanverse Travel-Rule PDF retrieved via `download_travel_rule`.
 */
export const TravelRuleReceiptSchema = z.object({
  required: z.boolean(),
  ruleVersion: z.string(),
  originator: z.object({
    address: z.string(),
    name: z.string().optional(),
    apassPrincipal: z.string().optional(),
  }),
  beneficiary: z.object({
    address: z.string(),
    name: z.string().optional(),
  }),
  asset: z.string(),
  amount: z.string(),
  amountUsd: z.string().optional(),
  generatedAt: z.string(),
  /** Official Cleanverse Travel-Rule PDF (download_travel_rule), when available */
  officialReportUrl: z.string().optional(),
  officialReportFile: z.string().optional(),
});
export type TravelRuleReceipt = z.infer<typeof TravelRuleReceiptSchema>;

export const ReceiptRecordSchema = z.object({
  id: z.string(),
  ts: z.string(),
  resource: z.string(),
  payer: z.string(),
  apass: z.object({
    verified: z.boolean(),
    code: z.number().optional(),
    tier: z.string().optional(),
    principal: z.string().optional(),
    magicLink: z.string().optional(),
  }),
  compliance: z.object({
    ok: z.boolean(),
    reason: z.string().optional(),
  }),
  travelRule: TravelRuleReceiptSchema.nullable(),
  payment: z.object({
    asset: z.string(),
    amount: z.string(),
    network: z.string(),
  }),
  settlement: z.object({
    status: z.enum(["SUCCESS", "BLOCKED", "FAILED"]),
    txHash: z.string().optional(),
    explorerUrl: z.string().optional(),
  }),
});
export type ReceiptRecord = z.infer<typeof ReceiptRecordSchema>;

export const ComplianceBundleSchema = z.object({
  bundleVersion: z.literal(1),
  merchant: z.object({ address: z.string(), name: z.string() }),
  generatedAt: z.string(),
  network: z.object({ name: z.string(), chainId: z.number(), explorer: z.string() }),
  summary: z.object({
    total: z.number(),
    succeeded: z.number(),
    blocked: z.number(),
    travelRuleCount: z.number(),
  }),
  receipts: z.array(ReceiptRecordSchema),
});
export type ComplianceBundle = z.infer<typeof ComplianceBundleSchema>;

export function buildComplianceBundle(
  merchant: { address: string; name: string },
  network: { name: string; chainId: number; explorer: string },
  receipts: ReceiptRecord[],
  generatedAt: string,
): ComplianceBundle {
  return {
    bundleVersion: 1,
    merchant,
    generatedAt,
    network,
    summary: {
      total: receipts.length,
      succeeded: receipts.filter((r) => r.settlement.status === "SUCCESS").length,
      blocked: receipts.filter((r) => r.settlement.status === "BLOCKED").length,
      travelRuleCount: receipts.filter((r) => r.travelRule !== null).length,
    },
    receipts,
  };
}
