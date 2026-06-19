import { createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Cleanverse Cooperate API request-body encryption for write endpoints.
 * Scheme (verbatim from docs): AES/CBC/PKCS5Padding, fixed IV = 16 zero bytes,
 * key = Base64-decoded api-key. Body is sent as {"data":"<base64 ciphertext>"}.
 * (PKCS5 == PKCS7 for block ciphers; Node uses PKCS7 by default.)
 */
const ZERO_IV = Buffer.alloc(16, 0);

function algoFor(key: Buffer): "aes-128-cbc" | "aes-192-cbc" | "aes-256-cbc" {
  if (key.length === 16) return "aes-128-cbc";
  if (key.length === 24) return "aes-192-cbc";
  if (key.length === 32) return "aes-256-cbc";
  throw new Error(`Invalid api-key length after base64 decode: ${key.length} bytes (expected 16/24/32)`);
}

export function aesEncryptBody(plaintextJson: string, apiKeyBase64: string): string {
  const key = Buffer.from(apiKeyBase64, "base64");
  const cipher = createCipheriv(algoFor(key), key, ZERO_IV);
  const enc = Buffer.concat([cipher.update(plaintextJson, "utf8"), cipher.final()]);
  return enc.toString("base64");
}

export function aesDecryptBody(ciphertextBase64: string, apiKeyBase64: string): string {
  const key = Buffer.from(apiKeyBase64, "base64");
  const decipher = createDecipheriv(algoFor(key), key, ZERO_IV);
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertextBase64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}
