import { NextRequest, NextResponse } from "next/server";
import { handlePaymentConfirmed } from "@/lib/handlePaymentConfirmed";

// Asaas sends the token configured on the webhook in this header.
const AUTH_HEADER = "asaas-access-token";

export async function POST(req: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || req.headers.get(AUTH_HEADER) !== expected) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payment = body?.payment;
  if (typeof payment?.id !== "string" || typeof payment?.value !== "number") {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  if (body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED") {
    await handlePaymentConfirmed(payment.id, payment.value);
  }

  return NextResponse.json({ ok: true });
}
