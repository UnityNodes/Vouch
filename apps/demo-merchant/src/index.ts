import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { agentCheckout, type AssetConfig } from "@agentcheckout/middleware";
import { createCleanverseClient } from "@agentcheckout/cleanverse";
import { MONAD_TESTNET } from "@agentcheckout/shared";
import { JsonReceiptStore } from "@agentcheckout/shared/store";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

const ZERO = "0x0000000000000000000000000000000000000000";

const port = Number(process.env.DEMO_MERCHANT_PORT ?? 4020);
const facilitatorUrl = process.env.FACILITATOR_URL ?? "http://localhost:4021";
const network = process.env.SETTLEMENT_NETWORK ?? MONAD_TESTNET.slug;
const chainId = Number(process.env.MONAD_CHAIN_ID ?? MONAD_TESTNET.chainId);
const payTo = (process.env.MERCHANT_ADDRESS ?? ZERO) as `0x${string}`;

// Settlement asset: mock EIP-3009 stand-in (gasless x402 demo) or real aUSDC.
const useReal = (process.env.SETTLEMENT_ASSET ?? "mock") === "real";
const asset: AssetConfig = useReal
  ? {
      address: (process.env.ATOKEN_ADDRESS ?? MONAD_TESTNET.contracts.aUSDC) as `0x${string}`,
      name: process.env.ATOKEN_NAME ?? "Access USDC",
      version: process.env.ATOKEN_VERSION ?? "1",
      decimals: Number(process.env.ATOKEN_DECIMALS ?? 6),
      symbol: process.env.ATOKEN_SYMBOL ?? "aUSDC",
    }
  : {
      address: (process.env.MOCK_ATOKEN_ADDRESS ?? ZERO) as `0x${string}`,
      name: process.env.MOCK_ATOKEN_NAME ?? "AgentCheckout Mock aUSDC",
      version: "1",
      decimals: Number(process.env.MOCK_ATOKEN_DECIMALS ?? 6),
      symbol: process.env.MOCK_ATOKEN_SYMBOL ?? "acAUSDC",
    };

const cleanverse = createCleanverseClient();
// shared receipts file at the monorepo root .data (also read by the merchant console)
const store = new JsonReceiptStore(
  process.env.RECEIPTS_PATH ?? path.resolve(process.cwd(), "..", "..", ".data", "receipts.json"),
);

const app = express();
app.use(cors());

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
    cleanverse,
    store,
    merchantName: process.env.MERCHANT_NAME ?? "Acme Data Co",
    explorerUrl: process.env.MONAD_EXPLORER_URL ?? MONAD_TESTNET.explorerUrl,
    // real aUSDC has no EIP-3009 -> use the "direct" signed-transfer scheme; mock stand-in uses gasless "exact"
    settlementScheme: useReal ? "direct" : "exact",
    // when settling the mock stand-in, still run the live A-Pass gate against the REAL aUSDC A-Token
    verifyAToken: useReal
      ? undefined
      : ((process.env.ATOKEN_ADDRESS ?? MONAD_TESTNET.contracts.aUSDC) as `0x${string}`),
  }),
);

// The protected resource, only reached after a compliant, settled payment.
app.get("/premium-data", (_req, res) => {
  res.json({
    signal: "BUY",
    pair: "MON/USDC",
    confidence: 0.91,
    generatedAt: new Date().toISOString(),
    note: "Unlocked via AgentCheckout: verified A-Pass and settled A-Token on Monad.",
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "demo-merchant" }));

app.get("/", (_req, res) => {
  res.json({
    name: "AgentCheckout demo-merchant",
    cleanverseMode: cleanverse.mode,
    settlementAsset: useReal ? "real aUSDC" : "mock A-Token",
    protected: ["GET /premium-data"],
    price: process.env.PREMIUM_PRICE ?? "$0.01",
  });
});

app.listen(port, () => {
  console.log(`[demo-merchant] http://localhost:${port}`);
  console.log(`[demo-merchant] protected: GET /premium-data  asset=${asset.symbol} (${asset.address})`);
  console.log(`[demo-merchant] cleanverse=${cleanverse.mode}  facilitator=${facilitatorUrl}`);
});
