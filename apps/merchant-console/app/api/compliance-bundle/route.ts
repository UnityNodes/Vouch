import { NextResponse } from "next/server";
import { buildComplianceBundle, GALILEO_TESTNET } from "@agentcheckout/shared";
import { getStore } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStore();
  const receipts = await store.list();
  const bundle = buildComplianceBundle(
    {
      address: process.env.MERCHANT_ADDRESS ?? "0x0000000000000000000000000000000000000000",
      name: process.env.MERCHANT_NAME ?? "Acme Data Co",
    },
    {
      name: GALILEO_TESTNET.slug,
      chainId: GALILEO_TESTNET.chainId,
      explorer: GALILEO_TESTNET.explorerUrl,
    },
    receipts,
    new Date().toISOString(),
  );
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="vouch-compliance-bundle.json"',
    },
  });
}
