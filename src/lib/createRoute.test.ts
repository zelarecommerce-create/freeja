import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "./db";
import * as asaas from "./asaas";
import { createRouteWithCharge } from "./createRoute";
import { verifyToken } from "./tokens";

describe("createRouteWithCharge", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a route in AGUARDANDO_PAGAMENTO with a linked Payment and a client tracking link", async () => {
    process.env.TOKEN_SECRET = "test-secret";
    process.env.APP_URL = "https://fretaja.test";
    vi.spyOn(asaas, "createCharge").mockResolvedValue({
      id: "chg_1",
      status: "PENDING",
      invoiceUrl: "https://asaas/invoice/chg_1",
    });

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });

    const route = await createRouteWithCharge({
      clientId: client.id,
      clientAsaasId: "cus_1",
      origem: "São Paulo",
      destino: "Belo Horizonte",
      distanciaKm: 590,
      valorKm: 3.5,
      pesoKg: 200,
      volumeM3: 2,
    });

    expect(route.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(route.valorTotal).toBe(590 * 3.5);

    const payment = await prisma.payment.findUnique({ where: { routeId: route.id } });
    expect(payment?.asaasChargeId).toBe("chg_1");

    // Without this the /cliente/[token] page is unreachable in the real flow.
    expect(route.clienteTrackingUrl).toContain("https://fretaja.test/cliente/");
    const token = route.clienteTrackingUrl.split("/cliente/")[1];
    expect(verifyToken(token)).toMatchObject({ routeId: route.id, kind: "client", subjectId: client.id });
  });
});
