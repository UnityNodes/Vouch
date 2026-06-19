/**
 * x402 v1 wire types (the "exact" EVM scheme) plus AgentCheckout's `X-APASS`
 * identity header. We deliberately reuse x402's exact wire format so the
 * handshake is protocol-faithful, while running our own middleware + facilitator
 * (the stock x402 network enum has no Monad entry).
 */

export const X402_VERSION = 1 as const;

export interface PaymentRequirements {
  /** "exact" = EIP-3009 gasless; "direct" = signed raw ERC-20 transfer (payer pays gas) */
  scheme: "exact" | "direct";
  /** lowercase network slug, e.g. "monad" */
  network: string;
  /** EVM chain id of the asset (AgentCheckout extension, clients sign with this) */
  chainId?: number;
  /** amount in atomic token units (string) */
  maxAmountRequired: string;
  /** the protected resource URL */
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: Record<string, unknown> | null;
  /** merchant recipient address */
  payTo: string;
  maxTimeoutSeconds: number;
  /** A-Token contract address */
  asset: string;
  /** EIP-712 domain (name/version) of the asset, for the TransferWithAuthorization signature */
  extra: { name: string; version: string } | null;
}

export interface PaymentRequired {
  x402Version: 1;
  error?: string;
  accepts: PaymentRequirements[];
}

export interface ExactEvmAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  /** 0x-prefixed 32-byte hex */
  nonce: string;
}

export interface ExactEvmPayload {
  /** 0x-prefixed 65-byte EIP-712 signature */
  signature: string;
  authorization: ExactEvmAuthorization;
}

/**
 * Payload for the "direct" scheme: a fully-signed raw ERC-20 `transfer` that the
 * facilitator broadcasts. Used for tokens WITHOUT EIP-3009 (e.g. real Cleanverse
 * aUSDC). The payer signs and pays gas; the facilitator only relays.
 */
export interface DirectEvmPayload {
  /** 0x-prefixed serialized signed transaction */
  signedTransaction: string;
  /** claimed sender (must equal the recovered tx signer and the X-APASS address) */
  from: string;
}

export interface PaymentPayload {
  x402Version: 1;
  scheme: "exact" | "direct";
  network: string;
  payload: Partial<ExactEvmPayload> & Partial<DirectEvmPayload>;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  errorMessage?: string;
  /** on-chain transaction hash */
  transaction: string;
  network: string;
  payer?: string;
}

/** AgentCheckout identity proof, sent base64-encoded in the `X-APASS` header. */
export interface ApassProof {
  version: 1;
  /** lowercase chain slug, must match the payment network */
  chain: string;
  /** claimed payer address; must equal authorization.from */
  address: string;
  credentialId?: string;
  issuedAt?: string;
}

export const PAYMENT_HEADER = "X-PAYMENT";
export const PAYMENT_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";
export const APASS_HEADER = "X-APASS";

/* base64 JSON codecs (Node + browser safe) */

function toBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  // eslint-disable-next-line no-undef
  return btoa(unescape(encodeURIComponent(s)));
}

function fromBase64(b64: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
  // eslint-disable-next-line no-undef
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeBase64Json(obj: unknown): string {
  return toBase64(JSON.stringify(obj));
}

export function decodeBase64Json<T>(b64: string): T {
  return JSON.parse(fromBase64(b64)) as T;
}

export const encodePayment = (p: PaymentPayload): string => encodeBase64Json(p);
export const decodePayment = (s: string): PaymentPayload => decodeBase64Json<PaymentPayload>(s);
export const encodeApass = (p: ApassProof): string => encodeBase64Json(p);
export const decodeApass = (s: string): ApassProof => decodeBase64Json<ApassProof>(s);
