import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "./db";
import * as whatsapp from "./whatsapp";
import { notifyEligibleDrivers, releaseRoute } from "./notifyEligibleDrivers";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.TOKEN_SECRET = "test-secret";
  process.env.APP_URL = "https://fretaja.test";
  vi.spyOn(whatsapp, "sendTextMessage").mockResolvedValue();
});

const uniqueCity = () => `São Paulo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe("notifyEligibleDrivers", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("notifies only drivers whose vehicle and city fit the route", async () => {
    // Real, unreset Postgres DB accumulates Driver rows across test-suite runs
    // (e.g. claimRoute.test.ts leaves São Paulo/VAN drivers behind), which would
    // inflate the "ATIVO" + city match count below. A unique city per run keeps
    // this test's exact-count assertions isolated from that leftover data while
    // still exercising the same capacity+city filtering logic.
    const city = uniqueCity();

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: city,
        destino: "Campinas",
        distanciaKm: 100,
        valorKm: 3,
        valorTotal: 300,
        pesoKg: 80,
        volumeM3: 1,
        status: "DISPONIVEL",
      },
    });

    const fits = await prisma.driver.create({
      data: {
        nome: "Motorista Apto",
        cpf: `cpf-fits-${city}`,
        telefone: "5511911111111",
        chavePix: "chave1",
        rntrc: "RNTRC1",
        cidadeBase: city,
        tipoVeiculo: "FIORINO",
        capacidadeKg: 500,
        capacidadeM3: 3,
      },
    });
    await prisma.driver.create({
      data: {
        nome: "Motorista Moto",
        cpf: `cpf-moto-${city}`,
        telefone: "5511922222222",
        chavePix: "chave2",
        rntrc: "RNTRC2",
        cidadeBase: city,
        tipoVeiculo: "MOTO",
        capacidadeKg: 20,
        capacidadeM3: 0.1,
      },
    });

    const count = await notifyEligibleDrivers(route.id);

    expect(count).toBe(1);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(fits.telefone, expect.stringContaining("São Paulo"));
    // The link has to be absolute, or it is unclickable in WhatsApp.
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      fits.telefone,
      expect.stringContaining("https://fretaja.test/entregador/")
    );
  });

  it("refuses to send relative, unclickable links when APP_URL is unset", async () => {
    delete process.env.APP_URL;
    const city = uniqueCity();

    const client = await prisma.client.create({
      data: { nome: "Seller", telefone: "11999999999", email: "seller@example.com" },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        origem: city,
        destino: "Campinas",
        distanciaKm: 100,
        valorKm: 3,
        valorTotal: 300,
        pesoKg: 80,
        volumeM3: 1,
        status: "DISPONIVEL",
      },
    });
    await prisma.driver.create({
      data: {
        nome: "Motorista Apto",
        cpf: `cpf-noappurl-${city}`,
        telefone: "5511911111111",
        chavePix: "chave1",
        rntrc: "RNTRC1",
        cidadeBase: city,
        tipoVeiculo: "FIORINO",
        capacidadeKg: 500,
        capacidadeM3: 3,
      },
    });

    await expect(notifyEligibleDrivers(route.id)).rejects.toThrow("APP_URL");
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
  });
});

describe("releaseRoute", () => {
  it("puts the route back to DISPONIVEL and re-notifies eligible drivers", async () => {
    // Unique city: releaseRoute re-notifies for real, and a literal "São Paulo"
    // would fan out over every driver left in the shared DB by past runs.
    const city = uniqueCity();
    const client = await prisma.client.create({
      data: { nome: "Seller2", telefone: "11999999999", email: "seller2@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista Desistente",
        cpf: `cpf-desistente-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        telefone: "5511955555555",
        chavePix: "chave3",
        rntrc: "RNTRC5",
        cidadeBase: city,
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: city,
        destino: "Osasco",
        distanciaKm: 20,
        valorKm: 3,
        valorTotal: 60,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });

    const result = await releaseRoute(route.id, driver.id);
    expect(result).toEqual({ released: true });

    const updated = await prisma.route.findUnique({ where: { id: route.id } });
    expect(updated?.status).toBe("DISPONIVEL");
    expect(updated?.driverId).toBeNull();
  });

  it("rejects releasing a route assigned to a different driver", async () => {
    const city = uniqueCity();
    const client = await prisma.client.create({
      data: { nome: "Seller3", telefone: "11999999999", email: "seller3@example.com" },
    });
    // Route.driverId is a real FK to Driver.id, so it must reference an actual
    // Driver row (a bare string literal would fail with a FK-constraint error).
    const assignedDriver = await prisma.driver.create({
      data: {
        nome: "Motorista Atribuido",
        cpf: `cpf-atribuido-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        telefone: "5511966666666",
        chavePix: "chave4",
        rntrc: "RNTRC6",
        cidadeBase: city,
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: assignedDriver.id,
        origem: city,
        destino: "Osasco",
        distanciaKm: 20,
        valorKm: 3,
        valorTotal: 60,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "ASSUMIDA",
      },
    });

    // "driver-y" is never written to the DB (updateMany's WHERE only filters),
    // so it can stay a plain non-existent id — it just needs to differ from
    // the route's real assigned driverId.
    const result = await releaseRoute(route.id, "driver-y");
    expect(result).toEqual({ released: false, reason: "not_assigned_to_driver" });
  });

  it("rejects releasing a route the driver already completed (and was paid for)", async () => {
    const city = uniqueCity();
    const client = await prisma.client.create({
      data: { nome: "Seller4", telefone: "11999999999", email: "seller4@example.com" },
    });
    const driver = await prisma.driver.create({
      data: {
        nome: "Motorista Pago",
        cpf: `cpf-pago-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        telefone: "5511977777777",
        chavePix: "chave5",
        rntrc: "RNTRC7",
        cidadeBase: city,
        tipoVeiculo: "VAN",
        capacidadeKg: 500,
        capacidadeM3: 5,
      },
    });
    // completeRoute leaves driverId set on a CONCLUIDA route.
    const route = await prisma.route.create({
      data: {
        clientId: client.id,
        driverId: driver.id,
        origem: city,
        destino: "Osasco",
        distanciaKm: 20,
        valorKm: 3,
        valorTotal: 60,
        pesoKg: 30,
        volumeM3: 0.5,
        status: "CONCLUIDA",
      },
    });

    const result = await releaseRoute(route.id, driver.id);
    expect(result).toEqual({ released: false, reason: "not_assigned_to_driver" });

    const untouched = await prisma.route.findUnique({ where: { id: route.id } });
    expect(untouched?.status).toBe("CONCLUIDA");
    expect(untouched?.driverId).toBe(driver.id);
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
  });
});
