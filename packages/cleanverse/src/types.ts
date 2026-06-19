/**
 * CleanverseClient, shaped on the real Cleanverse Cooperate API V5.0
 * (Gateway Member subset) plus the public no-auth ClevrPay skills surface as a
 * read fallback. This is the single swappable seam: live HTTP today, the same
 * interface regardless of mode.
 */

/** verify_apass result codes (from the real API). */
export type ApassVerifyCode = 0 | 1 | 2 | 3 | 4;
// 1 = AToken not found, 2 = no APass, 3 = APass exists but transfer not allowed
// (expired/frozen/rule), 4 = valid & allowed. 0 = unknown/error.

export interface ApassVerifyResult {
  code: ApassVerifyCode;
  /** convenience: code === 4 */
  allowed: boolean;
  /** URL to register an A-Pass when the payer has none (code 2) */
  magicLink?: string;
  message?: string;
}

export interface ApassInfo {
  cvRecordId?: string;
  tier?: string;
  subTier?: number;
  /** 1 = active, 2 = frozen */
  status?: number;
  expirationTime?: number;
  group?: string;
  subGroup?: string;
  currentKycHash?: string;
}

export interface CleanverseToken {
  symbol: string;
  aSymbol?: string;
  address: string;
  decimals: number;
  category?: string; // "token" | "atoken"
  accessCore?: string;
  depositGateway?: string;
}

export interface ChainAtokenConfig {
  chain: string;
  chainId?: number;
  rpcUrl?: string;
  explorer?: string;
  apassAddress?: string;
  accesscoreAddress?: string;
  tokens: CleanverseToken[];
}

export interface TravelRuleDownload {
  downloadUrl: string;
  fileName: string;
}

export interface CleanverseClient {
  readonly mode: "live" | "mock";

  /** Identity gate used on every payment: is this payer allowed to move `atoken`? */
  verifyAPass(p: { chain: string; atoken: string; address: string }): Promise<ApassVerifyResult>;

  /** A-Pass details for display (tier badge, status). */
  queryAPass(p: { chain: string; address: string }): Promise<ApassInfo>;

  /** Authoritative chain/token config (addresses). Do not hardcode. */
  getAtokenList(p: { chain: string }): Promise<ChainAtokenConfig>;

  /** Official Cleanverse Travel-Rule PDF for a settled tx (live only; null otherwise). */
  downloadTravelRule(p: {
    chain: string;
    address: string;
    txHash: string;
    cvRecordId?: string;
  }): Promise<TravelRuleDownload | null>;
}

export function findToken(cfg: ChainAtokenConfig, symbolOrASymbol: string): CleanverseToken | undefined {
  const q = symbolOrASymbol.toLowerCase();
  return (
    cfg.tokens.find((t) => t.category === "atoken" && (t.symbol.toLowerCase() === q || t.aSymbol?.toLowerCase() === q)) ??
    cfg.tokens.find((t) => t.symbol.toLowerCase() === q || t.aSymbol?.toLowerCase() === q)
  );
}
