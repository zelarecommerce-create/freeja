import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { releaseRoute } from "@/lib/notifyEligibleDrivers";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "driver") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const result = await releaseRoute(payload.routeId, payload.subjectId);
  if (!result.released) {
    return NextResponse.json({ error: "essa rota não está com você" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
