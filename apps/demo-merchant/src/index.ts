import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { agentCheckout, type AssetConfig } from "@agentcheckout/middleware";
import { makeZGComputeClient, ZGStorageReceiptStore } from "@agentcheckout/zerogravity";
import { GALILEO_TESTNET } from "@agentcheckout/shared";
import { JsonReceiptStore } from "@agentcheckout/shared/store";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

const ZERO = "0x0000000000000000000000000000000000000000";

const port = Number(process.env.DEMO_MERCHANT_PORT ?? 4020);
const facilitatorUrl = process.env.FACILITATOR_URL ?? "http://localhost:4021";
const network = GALILEO_TESTNET.slug;
const chainId = Number(process.env.GALILEO_CHAIN_ID ?? GALILEO_TESTNET.chainId);
const payTo = (process.env.MERCHANT_ADDRESS ?? ZERO) as `0x${string}`;

const asset: AssetConfig = {
  address: (process.env.GALILEO_ATOKEN_ADDRESS ?? ZERO) as `0x${string}`,
  name: process.env.ATOKEN_NAME ?? "Vouch USD",
  version: process.env.ATOKEN_VERSION ?? "1",
  decimals: Number(process.env.ATOKEN_DECIMALS ?? 6),
  symbol: process.env.ATOKEN_SYMBOL ?? "vUSD",
};

const zgMode = process.env.ZG_COMPUTE_MODE === "live" ? "live" : "mock";
const zg = await makeZGComputeClient(zgMode);

const useZgStorage = process.env.ZG_STORAGE_MODE === "live";
const store = useZgStorage
  ? new ZGStorageReceiptStore()
  : new JsonReceiptStore(
      process.env.RECEIPTS_PATH ??
        path.resolve(process.cwd(), "..", "..", ".data", "receipts.json"),
    );

const app = express();
app.use(cors());
app.use(express.json());

app.use(
  agentCheckout({
    payTo,
    facilitatorUrl,
    network,
    chainId,
    asset,
    routes: {
      "GET /premium-data": {
        price: process.env.PREMIUM_PRICE ?? "$0.01",
        description: "Premium market data feed",
      },
    },
    zg,
    store,
    merchantName: process.env.MERCHANT_NAME ?? "Acme Data Co",
    explorerUrl: process.env.GALILEO_EXPLORER_URL ?? GALILEO_TESTNET.explorerUrl,
    settlementScheme: "exact",
  }),
);

// The protected resource, only reached after a verified TEE attestation + settled payment.
app.get("/premium-data", (_req, res) => {
  res.json({
    signal: "BUY",
    pair: "OG/USD",
    confidence: 0.91,
    generatedAt: new Date().toISOString(),
    note: "You got here because Vouch reviewed your payment inside a 0G Compute TEE, said yes, and settled in vUSD on 0G Chain - all in one round-trip.",
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "demo-merchant" }));

// Public feed for the compliance explorer
app.get("/api/decisions", async (_req, res) => {
  try {
    const all = await store.list();
    res.json({ decisions: all.slice(0, 100) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Client-side re-verify endpoint. In live-mode this hits processResponse() on
// the broker so anyone can convince themselves the attestation is honest. In
// mock-mode it returns true (the mock has no TEE in the loop).
app.post("/api/reverify", async (req, res) => {
  const { providerAddress, chatId, content } = req.body ?? {};
  if (!providerAddress || !chatId) {
    res.status(400).json({ error: "providerAddress + chatId required" });
    return;
  }
  try {
    const result = await zg.verifyAttestation(providerAddress, chatId, content);
    res.json({ verified: result === true, mode: zg.mode, raw: result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "Vouch demo-merchant",
    zgMode: zg.mode,
    storage: useZgStorage ? "0g-storage" : "json-file",
    protected: ["GET /premium-data"],
    feed: ["GET /api/decisions", "POST /api/reverify"],
    price: process.env.PREMIUM_PRICE ?? "$0.01",
  });
});

app.listen(port, () => {
  console.log(`[demo-merchant] http://localhost:${port}`);
  console.log(
    `[demo-merchant] protected: GET /premium-data  asset=${asset.symbol} (${asset.address})`,
  );
  console.log(
    `[demo-merchant] zg=${zg.mode}  storage=${useZgStorage ? "0g-storage" : "json"}  facilitator=${facilitatorUrl}`,
  );
});
