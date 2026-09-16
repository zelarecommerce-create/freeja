import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendTextMessage } from "./whatsapp";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_TOKEN = "test-token";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("whatsapp", () => {
  it("sends a text message to the given phone", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    await sendTextMessage("5511999999999", "Nova rota disponível: SP-Campinas");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v19.0/123456/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the API call fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(sendTextMessage("5511999999999", "x")).rejects.toThrow("WhatsApp send failed: 401");
  });
});
