import { parseUnits } from "viem";
import type { PaymentRequirements } from "@agentcheckout/shared";

export interface AssetConfig {
  address: `0x${string}`;
  name: string;
  version: string;
  decimals: number;
  symbol?: string;
}

export interface RouteConfig {
  price: string; // "$0.01" or "0.01"
  description?: string;
  mimeType?: string;
}

/** "$0.01" | "0.01" -> atomic units string for the asset's decimals. */
export function priceToAtomic(price: string, decimals: number): string {
  const clean = price.trim().replace(/^\$/, "");
  return parseUnits(clean as `${number}`, decimals).toString();
}

export function buildRequirements(args: {
  network: string;
  chainId: number;
  payTo: `0x${string}`;
  asset: AssetConfig;
  route: RouteConfig;
  resource: string;
  maxTimeoutSeconds: number;
  scheme?: "exact" | "direct";
}): PaymentRequirements {
  return {
    scheme: args.scheme ?? "exact",
    network: args.network,
    chainId: args.chainId,
    maxAmountRequired: priceToAtomic(args.route.price, args.asset.decimals),
    resource: args.resource,
    description: args.route.description ?? "",
    mimeType: args.route.mimeType ?? "application/json",
    outputSchema: null,
    payTo: args.payTo,
    maxTimeoutSeconds: args.maxTimeoutSeconds,
    asset: args.asset.address,
    extra: { name: args.asset.name, version: args.asset.version },
  };
}
