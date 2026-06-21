import { NextResponse } from "next/server";
import { getVouchState } from "../../../lib/zg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { providerAddress, chatId, content } = body as {
    providerAddress?: string;
    chatId?: string;
    content?: string;
  };
  if (!providerAddress || !chatId) {
    return NextResponse.json(
      { error: "providerAddress + chatId required" },
      { status: 400 },
    );
  }
  const { zg } = await getVouchState();
  try {
    const result = await zg.verifyAttestation(providerAddress, chatId, content);
    return NextResponse.json({ verified: result === true, mode: zg.mode, raw: result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
