import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { logLocation } from "./logLocation";

describe("logLocation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("records a localizacao_atualizada event with the city", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });

    const driver = await prisma.driver.create({
      data: {
        nome: "Driver",
        cpf: `cpf-${Date.now()}-1`,
        telefone: "11988888888",
        chavePix: "driver@example.com",
        rntrc: "12345678",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 1000,
        capacidadeM3: 10,
      },
    });

    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Rio de Janeiro",
        distanciaKm: 430,
        valorKm: 3,
        valorTotal: 1290,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
        driverId: driver.id,
      },
    });

    await logLocation(route.id, driver.id, "Volta Redonda");

    const events = await prisma.routeEvent.findMany({ where: { routeId: route.id } });
    expect(events).toHaveLength(1);
    expect(events[0].tipo).toBe("localizacao_atualizada");
    expect(events[0].payload).toMatchObject({ cidade: "Volta Redonda", driverId: driver.id });
  });
});
