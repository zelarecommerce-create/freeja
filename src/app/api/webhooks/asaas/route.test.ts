import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as handler from "@/lib/handlePaymentConfirmed";
import { POST } from "./route";

const TOKEN = "webhook-secret";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.ASAAS_WEBHOOK_TOKEN = TOKEN;
  vi.spyOn(handler, "handlePaymentConfirmed").mockResolvedValue();
});

function post(body: unknown, token?: string): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("asaas-access-token", token);
  return new NextRequest("http://localhost/api/webhooks/asaas", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const confirmed = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", value: 240 } };

describe("POST /api/webhooks/asaas", () => {
  it("rejects a request with no webhook token", async () => {
    const res = await POST(post(confirmed));
    expect(res.status).toBe(401);
    expect(handler.handlePaymentConfirmed).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong webhook token", async () => {
    const res = await POST(post(confirmed, "guessed"));
    expect(res.status).toBe(401);
    expect(handler.handlePaymentConfirmed).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload with 400 instead of blowing up with a 500", async () => {
    const res = await POST(post({ event: "PAYMENT_CONFIRMED" }, TOKEN));
    expect(res.status).toBe(400);
    expect(handler.handlePaymentConfirmed).not.toHaveBeenCalled();
  });

  it("processes a well-formed authenticated confirmation", async () => {
    const res = await POST(post(confirmed, TOKEN));
    expect(res.status).toBe(200);
    expect(handler.handlePaymentConfirmed).toHaveBeenCalledWith("pay_1", 240);
  });
});
