import { keccak256, toUtf8Bytes } from "ethers";
import type {
  AttestationProof,
  DecideCode,
  DecideInput,
  DecideResult,
  ZGComputeClient,
} from "../types.js";

/** Deterministic policy for offline dev + e2e. Matches the rules the live LLM is prompted with. */
const DENY_ADDRESSES = new Set<string>([
  "0x000000000000000000000000000000000000dead",
]);
const MAX_AMOUNT_ATOMIC = 10_000_000n; // 10 acUSD (6-dec)
const PURPOSE_REQUIRED_OVER = 1_000_000n; // 1 acUSD
const SUSPICIOUS_PURPOSE = /\b(drain|exploit|rugpull|sweep)\b/i;

function makeChatId(): string {
  // mock id; live mode uses completion.id from broker
  return "mock-" + Math.floor((1 + Math.random()) * 0x1_0000_0000).toString(16).slice(1);
}

export class MockZGComputeClient implements ZGComputeClient {
  readonly mode = "mock" as const;

  async decide(input: DecideInput): Promise<DecideResult> {
    const amount = BigInt(input.amount);
    const purpose = input.purpose ?? "";

    let code: DecideCode = "ALLOWED";
    let rationale: string;
    if (DENY_ADDRESSES.has(input.merchant.toLowerCase()) || DENY_ADDRESSES.has(input.payer.toLowerCase())) {
      code = "DENIED";
      rationale = `MOCK DENY: payer/merchant on burn/deny-list.`;
    } else if (amount > MAX_AMOUNT_ATOMIC) {
      code = "DENIED";
      rationale = `MOCK DENY: amount ${amount} > per-tx cap ${MAX_AMOUNT_ATOMIC}.`;
    } else if (SUSPICIOUS_PURPOSE.test(purpose)) {
      code = "DENIED";
      rationale = `MOCK DENY: purpose matches suspicious pattern "${purpose.slice(0, 60)}".`;
    } else if (amount > PURPOSE_REQUIRED_OVER && !purpose) {
      code = "DENIED";
      rationale = `MOCK DENY: amount ${amount} requires non-empty purpose.`;
    } else {
      rationale = `MOCK ALLOW: payer ${input.payer.slice(0, 10)} → merchant ${input.merchant.slice(0, 10)}, amount ${amount} within policy.`;
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
}
