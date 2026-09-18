import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAuth } from "@/lib/internalAuth";
import { registerClient } from "@/lib/registerClient";
import { ValidationError } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo da requisição inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "corpo da requisição inválido" }, { status: 400 });
  }

  try {
    const client = await registerClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Falha ao cadastrar cliente no Asaas" }, { status: 502 });
  }
}
