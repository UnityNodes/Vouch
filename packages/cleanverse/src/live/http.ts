import { aesEncryptBody } from "./crypto";

export interface CleanverseEnvelope<T = unknown> {
  code: string;
  message: string;
  data: T;
}

export interface CooperateRequest {
  baseUrl: string;
  path: string;
  apiId?: string;
  apiKey?: string;
  body?: unknown;
  /** encrypt the body for write endpoints (requires apiKey) */
  encrypt?: boolean;
  method?: "POST" | "GET";
}

/** POST (or GET) a Cleanverse endpoint, returning the parsed {code,message,data} envelope. */
export async function cleanversePost<T>(req: CooperateRequest): Promise<CleanverseEnvelope<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.apiId) headers["api-id"] = req.apiId;

  const method = req.method ?? "POST";
  let body: string | undefined;

  if (method === "POST") {
    if (req.encrypt) {
      if (!req.apiKey) throw new Error("CLEANVERSE_API_KEY required for encrypted endpoint " + req.path);
      const cipher = aesEncryptBody(JSON.stringify(req.body ?? {}), req.apiKey);
      body = JSON.stringify({ data: cipher });
    } else {
      body = JSON.stringify(req.body ?? {});
    }
  }

  const res = await fetch(`${req.baseUrl}${req.path}`, { method, headers, body });
  const text = await res.text();
  let json: CleanverseEnvelope<T>;
  try {
    json = JSON.parse(text) as CleanverseEnvelope<T>;
  } catch {
    throw new Error(`Cleanverse ${req.path} returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return json;
}

export const CLEANVERSE_OK = "0000";
