import { describe, expect, test } from "bun:test";

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  test("returns service health payload", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      service: string;
      status: string;
      now: string;
    };

    expect(body.service).toBe("shape-of-life-web");
    expect(body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(body.now))).toBe(false);
  });
});
