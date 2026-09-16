import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { getRouteTracking } from "./getRouteTracking";

describe("getRouteTracking", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns status, eta and last known location", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: "São Paulo",
        destino: "Curitiba",
        distanciaKm: 60,
        valorKm: 3,
        valorTotal: 180,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });
    await prisma.routeEvent.create({
      data: { routeId: route.id, tipo: "assumida", payload: { driverId: "d1" } },
    });
    await prisma.routeEvent.create({
      data: { routeId: route.id, tipo: "localizacao_atualizada", payload: { cidade: "Registro" } },
    });

    const tracking = await getRouteTracking(route.id);

    expect(tracking.status).toBe("ASSUMIDA");
    expect(tracking.ultimaLocalizacao).toBe("Registro");
    expect(tracking.etaEstimado).not.toBeNull();
    expect(tracking.eventos).toHaveLength(2);
  });
});
