import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { logLocation } from "@/lib/logLocation";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const body = await req.json();
  const cidade = typeof body.cidade === "string" ? body.cidade : null;
  if (!cidade) {
    return NextResponse.json({ error: "cidade é obrigatória" }, { status: 400 });
  }

  const logged = await logLocation(payload.routeId, payload.subjectId, cidade);
  if (!logged) {
    return NextResponse.json({ error: "essa rota não está com você" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
