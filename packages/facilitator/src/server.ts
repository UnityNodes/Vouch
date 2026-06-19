import express, { type Express } from "express";
import cors from "cors";
import type { PaymentPayload, PaymentRequirements } from "@agentcheckout/shared";
import type { FacilitatorClients } from "./viem";
import { verifyPayment } from "./verify";
import { settlePayment } from "./settle";

/** Build the x402-facilitator Express app (HTTP contract: /verify, /settle, /supported, /health). */
export function createFacilitatorApp(clients: FacilitatorClients, network: string): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", chainId: clients.chainId, hasWallet: Boolean(clients.walletClient) });
  });

  app.get("/supported", (_req, res) => {
    res.json({ kinds: [{ x402Version: 1, scheme: "exact", network }] });
  });

  app.post("/verify", async (req, res) => {
    const { paymentPayload, paymentRequirements } = (req.body ?? {}) as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };
    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({ isValid: false, invalidReason: "missing_body" });
      return;
    }
    try {
      const result = await verifyPayment(clients, paymentPayload, paymentRequirements);
      res.json(result);
    } catch (e) {
      res.status(500).json({ isValid: false, invalidReason: "verify_error", message: (e as Error).message });
    }
  });

  app.post("/settle", async (req, res) => {
    const { paymentPayload, paymentRequirements } = (req.body ?? {}) as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };
    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({ success: false, errorReason: "missing_body", transaction: "", network });
      return;
    }
    try {
      const result = await settlePayment(clients, paymentPayload, paymentRequirements);
      res.json(result);
    } catch (e) {
      res.status(500).json({
        success: false,
        errorReason: "settle_error",
        errorMessage: (e as Error).message,
        transaction: "",
        network,
      });
    }
  });

  return app;
}
