import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { payAndCall } from "@agentcheckout/mcp/pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drive a real x402 payment against the demo-merchant from the console, so the
 * live feed populates on stage. mode=success uses the verified agent key,
 * mode=blocked uses an agent whose address is on the Cleanverse deny list.
 */
export async function POST(req: Request) {
  const { mode } = (await req.json().catch(() => ({ mode: "success" }))) as { mode?: string };
  const base = process.env.DEMO_MERCHANT_URL ?? "http://localhost:4020";
  const url = `${base.replace(/\/$/, "")}/premium-data`;

  const pk =
    mode === "blocked"
      ? process.env.BLOCKED_AGENT_PRIVATE_KEY
      : process.env.AGENT_PRIVATE_KEY ?? process.env.MCP_WALLET_PRIVATE_KEY;

  if (!pk) {
    return NextResponse.json(
      { error: `agent key not configured for mode=${mode} (set AGENT_PRIVATE_KEY / BLOCKED_AGENT_PRIVATE_KEY)` },
      { status: 400 },
    );
  }

  try {
    const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
    const result = await payAndCall({ url, account });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
