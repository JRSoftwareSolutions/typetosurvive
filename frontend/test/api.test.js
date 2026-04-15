import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { joinRoom } from "../src/api.js";

describe("frontend api client (regression)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (_url, _opts) => ({
      ok: true,
      json: async () => ({ room: { players: {} }, playerId: "p_test" }),
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("includes playerId when provided to joinRoom", async () => {
    await joinRoom("ABC123", "name", "p_existing");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, opts] = globalThis.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body).toEqual({ username: "name", playerId: "p_existing" });
  });
});

