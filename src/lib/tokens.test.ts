import { describe, it, expect, beforeAll } from "vitest";
import { signToken, verifyToken } from "./tokens";

beforeAll(() => {
  process.env.TOKEN_SECRET = "test-secret";
});

describe("tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) + 3600 });
    const payload = verifyToken(token);
    expect(payload).toEqual({ routeId: "r1", subjectId: "d1", kind: "driver", exp: expect.any(Number) });
  });

  it("rejects a tampered token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) + 3600 });
    const tampered = token.slice(0, -2) + "xx";
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signToken({ routeId: "r1", subjectId: "d1", kind: "driver", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyToken("not-a-token")).toBeNull();
  });
});
