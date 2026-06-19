import { describe, it, expect } from "vitest";
import { MockCleanverseClient, aesEncryptBody, aesDecryptBody } from "../src/index";

describe("MockCleanverseClient.verifyAPass", () => {
  it("allows by default (code 4)", async () => {
    const c = new MockCleanverseClient();
    const r = await c.verifyAPass({ chain: "monad", atoken: "0xa", address: "0xPayer" });
    expect(r.allowed).toBe(true);
    expect(r.code).toBe(4);
  });

  it("denies addresses on the deny list with code 2 + magicLink", async () => {
    const c = new MockCleanverseClient({ denyList: ["0xBAD"] });
    const r = await c.verifyAPass({ chain: "monad", atoken: "0xa", address: "0xbad" });
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(2);
    expect(r.magicLink).toBeTruthy();
  });

  it("marks frozen addresses as code 3", async () => {
    const c = new MockCleanverseClient({ frozenList: ["0xFROZEN"] });
    const r = await c.verifyAPass({ chain: "monad", atoken: "0xa", address: "0xfrozen" });
    expect(r.code).toBe(3);
    expect(r.allowed).toBe(false);
  });
});

describe("MockCleanverseClient queries", () => {
  it("queryAPass is deterministic and well-formed (no NaN/undefined letters)", async () => {
    const c = new MockCleanverseClient();
    const a = await c.queryAPass({ chain: "monad", address: "0xabc123def456" });
    const b = await c.queryAPass({ chain: "monad", address: "0xabc123def456" });
    expect(a).toEqual(b);
    expect(a.group).toMatch(/^[A-Z]{2}$/);
    expect(a.subGroup).toMatch(/^[A-Z]{2}$/);
    expect(Number.isNaN(a.subTier)).toBe(false);
    expect(a.status).toBe(1);
  });

  it("getAtokenList returns the Monad config incl. an A-Token", async () => {
    const c = new MockCleanverseClient();
    const cfg = await c.getAtokenList({ chain: "monad" });
    expect(cfg.chainId).toBe(10143);
    expect(cfg.apassAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(cfg.tokens.some((t) => t.category === "atoken")).toBe(true);
  });
});

describe("Cooperate AES body encryption (AES/CBC, zero IV)", () => {
  it("round-trips with a 16-byte key", () => {
    const key = Buffer.alloc(16, 7).toString("base64");
    const pt = JSON.stringify({ chain: "monad", address: "0xabc" });
    expect(aesDecryptBody(aesEncryptBody(pt, key), key)).toBe(pt);
  });

  it("is deterministic for the same plaintext (fixed zero IV)", () => {
    const key = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"); // 32 bytes
    expect(aesEncryptBody("hello", key)).toBe(aesEncryptBody("hello", key));
  });
});
