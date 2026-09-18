import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createCharge, createCustomer, createTransfer } from "./asaas";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.ASAAS_API_KEY = "test-key";
  process.env.ASAAS_BASE_URL = "https://sandbox.asaas.com/api/v3";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("asaas", () => {
  it("creates a PIX charge", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chg_123", status: "PENDING", invoiceUrl: "https://asaas/x" }),
    }) as unknown as typeof fetch;

    const charge = await createCharge({
      customerAsaasId: "cus_1",
      valor: 300,
      descricao: "Frete SP-Campinas",
      externalReference: "route-1",
    });

    expect(charge.id).toBe("chg_123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/api/v3/payments",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the charge request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    await expect(
      createCharge({ customerAsaasId: "cus_1", valor: 300, descricao: "x", externalReference: "route-1" })
    ).rejects.toThrow("Asaas createCharge failed: 400");
  });

  it("creates a PIX transfer", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "trf_123", status: "PENDING" }),
    }) as unknown as typeof fetch;

    const transfer = await createTransfer({ chavePix: "11999999999", valor: 240, descricao: "Repasse rota" });

    expect(transfer.id).toBe("trf_123");
  });

  it("creates a customer", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "cus_123" }),
    }) as unknown as typeof fetch;

    const customer = await createCustomer({ nome: "Loja", cpfCnpj: "12345678901", email: "a@b.co", telefone: "11999999999" });

    expect(customer.id).toBe("cus_123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/api/v3/customers",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the customer request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;
    await expect(createCustomer({ nome: "Loja", cpfCnpj: "12345678901" })).rejects.toThrow("Asaas createCustomer failed: 400");
  });
});
