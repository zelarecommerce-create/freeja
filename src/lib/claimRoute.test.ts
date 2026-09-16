import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { claimRoute } from "./claimRoute";

async function createDisponivelRoute() {
  const client = await prisma.client.create({
    data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
  });
  return prisma.route.create({
    data: {
      clientId: client.id,
      origem: "São Paulo",
      destino: "Campinas",
      distanciaKm: 100,
      valorKm: 3,
      valorTotal: 300,
      pesoKg: 50,
      volumeM3: 1,
      status: "DISPONIVEL",
    },
  });
}

let driverCounter = 0;
async function createDriver() {
  driverCounter += 1;
  const driver = await prisma.driver.create({
    data: {
      nome: "Driver",
      cpf: `cpf-${Date.now()}-${driverCounter}`,
      telefone: "11988888888",
      chavePix: "driver@example.com",
      rntrc: "12345678",
      cidadeBase: "São Paulo",
      tipoVeiculo: "VAN",
      capacidadeKg: 1000,
      capacidadeM3: 10,
    },
  });
  return driver.id;
}

describe("claimRoute", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lets the first driver claim an available route", async () => {
    const route = await createDisponivelRoute();
    const driverId = await createDriver();
    const result = await claimRoute(route.id, driverId);
    expect(result).toEqual({ claimed: true });

    const updated = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updated?.status).toBe("ASSUMIDA");
    expect(updated?.driverId).toBe(driverId);
  });

  it("rejects a second driver claiming the same route", async () => {
    const route = await createDisponivelRoute();
    const driver1 = await createDriver();
    const driver2 = await createDriver();
    await claimRoute(route.id, driver1);
    const result = await claimRoute(route.id, driver2);
    expect(result).toEqual({ claimed: false, reason: "already_claimed" });
  });

  it("reports not_found for a nonexistent route", async () => {
    const driverId = await createDriver();
    const result = await claimRoute("does-not-exist", driverId);
    expect(result).toEqual({ claimed: false, reason: "not_found" });
  });

  it("logs a route event on successful claim", async () => {
    const route = await createDisponivelRoute();
    const driverId = await createDriver();
    await claimRoute(route.id, driverId);
    const events = await prisma.routeEvent.findMany({ where: { routeId: route.id } });
    expect(events.map((e) => e.tipo)).toContain("assumida");
  });
});
