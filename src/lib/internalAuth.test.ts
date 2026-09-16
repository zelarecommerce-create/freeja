import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "./tokens";
import { requireInternalAuth } from "./internalAuth";

beforeEach(() => {
  process.env.TOKEN_SECRET = "test-secret";
});

function requestWithCookie(cookieValue?: string): NextRequest {
  const headers = new Headers();
  if (cookieValue) headers.set("cookie", `internal_session=${cookieValue}`);
  return new NextRequest("http://localhost/api/routes", { headers });
}

describe("requireInternalAuth", () => {
  it("rejects a request with no session cookie", () => {
    const result = requireInternalAuth(requestWithCookie());
    expect(result).not.toBeNull();
  });

  it("rejects a request with an invalid session token", () => {
    const result = requireInternalAuth(requestWithCookie("garbage"));
    expect(result).not.toBeNull();
  });

  it("accepts a request with a valid internal session token", () => {
    const token = signToken({ routeId: "internal", subjectId: "equipe", kind: "client", exp: Math.floor(Date.now() / 1000) + 3600 });
    const result = requireInternalAuth(requestWithCookie(token));
    expect(result).toBeNull();
  });
});
