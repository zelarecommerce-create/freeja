import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import { prisma } from "./db";
import * as asaas from "./asaas";
import { registerClient } from "./registerClient";
import { ValidationError } from "./validation";

const uniq = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

describe("registerClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the Asaas customer and stores digits-only cpfCnpj with the customer id", async () => {
    const asaasCustomerId = `cus_${uniq()}`;
    const createCustomer = vi.spyOn(asaas, "createCustomer").mockResolvedValue({ id: asaasCustomerId });

    const client = await registerClient({
      nome: "  Loja Teste ",
      cpfCnpj: "123.456.789-01",
      telefone: "(11) 99999-1234",
      email: `loja${uniq()}@example.com`,
    });

    expect(createCustomer).toHaveBeenCalledTimes(1);
    const row = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.cpfCnpj).toBe("12345678901");
    expect(row.asaasCustomerId).toBe(asaasCustomerId);
  });

  it("rejects an invalid cpfCnpj without calling Asaas", async () => {
    const createCustomer = vi.spyOn(asaas, "createCustomer");

    await expect(
      registerClient({ nome: "Loja", cpfCnpj: "123", telefone: "11999991234", email: `x${uniq()}@example.com` })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("creates no Client row when Asaas fails", async () => {
    vi.spyOn(asaas, "createCustomer").mockRejectedValue(new Error("Asaas createCustomer failed: 400"));
    const email = `falha${uniq()}@example.com`;

    await expect(
      registerClient({ nome: "Loja", cpfCnpj: "12345678901", telefone: "11999991234", email })
    ).rejects.toThrow("Asaas createCustomer failed: 400");

    expect(await prisma.client.count({ where: { email } })).toBe(0);
  });
});
