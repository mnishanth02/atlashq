import { describe, expect, it } from "vitest";
import { uiPrimitiveClassNames } from "./index.js";

describe("ui primitives", () => {
  it("keeps shared tokens neutral and radius-free", () => {
    expect(uiPrimitiveClassNames.surface).toContain("border-border");
    expect(uiPrimitiveClassNames.mutedSurface).toContain("bg-muted");
    expect(
      Object.values(uiPrimitiveClassNames).every((className) => !className.includes("rounded")),
    ).toBe(true);
  });
});
