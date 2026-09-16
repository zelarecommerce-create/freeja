import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createCharge, createTransfer } from "./asaas";

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
});
