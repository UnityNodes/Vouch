import type { TypedDataDomain } from "viem";

/**
 * EIP-3009 `TransferWithAuthorization` typed-data, identical to the x402
 * "exact" EVM scheme. The payer signs this off-chain; the facilitator relays it
 * on-chain via `transferWithAuthorization` (gasless for the payer).
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface TransferAuthorizationParams {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: `0x${string}`;
}

export function buildTransferWithAuthorizationTypedData(p: TransferAuthorizationParams) {
  const domain: TypedDataDomain = {
    name: p.name,
    version: p.version,
    chainId: p.chainId,
    verifyingContract: p.verifyingContract,
  };
  return {
    domain,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: p.from,
      to: p.to,
      value: p.value,
      validAfter: p.validAfter,
      validBefore: p.validBefore,
      nonce: p.nonce,
    },
  };
}

/** Minimal A-Token ABI: EIP-3009 transfer, plain ERC20 transfer, reads, and (mock) mint. */
export const ATOKEN_ABI = [
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "DOMAIN_SEPARATOR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
