import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { completeRoute } from "@/lib/completeRoute";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const body = await req.json();
  try {
    await completeRoute(payload.routeId, payload.subjectId, body.comprovanteBase64 ?? "");
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
