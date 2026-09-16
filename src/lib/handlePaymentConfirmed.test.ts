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

  it("ignores the duplicate webhook: does not re-notify nor unclaim a route a driver already took", async () => {
    vi.restoreAllMocks();
    vi.spyOn(notifier, "notifyEligibleDrivers").mockResolvedValue(2);

    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista",
        cpf: `cpf-dup-${tag}`,
        telefone: "5511900000000",
        chavePix: `pix-${tag}`,
        rntrc: `RNTRC-${tag}`,
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
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
    const asaasChargeId = `chg_${tag}`;
    await prisma.payment.create({
      data: { routeId: route.id, asaasChargeId, valorRecebido: 0, status: "PENDING" },
    });

    // PAYMENT_CONFIRMED, then a driver claims it, then PAYMENT_RECEIVED arrives.
    await handlePaymentConfirmed(asaasChargeId, 240);
    await prisma.route.update({
      where: { id: route.id },
      data: { status: "ASSUMIDA", driverId: driver.id },
    });
    await handlePaymentConfirmed(asaasChargeId, 240);

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("ASSUMIDA");
    expect(updatedRoute?.driverId).toBe(driver.id);
    expect(notifier.notifyEligibleDrivers).toHaveBeenCalledTimes(1);
  });
});
