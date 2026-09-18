import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/tokens";
import { GET, POST } from "./route";

function authedPost(body: string): NextRequest {
  const token = signToken({ routeId: "internal", subjectId: "equipe", kind: "client", exp: Math.floor(Date.now() / 1000) + 3600 });
  return new NextRequest("http://localhost/api/drivers", {
    method: "POST",
    headers: { cookie: `internal_session=${token}`, "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  process.env.TOKEN_SECRET = "test-secret";
});

describe("/api/drivers without an internal session", () => {
  it("rejects GET with 401", async () => {
    const res = await GET(new NextRequest("http://localhost/api/drivers"));
    expect(res.status).toBe(401);
  });

  it("rejects POST with 401", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/drivers", { method: "POST", body: JSON.stringify({}) })
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/drivers with an internal session", () => {
  it("rejects a null body with 400", async () => {
    const res = await POST(authedPost("null"));
    expect(res.status).toBe(400);
  });
});
