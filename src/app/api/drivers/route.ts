import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAuth } from "@/lib/internalAuth";
import { registerDriver } from "@/lib/registerDriver";
import { ValidationError } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const authError = requireInternalAuth(req);
  if (authError) return authError;

  const drivers = await prisma.driver.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(drivers);
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
    const driver = await registerDriver(body);
    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
