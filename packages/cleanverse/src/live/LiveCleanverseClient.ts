import type {
  CleanverseClient,
  ApassVerifyResult,
  ApassVerifyCode,
  ApassInfo,
  ChainAtokenConfig,
  CleanverseToken,
  TravelRuleDownload,
} from "../types";
import { cleanversePost } from "./http";

export interface LiveOptions {
  baseUrl: string;
  skillsUrl: string;
  apiId?: string;
  apiKey?: string;
}

const numOrU = (v: unknown): number | undefined =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

/**
 * Real Cleanverse client (Cooperate API V5.0, Gateway Member subset).
 * When no api-id is configured yet, read-only methods fall back to the public
 * no-auth ClevrPay skills surface so development isn't blocked on credentials.
 */
export class LiveCleanverseClient implements CleanverseClient {
  readonly mode = "live" as const;
  constructor(private readonly opts: LiveOptions) {}

  private get hasKey(): boolean {
    return Boolean(this.opts.apiId);
  }

  async verifyAPass({ chain, atoken, address }: { chain: string; atoken: string; address: string }): Promise<ApassVerifyResult> {
    const c = chain.toLowerCase();
    const a = atoken.toLowerCase();
    const addr = address.toLowerCase();

    if (this.hasKey) {
      const env = await cleanversePost<Record<string, unknown>>({
        baseUrl: this.opts.baseUrl,
        path: "/verify_apass",
        apiId: this.opts.apiId,
        body: { chain: c, atoken: a, address: addr },
      });
      const d = (env.data ?? {}) as Record<string, unknown>;
      const code = (Number(d.code ?? 0) || 0) as ApassVerifyCode;
      return {
        code,
        allowed: code === 4,
        magicLink: (d.magickLink ?? d.magicLink) as string | undefined,
        message: (d.message as string | undefined) ?? env.message,
      };
    }

    // no-key fallback: approximate verify from skills query_apass
    const info = await this.queryAPass({ chain: c, address: addr });
    if (!info.tier && info.status === undefined && !info.cvRecordId) {
      return { code: 2, allowed: false, message: "no A-Pass (skills fallback)" };
    }
    if (info.status === 2) return { code: 3, allowed: false, message: "A-Pass frozen (skills fallback)" };
    return { code: 4, allowed: true, message: "A-Pass ok (skills fallback)" };
  }

  async queryAPass({ chain, address }: { chain: string; address: string }): Promise<ApassInfo> {
    const base = this.hasKey ? this.opts.baseUrl : this.opts.skillsUrl;
    const env = await cleanversePost<Record<string, unknown>>({
      baseUrl: base,
      path: "/query_apass",
      apiId: this.opts.apiId,
      body: { chain: chain.toLowerCase(), address: address.toLowerCase() },
    });
    const d = (env.data ?? {}) as Record<string, unknown>;
    return {
      cvRecordId: d.cvRecordId as string | undefined,
      tier: d.tier != null ? String(d.tier) : undefined,
      subTier: numOrU(d.subTier),
      status: numOrU(d.status),
      expirationTime: numOrU(d.expirationTime),
      group: d.group as string | undefined,
      subGroup: d.subGroup as string | undefined,
      currentKycHash: d.currentKycHash as string | undefined,
    };
  }

  async getAtokenList({ chain }: { chain: string }): Promise<ChainAtokenConfig> {
    const c = chain.toLowerCase();
    if (this.hasKey) {
      const env = await cleanversePost<unknown>({
        baseUrl: this.opts.baseUrl,
        path: "/query_deposit_atoken_list",
        apiId: this.opts.apiId,
        body: { chain: c },
      });
      const mapped = mapCooperateAtokenList(c, env.data);
      if (mapped.tokens.length > 0) return mapped;
    }
    // fallback: public skills query_chain_config (GET)
    const res = await fetch(`${this.opts.skillsUrl}/query_chain_config`);
    const json = (await res.json()) as { data?: unknown };
    return mapSkillsChainConfig(c, json.data);
  }

  async downloadTravelRule({
    chain,
    address,
    txHash,
    cvRecordId,
  }: {
    chain: string;
    address: string;
    txHash: string;
    cvRecordId?: string;
  }): Promise<TravelRuleDownload | null> {
    if (!this.hasKey) return null; // Cooperate-only, needs credentials
    const env = await cleanversePost<Record<string, unknown>>({
      baseUrl: this.opts.baseUrl,
      path: "/download_travel_rule",
      apiId: this.opts.apiId,
      body: { txHash, cvRecordId, wallet: { chain: chain.toLowerCase(), address: address.toLowerCase() } },
    });
    const d = (env.data ?? {}) as Record<string, unknown>;
    return d.downloadUrl
      ? { downloadUrl: String(d.downloadUrl), fileName: String(d.fileName ?? `travel_rule_${txHash}.pdf`) }
      : null;
  }
}

/* response mappers (defensive: gateway shapes vary) */

function mapSkillsChainConfig(chain: string, data: unknown): ChainAtokenConfig {
  const chains = (data as { chains?: unknown[] } | undefined)?.chains ?? [];
  const entry = (chains as Record<string, unknown>[]).find(
    (c) => String(c.chain ?? "").toLowerCase() === chain,
  );
  if (!entry) return { chain, tokens: [] };
  const rawTokens = (entry.tokens as Record<string, unknown>[] | undefined) ?? [];
  const tokens: CleanverseToken[] = rawTokens.map((t) => ({
    symbol: String(t.symbol ?? ""),
    aSymbol: t.a_symbol as string | undefined,
    address: String(t.token_address ?? ""),
    decimals: Number(t.decimals ?? 18),
    category: t.token_category as string | undefined,
    accessCore: t.access_core as string | undefined,
    depositGateway: t.deposit_gateway as string | undefined,
  }));
  const atoken = tokens.find((t) => t.category === "atoken");
  return {
    chain,
    chainId: numOrU(entry.chain_id),
    rpcUrl: entry.rpc_url as string | undefined,
    explorer: entry.explorer as string | undefined,
    apassAddress: entry.apass_address as string | undefined,
    accesscoreAddress: atoken?.accessCore,
    tokens,
  };
}

function mapCooperateAtokenList(chain: string, data: unknown): ChainAtokenConfig {
  const d = (data ?? {}) as Record<string, unknown>;
  const list =
    (d.list as Record<string, unknown>[] | undefined) ??
    (d.pairs as Record<string, unknown>[] | undefined) ??
    (Array.isArray(data) ? (data as Record<string, unknown>[]) : []);
  const tokens: CleanverseToken[] = [];
  for (const p of list) {
    if (p.atoken_address || p.atoken_symbol) {
      tokens.push({
        symbol: String(p.atoken_symbol ?? p.origin_symbol ?? ""),
        aSymbol: p.atoken_symbol as string | undefined,
        address: String(p.atoken_address ?? ""),
        decimals: Number(p.decimals ?? 6),
        category: "atoken",
      });
    }
    if (p.origin_token_address || p.origin_symbol) {
      tokens.push({
        symbol: String(p.origin_symbol ?? ""),
        address: String(p.origin_token_address ?? ""),
        decimals: Number(p.decimals ?? 6),
        category: "token",
      });
    }
  }
  return {
    chain,
    apassAddress: d.apass_address as string | undefined,
    accesscoreAddress: d.accesscore_address as string | undefined,
    tokens,
  };
}
