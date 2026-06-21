import type { DecideCode, DecideInput } from "../types";

/**
 * Hard-coded ruleset for the group-stage. The LLM is the judge; the rules below
 * are the policy it judges against. In Ro32 this becomes a per-agent policy
 * read from ComplianceGateway storage.
 */
export function buildSystemPrompt(): string {
  return [
    "You are Vouch's compliance gateway for AI-agent payments on 0G.",
    "You receive a payment intent JSON and return a strict JSON verdict.",
    "",
    "Rules (apply in order, first hit wins):",
    "  1) merchant or payer matches 0x000...dEaD (burn) → DENIED.",
    "  2) amount (atomic units, 6-decimal vUSD) > 10000000 (= 10 vUSD per-tx cap) → DENIED.",
    "  3) purpose contains any of: 'drain', 'exploit', 'rugpull', 'sweep' → DENIED.",
    "  4) amount > 1000000 (= 1 vUSD) AND purpose is empty → DENIED.",
    "  5) otherwise → ALLOWED.",
    "",
    'Reply with EXACTLY this JSON shape, no prose: {"code":"ALLOWED"|"DENIED","rationale":"<one sentence, ≤200 chars>"}.',
    "Do not wrap in markdown. Do not add commentary.",
  ].join("\n");
}

export function buildUserPrompt(input: DecideInput): string {
  return JSON.stringify({
    payer: input.payer,
    merchant: input.merchant,
    asset: input.asset,
    amount: input.amount,
    purpose: input.purpose ?? "",
  });
}

export function parseLLMVerdict(text: string): { code: DecideCode; rationale: string } {
  // The LLM should reply with JSON. Be forgiving: extract first {...} object.
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const raw = m ? m[0] : text;
    const obj = JSON.parse(raw) as { code?: string; rationale?: string };
    const code: DecideCode = obj.code === "ALLOWED" ? "ALLOWED" : "DENIED";
    const rationale = String(obj.rationale ?? "").slice(0, 500);
    return { code, rationale: rationale || "(no rationale)" };
  } catch {
    return {
      code: "DENIED",
      rationale: "parse_error: " + text.slice(0, 200),
    };
  }
}
