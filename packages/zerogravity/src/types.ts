/**
 * ZGComputeClient - the single swappable seam for the compliance decision.
 * Live mode hits the 0G Compute broker (TEE-attested LLM inference). Mock
 * mode is deterministic for tests and offline dev.
 *
 * Shape mirrors the donor CleanverseClient pattern (live + mock split) so
 * the middleware integration point stays familiar.
 */

export type ZGMode = "live" | "mock";

export interface DecideInput {
  /** payer EOA */
  payer: string;
  /** merchant recipient EOA */
  merchant: string;
  /** A-Token ERC-20 address being moved */
  asset: string;
  /** atomic-units amount as a decimal string */
  amount: string;
  /** optional agent-supplied free-text intent */
  purpose?: string;
  /** lowercase chain slug, e.g. "0g-galileo" */
  chain: string;
  /** EVM chain id, e.g. 16602 */
  network: number;
}

export type DecideCode =
  | "ALLOWED"
  | "DENIED"
  /** reserved for Phase 2 human-in-the-loop; treated as DENIED in group-stage */
  | "ESCALATE";

export interface AttestationProof {
  /** broker provider EOA that served the inference */
  providerAddress: string;
  /** broker-issued chat id (from completion.id) */
  chatId: string;
  /** result of broker.inference.processResponse(...) */
  verified: boolean;
  verifiabilityKind: "TeeML" | "mock";
  /** request headers from broker.inference.getRequestHeaders, captured for client re-verify */
  rawHeaders?: Record<string, string>;
}

export interface DecideResult {
  code: DecideCode;
  /** convenience: code === "ALLOWED" && attestation.verified */
  allowed: boolean;
  /** LLM (or mock) reasoning, ≤500 chars */
  rationale: string;
  /** keccak256 over canonical(input) + rationale */
  decisionHash: string;
  attestation: AttestationProof;
  /** populated after 0G Storage write + ComplianceGateway.recordDecision */
  storedAt?: { storageRoot: string; gatewayTxHash?: string };
}

export interface ZGComputeClient {
  readonly mode: ZGMode;
  decide(input: DecideInput): Promise<DecideResult>;
  /**
   * Re-run attestation verification against the broker (or the mock).
   * Used by the explorer "Verify" button so anyone can re-check honesty
   * without trusting the merchant's recorded receipt.
   *
   * Returns null when the verification cannot be performed (e.g. live mode
   * without the original content). Returns true/false from processResponse.
   */
  verifyAttestation(
    providerAddress: string,
    chatId: string,
    content?: string,
  ): Promise<boolean | null>;
}
