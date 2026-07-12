import { describe, expect, it } from "vitest";
import { loadDefaultFixtureSet } from "../index.js";

describe("fixture harness foundation", () => {
  it("loads the checked-in human-labeled gold and adversarial fixture projects", () => {
    const fixtures = loadDefaultFixtureSet();
    expect(fixtures).toHaveLength(12);
    expect(fixtures.filter((fixture) => fixture.kind === "gold")).toHaveLength(6);
    expect(fixtures.filter((fixture) => fixture.kind === "adversarial")).toHaveLength(6);

    const tags = new Set(fixtures.flatMap((fixture) => fixture.tags));
    expect(tags.has("clean_well_specified")).toBe(true);
    expect(tags.has("sparse_unknown_heavy")).toBe(true);
    expect(tags.has("multi_document_conflicts")).toBe(true);
    expect(tags.has("prompt_injection_adversarial")).toBe(true);
    expect(tags.has("reference_only_disabled_ip")).toBe(true);
    expect(tags.has("spreadsheet_tabular")).toBe(true);
    expect(tags.has("transcript_ambiguity")).toBe(true);
    expect(tags.has("security_compliance")).toBe(true);
    expect(fixtures.every((fixture) => fixture.runtime.stageKind === "confirmed_extraction")).toBe(
      true,
    );
  });
});
