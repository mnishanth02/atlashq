import { describe, expect, it } from "vitest";
import { createButtonClassName, surfaceClassName } from "./index.js";

describe("ui primitives", () => {
  it("returns reusable presentational class names", () => {
    expect(createButtonClassName("primary")).toContain("bg-primary");
    expect(surfaceClassName("p-6")).toContain("p-6");
  });
});
