import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";
import { getRouteTracking } from "@/lib/getRouteTracking";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyToken(params.token);
  if (!payload || payload.kind !== "client") {
    return NextResponse.json({ error: "link inválido ou expirado" }, { status: 401 });
  }

  const tracking = await getRouteTracking(payload.routeId);
  return NextResponse.json(tracking);
}
