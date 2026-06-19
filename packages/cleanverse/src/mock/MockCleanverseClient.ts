import type {
  CleanverseClient,
  ApassVerifyResult,
  ApassInfo,
  ChainAtokenConfig,
  TravelRuleDownload,
} from "../types";
import { addrHash, short, twoLetters, MOCK_MONAD_CONFIG } from "./fixtures";

export interface MockOptions {
  /** addresses with no A-Pass, verify code 2 (the blocked demo) */
  denyList?: string[];
  /** addresses with a frozen A-Pass, verify code 3 */
  frozenList?: string[];
}

/**
 * Deterministic offline CleanverseClient. Mirrors the real API's shapes and
 * verify codes so the demo (and tests) run with zero network/credentials.
 * Default behavior: every address is allowed (code 4) unless listed in
 * denyList/frozenList. This keeps the happy path trivial and the blocked case
 * explicitly configurable.
 */
export class MockCleanverseClient implements CleanverseClient {
  readonly mode = "mock" as const;
  private readonly deny: Set<string>;
  private readonly frozen: Set<string>;

  constructor(opts: MockOptions = {}) {
    this.deny = new Set((opts.denyList ?? []).map((s) => s.toLowerCase()));
    this.frozen = new Set((opts.frozenList ?? []).map((s) => s.toLowerCase()));
  }

  async verifyAPass({ address }: { chain: string; atoken: string; address: string }): Promise<ApassVerifyResult> {
    const a = address.toLowerCase();
    if (this.deny.has(a)) {
      return {
        code: 2,
        allowed: false,
        magicLink: `https://register.cleanverse.com/apass/mock-${short(a)}`,
        message: "User does not have APass",
      };
    }
    if (this.frozen.has(a)) {
      return { code: 3, allowed: false, message: "APass exists but cannot transfer AToken (frozen)" };
    }
    return { code: 4, allowed: true, message: "apass verify success (mock)" };
  }

  async queryAPass({ address }: { chain: string; address: string }): Promise<ApassInfo> {
    const a = address.toLowerCase();
    const h = addrHash(a);
    const tiers = ["1", "2", "3"];
    return {
      cvRecordId: `mock-${short(a)}`,
      tier: tiers[h % tiers.length],
      subTier: (h % 99) + 1,
      status: this.frozen.has(a) ? 2 : 1,
      expirationTime: 1893456000,
      group: twoLetters(h),
      subGroup: twoLetters(h >> 7),
      currentKycHash: `0x${h.toString(16).padStart(8, "0")}`,
    };
  }

  async getAtokenList(_p: { chain: string }): Promise<ChainAtokenConfig> {
    return MOCK_MONAD_CONFIG;
  }

  async downloadTravelRule({ txHash }: { chain: string; address: string; txHash: string; cvRecordId?: string }): Promise<TravelRuleDownload | null> {
    return {
      downloadUrl: `https://test-admin.cleanverse.com/api/travel_rule/download-token/mock-${short(txHash)}`,
      fileName: `travel_rule_${txHash.replace(/^0x/, "").slice(0, 32)}.pdf`,
    };
  }
}
