import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await getStore();
    const receipts = await store.list();
    return NextResponse.json({ receipts });
  } catch (e) {
    return NextResponse.json({ receipts: [], error: (e as Error).message });
  }
}
