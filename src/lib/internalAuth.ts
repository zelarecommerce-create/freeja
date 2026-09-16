import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./tokens";

const COOKIE_NAME = "internal_session";

// What /api/internal/login signs. Every driver also holds a validly-signed
// token (it is in their own WhatsApp link), so a good signature alone is not
// proof of an internal session — the payload has to be the internal one.
export const INTERNAL_SUBJECT = { routeId: "internal", subjectId: "equipe" } as const;

export function requireInternalAuth(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;
  if (
    !payload ||
    payload.routeId !== INTERNAL_SUBJECT.routeId ||
    payload.subjectId !== INTERNAL_SUBJECT.subjectId
  ) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  return null;
}

export { COOKIE_NAME };
