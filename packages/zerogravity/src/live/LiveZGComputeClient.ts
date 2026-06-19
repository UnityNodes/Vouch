import { keccak256, toUtf8Bytes } from "ethers";
import type {
  AttestationProof,
  DecideInput,
  DecideResult,
  ZGComputeClient,
} from "../types.js";
import {
  ensureLedger,
  ensureProviderFunded,
  getBroker,
  pickTeeProvider,
} from "./broker.js";
import { buildSystemPrompt, buildUserPrompt, parseLLMVerdict } from "./policy.js";

/**
 * Live ZGComputeClient — runs the compliance verdict on a TeeML-verifiable
 * provider via the 0G Compute broker, then verifies the attestation with
 * `broker.inference.processResponse()`. The `verified` boolean it returns is
 * THE load-bearing claim of the whole product.
 *
 * Constructor flow runs once per process:
 *   addLedger(3) [first time only] → pick TeeML provider → acknowledge → transferFund 1 OG.
 *
 * decide() flow per request:
 *   getServiceMetadata → getRequestHeaders → POST /chat/completions →
 *   processResponse(provider, chatId, content) → returns AttestationProof.
 */
export class LiveZGComputeClient implements ZGComputeClient {
  readonly mode = "live" as const;

  private constructor(private readonly providerAddress: string) {}

  static async create(): Promise<LiveZGComputeClient> {
    await ensureLedger();
    const providerAddress = await pickTeeProvider();
    await ensureProviderFunded(providerAddress);
    return new LiveZGComputeClient(providerAddress);
  }

  async decide(input: DecideInput): Promise<DecideResult> {
    const broker = await getBroker();

    const { endpoint, model } = await broker.inference.getServiceMetadata(this.providerAddress);

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input) },
    ];
    const billedContent = JSON.stringify(messages);

    const rawHeaders = await broker.inference.getRequestHeaders(
      this.providerAddress,
      billedContent,
    );
    const headerEntries: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(rawHeaders as unknown as Record<string, unknown>)) {
      if (typeof v === "string") headerEntries.push([k, v]);
    }

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(headerEntries),
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`broker http ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      id?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    // sdk doc: chatID = response.headers.get('ZG-Res-Key') || completion.id
    const chatId = res.headers.get("ZG-Res-Key") ?? data.id ?? "";
    const llmText = data.choices?.[0]?.message?.content ?? "";

    // THE LOAD-BEARING LINE
    const verifiedRaw = await broker.inference.processResponse(
      this.providerAddress,
      chatId || undefined,
      llmText,
    );
    // returns null if no chatID, true/false otherwise
    const verified = verifiedRaw === true;

    const { code, rationale } = parseLLMVerdict(llmText);
    const decisionHash = keccak256(toUtf8Bytes(JSON.stringify(input) + "|" + rationale));

    const attestation: AttestationProof = {
      providerAddress: this.providerAddress,
      chatId,
      verified,
      verifiabilityKind: "TeeML",
      rawHeaders: Object.fromEntries(headerEntries),
    };

    return {
      code,
      allowed: code === "ALLOWED" && verified,
      rationale,
      decisionHash,
      attestation,
    };
  }
}
