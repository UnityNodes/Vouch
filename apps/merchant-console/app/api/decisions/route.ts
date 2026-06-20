import { NextResponse } from "next/server";
import { getVouchState } from "../../../lib/zg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { store } = getVouchState();
  const decisions = await store.list();
  return NextResponse.json({ decisions });
}
