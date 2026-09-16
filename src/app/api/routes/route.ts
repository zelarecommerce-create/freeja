import { NextRequest, NextResponse } from "next/server";
import { createRouteWithCharge } from "@/lib/createRoute";
import { requireInternalAuth } from "@/lib/internalAuth";

export async function POST(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  const body = await req.json();
  const required = ["clientId", "clientAsaasId", "origem", "destino", "distanciaKm", "valorKm", "pesoKg", "volumeM3"];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `campo obrigatório: ${field}` }, { status: 400 });
    }
  }

  const route = await createRouteWithCharge(body);
  return NextResponse.json(route, { status: 201 });
}
