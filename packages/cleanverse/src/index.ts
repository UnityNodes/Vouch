import type { CleanverseClient } from "./types";
import { LiveCleanverseClient } from "./live/LiveCleanverseClient";
import { MockCleanverseClient } from "./mock/MockCleanverseClient";

export * from "./types";
export { LiveCleanverseClient } from "./live/LiveCleanverseClient";
export type { LiveOptions } from "./live/LiveCleanverseClient";
export { MockCleanverseClient } from "./mock/MockCleanverseClient";
export type { MockOptions } from "./mock/MockCleanverseClient";
export { aesEncryptBody, aesDecryptBody } from "./live/crypto";
export { cleanversePost, CLEANVERSE_OK } from "./live/http";
export type { CleanverseEnvelope } from "./live/http";

function parseList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Factory: live (real Cooperate API) or mock (deterministic offline), from env. */
export function createCleanverseClient(env: NodeJS.ProcessEnv = process.env): CleanverseClient {
  const mode = (env.CLEANVERSE_MODE ?? "mock").toLowerCase();
  if (mode === "live") {
    return new LiveCleanverseClient({
      baseUrl: env.CLEANVERSE_BASE_URL ?? "https://uatapi.cleanverse.com/api/cooperate",
      skillsUrl: env.CLEANVERSE_SKILLS_URL ?? "https://uatapi.cleanverse.com/api/skills",
      apiId: env.CLEANVERSE_API_ID || undefined,
      apiKey: env.CLEANVERSE_API_KEY || undefined,
    });
  }
  return new MockCleanverseClient({
    denyList: parseList(env.CLEANVERSE_MOCK_DENY),
    frozenList: parseList(env.CLEANVERSE_MOCK_FROZEN),
  });
}
