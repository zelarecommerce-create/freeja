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

    await expect(logLocation(route.id, driver.id, "Volta Redonda")).resolves.toBe(true);

    const events = await prisma.routeEvent.findMany({ where: { routeId: route.id } });
    expect(events).toHaveLength(1);
    expect(events[0].tipo).toBe("localizacao_atualizada");
    expect(events[0].payload).toMatchObject({ cidade: "Volta Redonda", driverId: driver.id });
  });

  it("refuses a driver who is not the one assigned to the route", async () => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });

    const [assigned, outsider] = await Promise.all(
      ["assigned", "outsider"].map((role) =>
        prisma.driver.create({
          data: {
            nome: `Driver ${role}`,
            cpf: `cpf-${tag}-${role}`,
            telefone: "11988888888",
            chavePix: `${role}@example.com`,
            rntrc: "12345678",
            cidadeBase: "São Paulo",
            tipoVeiculo: "VAN",
            capacidadeKg: 1000,
            capacidadeM3: 10,
          },
        })
      )
    );

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
        driverId: assigned.id,
      },
    });

    await expect(logLocation(route.id, outsider.id, "Volta Redonda")).resolves.toBe(false);
    expect(await prisma.routeEvent.findMany({ where: { routeId: route.id } })).toHaveLength(0);
  });
});
