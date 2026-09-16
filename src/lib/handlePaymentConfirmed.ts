import { prisma } from "./db";
import { notifyEligibleDrivers } from "./notifyEligibleDrivers";

export async function handlePaymentConfirmed(asaasChargeId: string, valorRecebido: number): Promise<void> {
  const payment = await prisma.payment.findFirst({ where: { asaasChargeId } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "CONFIRMED", valorRecebido },
  });

  await prisma.route.update({
    where: { id: payment.routeId },
    data: { status: "DISPONIVEL" },
  });

  await notifyEligibleDrivers(payment.routeId);
}
