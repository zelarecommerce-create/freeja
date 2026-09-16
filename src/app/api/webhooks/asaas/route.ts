import { NextRequest, NextResponse } from "next/server";
import { handlePaymentConfirmed } from "@/lib/handlePaymentConfirmed";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED") {
    await handlePaymentConfirmed(body.payment.id, body.payment.value);
  }

  return NextResponse.json({ ok: true });
}
