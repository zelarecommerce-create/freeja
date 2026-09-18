import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import { prisma } from "./db";
import * as asaas from "./asaas";
import { createRouteWithCharge, ClienteSemAsaasError } from "./createRoute";
import { verifyToken } from "./tokens";

const input = {
  origem: "São Paulo",
  destino: "Belo Horizonte",
  distanciaKm: 590,
  valorKm: 3.5,
  pesoKg: 200,
  volumeM3: 2,
};

describe("createRouteWithCharge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TOKEN_SECRET = "test-secret";
    process.env.APP_URL = "https://fretaja.test";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a route in AGUARDANDO_PAGAMENTO with a linked Payment and a client tracking link", async () => {
    const createCharge = vi.spyOn(asaas, "createCharge").mockResolvedValue({
      id: "chg_1",
      status: "PENDING",
      invoiceUrl: "https://asaas/invoice/chg_1",
    });

    const asaasCustomerId = `cus_${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com", asaasCustomerId },
    });

    const route = await createRouteWithCharge({ clientId: client.id, ...input });

    expect(route.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(route.valorTotal).toBe(590 * 3.5);
    expect(createCharge).toHaveBeenCalledWith(expect.objectContaining({ customerAsaasId: asaasCustomerId }));

    const payment = await prisma.payment.findUnique({ where: { routeId: route.id } });
    expect(payment?.asaasChargeId).toBe("chg_1");

    // Without this the /cliente/[token] page is unreachable in the real flow.
    expect(route.clienteTrackingUrl).toContain("https://fretaja.test/cliente/");
    const token = route.clienteTrackingUrl.split("/cliente/")[1];
    expect(verifyToken(token)).toMatchObject({ routeId: route.id, kind: "client", subjectId: client.id });
  });

  it("rejects a client without an Asaas customer before creating anything", async () => {
    const createCharge = vi.spyOn(asaas, "createCharge");
    const client = await prisma.client.create({
      data: { nome: "Sem Asaas", telefone: "11999999999", email: "semasaas@example.com" },
    });

    await expect(createRouteWithCharge({ clientId: client.id, ...input })).rejects.toBeInstanceOf(ClienteSemAsaasError);

    expect(createCharge).not.toHaveBeenCalled();
    expect(await prisma.route.count({ where: { clientId: client.id } })).toBe(0);
  });
});
