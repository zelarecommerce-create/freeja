import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

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
