import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "./db";
import * as storage from "./storage";
import * as asaas from "./asaas";
import { completeRoute, RouteNotCompletableError } from "./completeRoute";

// ponytail: DB isn't reset between test runs, so hardcoded unique fields
// (cpf) collide on rerun. Suffix per run, same fix as handlePaymentConfirmed.test.ts.
const runId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

beforeEach(() => {
  // Spies are module-level and their call history would otherwise leak between
  // tests, which the "called exactly once" assertions below depend on.
  vi.restoreAllMocks();
  process.env.MARGEM_EMPRESA_PERCENTUAL = "0.20";
  vi.spyOn(storage, "uploadComprovante").mockResolvedValue("https://supabase/proof.jpg");
  vi.spyOn(asaas, "createTransfer").mockResolvedValue({ id: "trf_1", status: "PENDING" });
});

describe("completeRoute", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("marks the route complete and pays out 80% of the value to the driver", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista",
        cpf: `3${runId}`.slice(0, 11),
        telefone: "5511933333333",
        chavePix: "chave-pix-driver",
        rntrc: "RNTRC3",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=");

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("CONCLUIDA");

    const payout = await prisma.payout.findUnique({ where: { routeId: route.id } });
    expect(payout?.valorRepasse).toBe(192); // 240 * (1 - 0.20)
    expect(payout?.asaasTransferId).toBe("trf_1");
    expect(payout?.status).toBe("pago");

    expect(asaas.createTransfer).toHaveBeenCalledWith({
      chavePix: driver.chavePix,
      valor: 192,
      descricao: expect.stringContaining(route.id),
    });
  });

  it("rejects completion without a photo", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller2", telefone: "11999999999", email: "seller2@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista2",
        cpf: `4${runId}`.slice(0, 11),
        telefone: "5511944444444",
        chavePix: "chave-pix-driver2",
        rntrc: "RNTRC4",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await expect(completeRoute(route.id, driver.id, "")).rejects.toThrow("comprovante é obrigatório");
  });

  it("keeps the route CONCLUIDA and records a failed payout when the transfer fails", async () => {
    vi.spyOn(asaas, "createTransfer").mockRejectedValue(new Error("chave PIX inválida"));

    const client = await prisma.client.create({
      data: { nome: "Seller3", telefone: "11999999999", email: "seller3@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista3",
        cpf: `7${runId}`.slice(0, 11),
        telefone: "5511977777777",
        chavePix: "chave-invalida",
        rntrc: "RNTRC6",
        cidadeBase: "São Paulo",
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });

    await completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=");

    const updatedRoute = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updatedRoute?.status).toBe("CONCLUIDA");

    const payout = await prisma.payout.findUnique({ where: { routeId: route.id } });
    expect(payout?.status).toBe("falhou");
    expect(payout?.asaasTransferId).toBeNull();
    expect(payout?.valorRepasse).toBe(192);
  });

  async function fixture(tag: string) {
    const client = await prisma.client.create({
      data: { nome: `Seller-${tag}`, telefone: "11999999999", email: `${tag}@example.com` },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: `Motorista-${tag}`,
        cpf: `cpf-${runId}-${tag}`,
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
        driverId: driver.id,
        origem: "São Paulo",
        destino: "Santos",
        distanciaKm: 80,
        valorKm: 3,
        valorTotal: 240,
        pesoKg: 50,
        volumeM3: 1,
        status: "ASSUMIDA",
      },
    });
    return { driver, route };
  }

  it("rejects a driver who is not the one assigned to the route, without paying anyone", async () => {
    const { route } = await fixture("wrongdriver");
    const outsider = await fixture("outsider");

    await expect(
      completeRoute(route.id, outsider.driver.id, "data:image/jpeg;base64,aGVsbG8=")
    ).rejects.toBeInstanceOf(RouteNotCompletableError);

    expect(asaas.createTransfer).not.toHaveBeenCalled();
    const untouched = await prisma.route.findUnique({ where: { id: route.id } });
    expect(untouched?.status).toBe("ASSUMIDA");
    expect(await prisma.payout.findUnique({ where: { routeId: route.id } })).toBeNull();
  });

  it("is idempotent — a second completion never triggers a second transfer", async () => {
    const { driver, route } = await fixture("double");

    await completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=");
    await expect(
      completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=")
    ).rejects.toBeInstanceOf(RouteNotCompletableError);

    expect(asaas.createTransfer).toHaveBeenCalledTimes(1);
    const payouts = await prisma.payout.findMany({ where: { routeId: route.id } });
    expect(payouts).toHaveLength(1);
  });

  it("refuses a MARGEM_EMPRESA_PERCENTUAL that isn't a fraction between 0 and 1", async () => {
    const { driver, route } = await fixture("margem");
    process.env.MARGEM_EMPRESA_PERCENTUAL = "20"; // "20 percent" written the natural way

    await expect(
      completeRoute(route.id, driver.id, "data:image/jpeg;base64,aGVsbG8=")
    ).rejects.toThrow("MARGEM_EMPRESA_PERCENTUAL");

    expect(asaas.createTransfer).not.toHaveBeenCalled();
    const untouched = await prisma.route.findUnique({ where: { id: route.id } });
    expect(untouched?.status).toBe("ASSUMIDA");
  });
});
