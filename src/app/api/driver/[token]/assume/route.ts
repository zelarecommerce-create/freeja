import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { claimRoute } from "@/lib/claimRoute";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const result = await claimRoute(payload.routeId, payload.subjectId);
  if (!result.claimed) {
    const message =
      result.reason === "already_claimed"
        ? "rota já assumida por outro entregador"
        : "rota não encontrada";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
