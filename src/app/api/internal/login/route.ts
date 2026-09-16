import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/tokens";
import { COOKIE_NAME } from "@/lib/internalAuth";

export async function POST(req: NextRequest) {
  const { senha } = await req.json();
  if (senha !== process.env.INTERNAL_PANEL_PASSWORD) {
    return NextResponse.json({ error: "senha incorreta" }, { status: 401 });
  }

  const token = signToken({
    routeId: "internal",
    subjectId: "equipe",
    kind: "client",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", path: "/" });
  return response;
}
