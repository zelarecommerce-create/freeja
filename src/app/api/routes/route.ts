import { NextRequest, NextResponse } from "next/server";
import { createRouteWithCharge, ClienteSemAsaasError } from "@/lib/createRoute";
import { requireInternalAuth } from "@/lib/internalAuth";

export async function POST(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  const body = await req.json();
  const required = ["clientId", "origem", "destino", "distanciaKm", "valorKm", "pesoKg", "volumeM3"];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `campo obrigatório: ${field}` }, { status: 400 });
    }
  }

  try {
    const route = await createRouteWithCharge(body);
    return NextResponse.json(route, { status: 201 });
  } catch (err) {
    if (err instanceof ClienteSemAsaasError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
