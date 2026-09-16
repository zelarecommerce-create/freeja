import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./tokens";

const COOKIE_NAME = "internal_session";

export function requireInternalAuth(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME };
