import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { agentCheckout } from "../src/index";
import type { AssetConfig } from "../src/index";
import { MockCleanverseClient } from "@agentcheckout/cleanverse";
import { encodeApass, encodePayment, type PaymentPayload, type ReceiptRecord } from "@agentcheckout/shared";
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
  name: "Mock",
  version: "1",
  decimals: 6,
  symbol: "mUSD",
};
const PAYTO = "0x000000000000000000000000000000000000bbbb" as const;
const PAYER = "0x000000000000000000000000000000000000cccc";

function buildApp(cleanverse: MockCleanverseClient, store: ReceiptStore) {
  const app = express();
  app.use(
    agentCheckout({
      payTo: PAYTO,
      facilitatorUrl: "http://facilitator.test",
      network: "monad",
      chainId: 10143,
      asset: ASSET,
      routes: { "GET /premium": { price: "$0.01" } },
      cleanverse,
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
    network: "monad",
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

const withHeaders = (r: request.Test) =>
  r
    .set("X-PAYMENT", encodePayment(dummyPayment()))
    .set("X-APASS", encodeApass({ version: 1, chain: "monad", address: PAYER }));

describe("agentCheckout pipeline", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 402 with requirements when no payment is presented", async () => {
    const app = buildApp(new MockCleanverseClient(), new MemStore());
    const res = await request(app).get("/premium");
    expect(res.status).toBe(402);
    expect(res.body.accepts[0].asset).toBe(ASSET.address);
    expect(res.body.accepts[0].chainId).toBe(10143);
  });

  it("blocks at the A-Pass gate BEFORE calling the facilitator", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const store = new MemStore();
    const app = buildApp(new MockCleanverseClient({ denyList: [PAYER] }), store);

    const res = await withHeaders(request(app).get("/premium"));

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("apass_required");
    expect(res.body.magicLink).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled(); // identity gate runs before settlement
    expect(store.records[0]?.settlement.status).toBe("BLOCKED");
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
            JSON.stringify({ success: true, transaction: `0x${"ab".repeat(32)}`, network: "monad", payer: PAYER }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      }),
    );
    const store = new MemStore();
    const app = buildApp(new MockCleanverseClient(), store);

    const res = await withHeaders(request(app).get("/premium"));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers["x-payment-response"]).toBeTruthy();
    expect(store.records[0]?.settlement.status).toBe("SUCCESS");
    expect(store.records[0]?.settlement.txHash).toContain("0xabab");
    expect(store.records[0]?.travelRule).not.toBeNull();
  });
});
