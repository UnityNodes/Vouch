import { keccak256, toUtf8Bytes } from "ethers";
import type {
  AttestationProof,
  DecideCode,
  DecideInput,
  DecideResult,
  ZGComputeClient,
} from "../types";

/**
 * Deterministic policy for offline dev + e2e. Constructor options let tests
 * inject a custom deny-list (e.g. the "blocked" agent in scripts/e2e.ts) so
 * the mock can stand in for any policy a TEE-attested LLM would enforce.
 *
 * Default rules match policy.ts (what the live LLM is prompted with), so a
 * mock-mode run and a live-mode run produce the same decision shape.
 */
const BURN = "0x000000000000000000000000000000000000dead";
const DEFAULT_MAX_AMOUNT = 10_000_000n; // 10 acUSD (6-dec)
const SUSPICIOUS_PURPOSE = /\b(drain|exploit|rugpull|sweep)\b/i;
const PURPOSE_REQUIRED_OVER = 1_000_000n; // 1 acUSD

export interface MockZGOptions {
  /** Lowercased addresses to always deny (covers the e2e "blocked agent"). */
  denyList?: string[];
  /** Per-tx cap (atomic units). Default 10 acUSD. */
  maxAmount?: bigint;
}

function makeChatId(): string {
  return "mock-" + Math.floor((1 + Math.random()) * 0x1_0000_0000).toString(16).slice(1);
}

export class MockZGComputeClient implements ZGComputeClient {
  readonly mode = "mock" as const;
  private readonly denyList: Set<string>;
  private readonly maxAmount: bigint;

  constructor(opts: MockZGOptions = {}) {
    this.denyList = new Set((opts.denyList ?? []).map((a) => a.toLowerCase()));
    this.denyList.add(BURN);
    this.maxAmount = opts.maxAmount ?? DEFAULT_MAX_AMOUNT;
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    const amount = BigInt(input.amount);
    const purpose = input.purpose ?? "";
    const payerLc = input.payer.toLowerCase();
    const merchantLc = input.merchant.toLowerCase();

    let code: DecideCode = "ALLOWED";
    let rationale: string;
    if (this.denyList.has(payerLc) || this.denyList.has(merchantLc)) {
      code = "DENIED";
      rationale = `Blocked - payer or merchant is on the policy deny-list.`;
    } else if (amount > this.maxAmount) {
      code = "DENIED";
      rationale = `Blocked - amount ${amount} is over the per-transaction limit of ${this.maxAmount}.`;
    } else if (SUSPICIOUS_PURPOSE.test(purpose)) {
      code = "DENIED";
      rationale = `Blocked - the stated purpose contains a forbidden keyword: "${purpose.slice(0, 60)}".`;
    } else if (amount > PURPOSE_REQUIRED_OVER && !purpose) {
      code = "DENIED";
      rationale = `Blocked - payments over ${PURPOSE_REQUIRED_OVER} must declare a purpose.`;
    } else {
      rationale = `Allowed - payer ${input.payer.slice(0, 10)}… is sending ${amount} to ${input.merchant.slice(0, 10)}…, all checks pass.`;
    }

    const decisionHash = keccak256(toUtf8Bytes(JSON.stringify(input) + "|" + rationale));
    const attestation: AttestationProof = {
      providerAddress: "0xMOCK",
      chatId: makeChatId(),
      verified: true,
      verifiabilityKind: "mock",
    };

    return {
      code,
      allowed: code === "ALLOWED" && attestation.verified,
      rationale,
      decisionHash,
      attestation,
    };
  }

  async verifyAttestation(
    _providerAddress: string,
    _chatId: string,
    _content?: string,
  ): Promise<boolean | null> {
    // Mock attestations are trivially valid (no TEE in the loop). The honesty
    // claim only carries weight under live mode; surfacing `true` here keeps
    // the UI consistent during local demos.
    return true;
  }
}
