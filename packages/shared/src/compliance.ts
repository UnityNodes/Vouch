import { z } from "zod";

export type SettlementStatus = "SUCCESS" | "BLOCKED" | "FAILED";

/**
 * AttestationRef — the verifiable proof that the compliance LLM ran inside a
 * TEE and produced THIS output for THIS input. Persisted on every receipt so
 * anyone can re-verify after the fact by calling broker.inference.processResponse.
 */
export const AttestationRefSchema = z.object({
  providerAddress: z.string(),
  chatId: z.string(),
  verified: z.boolean(),
  verifiabilityKind: z.enum(["TeeML", "mock"]),
});
export type AttestationRef = z.infer<typeof AttestationRefSchema>;

/**
 * Pointer into 0G Storage where the full decision blob lives. The 32-byte
 * rootHash is also written to ComplianceGateway on-chain for cheap proof.
 */
export const StorageRefSchema = z.object({
  storageRoot: z.string(),
  uploadTxHash: z.string().optional(),
  gatewayTxHash: z.string().optional(),
});
export type StorageRef = z.infer<typeof StorageRefSchema>;

export const ReceiptRecordSchema = z.object({
  id: z.string(),
  ts: z.string(),
  resource: z.string(),
  payer: z.string(),
  /** TEE attestation of the compliance decision */
  attestation: AttestationRefSchema,
  /** LLM verdict + reasoning */
  compliance: z.object({
    allowed: z.boolean(),
    code: z.enum(["ALLOWED", "DENIED", "ESCALATE"]),
    rationale: z.string(),
    decisionHash: z.string(),
    reason: z.string().optional(),
  }),
  /** 0G Storage + ComplianceGateway pointers (null when not yet persisted) */
  storage: StorageRefSchema.nullable(),
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
  bundleVersion: z.literal(2),
  merchant: z.object({ address: z.string(), name: z.string() }),
  generatedAt: z.string(),
  network: z.object({ name: z.string(), chainId: z.number(), explorer: z.string() }),
  summary: z.object({
    total: z.number(),
    succeeded: z.number(),
    blocked: z.number(),
    attestedTeeML: z.number(),
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
    bundleVersion: 2,
    merchant,
    generatedAt,
    network,
    summary: {
      total: receipts.length,
      succeeded: receipts.filter((r) => r.settlement.status === "SUCCESS").length,
      blocked: receipts.filter((r) => r.settlement.status === "BLOCKED").length,
      attestedTeeML: receipts.filter((r) => r.attestation.verifiabilityKind === "TeeML" && r.attestation.verified).length,
    },
    receipts,
  };
}
