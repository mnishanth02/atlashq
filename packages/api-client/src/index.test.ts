import { describe, expect, it } from "vitest";
import { DEFAULT_API_BASE_URL, getHealthQueryKey } from "./index.js";

describe("api client placeholder", () => {
  it("defaults to same-origin API routing and keeps the health query key", () => {
    expect(DEFAULT_API_BASE_URL).toBe("");
    expect(getHealthQueryKey()).toEqual(["api", "health"]);
  });
});
