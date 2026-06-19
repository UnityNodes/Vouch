import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@agentcheckout/shared";

export interface FacilitatorClient {
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

export function makeFacilitatorClient(baseUrl: string): FacilitatorClient {
  const url = baseUrl.replace(/\/$/, "");
  return {
    async verify(paymentPayload, paymentRequirements) {
      const r = await fetch(`${url}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
      });
      return (await r.json()) as VerifyResponse;
    },
    async settle(paymentPayload, paymentRequirements) {
      const r = await fetch(`${url}/settle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
      });
      return (await r.json()) as SettleResponse;
    },
  };
}
