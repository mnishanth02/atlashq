import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns the API health placeholder", () => {
    expect(new HealthController().getHealth()).toEqual({
      status: "ok",
      service: "api",
      version: "0.0.0",
    });
  });
});
