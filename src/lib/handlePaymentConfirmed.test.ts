import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "./db";
import * as notifier from "./notifyEligibleDrivers";
import { handlePaymentConfirmed } from "./handlePaymentConfirmed";

describe("handlePaymentConfirmed", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("releases the route and notifies drivers", async () => {
    vi.spyOn(notifier, "notifyEligibleDrivers").mockResolvedValue(2);

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "AGUARDANDO_PAGAMENTO",
      },
    });
    const asaasChargeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.payment.create({
      data: { routeId: route.id, asaasChargeId, valorRecebido: 0, status: "PENDING" },
    });

    await handlePaymentConfirmed(asaasChargeId, 240);

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("DISPONIVEL");

    const updatedPayment = await prisma.payment.findUnique({ where: { routeId: route.id } });
    expect(updatedPayment?.status).toBe("CONFIRMED");
    expect(updatedPayment?.valorRecebido).toBe(240);

    expect(notifier.notifyEligibleDrivers).toHaveBeenCalledWith(route.id);
  });
});
