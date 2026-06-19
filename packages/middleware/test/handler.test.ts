import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { agentCheckout } from "../src/index";
import type { AssetConfig } from "../src/index";
import { MockZGComputeClient } from "@agentcheckout/zerogravity";
import { encodePayment, type PaymentPayload, type ReceiptRecord } from "@agentcheckout/shared";
import type { ReceiptStore } from "@agentcheckout/shared/store";

class MemStore implements ReceiptStore {
  records: ReceiptRecord[] = [];
  async append(r: ReceiptRecord) {
    this.records.unshift(r);
  }
  async list() {
    return this.records;
  }
}

const ASSET: AssetConfig = {
  address: "0x000000000000000000000000000000000000aaaa",
  name: "AgentCheckout USD",
  version: "1",
  decimals: 6,
  symbol: "acUSD",
};
const PAYTO = "0x000000000000000000000000000000000000bbbb" as const;
const PAYER = "0x000000000000000000000000000000000000cccc";

function buildApp(zg: MockZGComputeClient, store: ReceiptStore) {
  const app = express();
  app.use(
    agentCheckout({
      payTo: PAYTO,
      facilitatorUrl: "http://facilitator.test",
      network: "0g-galileo",
      chainId: 16602,
      asset: ASSET,
      routes: { "GET /premium": { price: "$0.01" } },
      zg,
      store,
    }),
  );
  app.get("/premium", (_req, res) => res.json({ ok: true }));
  return app;
}

function dummyPayment(): PaymentPayload {
  return {
    x402Version: 1,
    scheme: "exact",
    network: "0g-galileo",
    payload: {
      signature: `0x${"11".repeat(65)}`,
      authorization: {
        from: PAYER,
        to: PAYTO,
        value: "10000",
        validAfter: "0",
        validBefore: "9999999999",
        nonce: `0x${"00".repeat(32)}`,
      },
    },
  };
}

const withPayment = (r: request.Test) => r.set("X-PAYMENT", encodePayment(dummyPayment()));

describe("agentCheckout pipeline", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 402 with requirements when no payment is presented", async () => {
    const app = buildApp(new MockZGComputeClient(), new MemStore());
    const res = await request(app).get("/premium");
    expect(res.status).toBe(402);
    expect(res.body.accepts[0].asset).toBe(ASSET.address);
    expect(res.body.accepts[0].chainId).toBe(16602);
  });

  it("blocks at the TEE-attested compliance gate BEFORE calling the facilitator", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const store = new MemStore();
    const app = buildApp(new MockZGComputeClient({ denyList: [PAYER] }), store);

    const res = await withPayment(request(app).get("/premium"));

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("compliance_denied");
    expect(res.body.rationale).toMatch(/deny-list/i);
    expect(res.body.attestation.verifiabilityKind).toBe("mock");
    expect(res.body.attestation.verified).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled(); // compliance gate runs before settlement
    const stored = store.records[0];
    expect(stored?.settlement.status).toBe("BLOCKED");
    expect(stored?.compliance.code).toBe("DENIED");
    expect(stored?.compliance.decisionHash).toMatch(/^0x[0-9a-f]+$/);
  });

  it("verifies, settles, and returns the resource on the happy path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.endsWith("/verify")) {
          return new Response(JSON.stringify({ isValid: true, payer: PAYER }), { status: 200 });
        }
        if (u.endsWith("/settle")) {
          return new Response(
            JSON.stringify({
              success: true,
              transaction: `0x${"ab".repeat(32)}`,
              network: "0g-galileo",
              payer: PAYER,
            }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const store = new MemStore();
    const app = buildApp(new MockZGComputeClient(), store);

    const res = await withPayment(request(app).get("/premium"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers["x-payment-response"]).toBeTruthy();
    const stored = store.records[0];
    expect(stored?.settlement.status).toBe("SUCCESS");
    expect(stored?.settlement.txHash).toContain("0xabab");
    expect(stored?.attestation.verified).toBe(true);
    expect(stored?.compliance.code).toBe("ALLOWED");
  });
});
