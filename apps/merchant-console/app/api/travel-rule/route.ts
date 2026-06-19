import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";
import { travelRulePdf } from "../../../lib/travel-rule-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-contained Travel-Rule PDF for a receipt. Used in mock mode (and as a
 * fallback) where Cleanverse has no real download token. Live mode links
 * straight to the official Cleanverse PDF instead.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const receipts = await getStore().list();
  const r = receipts.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "receipt not found" }, { status: 404 });
  if (!r.travelRule) return NextResponse.json({ error: "no travel rule for this receipt" }, { status: 404 });

  const pdf = travelRulePdf(r);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="travel_rule_${r.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
