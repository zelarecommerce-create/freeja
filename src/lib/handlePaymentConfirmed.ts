import { prisma } from "./db";
import { notifyEligibleDrivers } from "./notifyEligibleDrivers";

export async function handlePaymentConfirmed(asaasChargeId: string, valorRecebido: number): Promise<void> {
  const payment = await prisma.payment.findFirst({ where: { asaasChargeId } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "CONFIRMED", valorRecebido },
  });

  // Asaas sends PAYMENT_CONFIRMED *and* PAYMENT_RECEIVED for the same PIX (plus
  // retries), so this runs more than once. Only the call that actually moves the
  // route out of AGUARDANDO_PAGAMENTO may notify — otherwise a later duplicate
  // would yank an already-claimed route back to DISPONIVEL mid-delivery.
  const released = await prisma.route.updateMany({
    where: { id: payment.routeId, status: "AGUARDANDO_PAGAMENTO" },
    data: { status: "DISPONIVEL" },
  });
  if (released.count === 0) return;

  await notifyEligibleDrivers(payment.routeId);
}
