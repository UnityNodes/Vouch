import { describe, it, expect } from "vitest";
import {
  encodePayment,
  decodePayment,
  encodeApass,
  decodeApass,
  buildTransferWithAuthorizationTypedData,
  type PaymentPayload,
  type ApassProof,
} from "../src/index";

describe("x402 codecs", () => {
  it("round-trips a payment payload", () => {
    const p: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "monad",
      payload: {
        signature: "0xabc",
        authorization: { from: "0x1", to: "0x2", value: "10000", validAfter: "1", validBefore: "2", nonce: "0xdead" },
      },
    };
    expect(decodePayment(encodePayment(p))).toEqual(p);
  });

  it("round-trips an A-Pass proof", () => {
    const a: ApassProof = { version: 1, chain: "monad", address: "0xabc" };
    expect(decodeApass(encodeApass(a))).toEqual(a);
  });
});

describe("EIP-3009 typed data", () => {
  it("produces the correct domain and primary type", () => {
    const nonce = `0x${"00".repeat(32)}` as `0x${string}`;
    const t = buildTransferWithAuthorizationTypedData({
      name: "A-Token",
      version: "1",
      chainId: 10143,
      verifyingContract: "0x0000000000000000000000000000000000000001",
      from: "0x0000000000000000000000000000000000000002",
      to: "0x0000000000000000000000000000000000000003",
      value: 1n,
      validAfter: 0n,
      validBefore: 99n,
      nonce,
    });
    expect(t.primaryType).toBe("TransferWithAuthorization");
    expect(t.domain.chainId).toBe(10143);
    expect(t.domain.verifyingContract).toBe("0x0000000000000000000000000000000000000001");
    expect(t.types.TransferWithAuthorization).toHaveLength(6);
  });
});
