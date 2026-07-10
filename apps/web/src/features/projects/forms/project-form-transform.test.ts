import { describe, expect, it } from "vitest";
import {
  buildPersonOptions,
  createProjectFormDefaults,
  dateInputToIso,
  editProjectFormDefaults,
  formatTags,
  isoToDateInput,
  type ProjectFormSource,
  type ProjectFormValues,
  parseTags,
  toCreateProjectInput,
  toUpdateProjectInput,
} from "./project-form-transform";

function baseValues(overrides: Partial<ProjectFormValues> = {}): ProjectFormValues {
  return {
    name: "Atlas Rollout",
    type: "client",
    clientId: "client_1",
    ownerId: "user_1",
    techLeadId: "",
    businessOwnerId: "",
    startDate: "",
    targetDate: "",
    status: "draft",
    phase: "intake",
    priority: "medium",
    visibility: "organization",
    tags: "",
    description: "",
    ...overrides,
  };
}

describe("dateInputToIso / isoToDateInput", () => {
  it("anchors a date input to UTC midnight", () => {
    expect(dateInputToIso("2024-06-01")).toBe("2024-06-01T00:00:00.000Z");
  });

  it("returns undefined for blank or malformed input", () => {
    expect(dateInputToIso("")).toBeUndefined();
    expect(dateInputToIso("2024/06/01")).toBeUndefined();
    expect(dateInputToIso("not-a-date")).toBeUndefined();
  });

  it("extracts the calendar date from an ISO datetime and round-trips", () => {
    expect(isoToDateInput("2024-06-01T00:00:00.000Z")).toBe("2024-06-01");
    expect(isoToDateInput(null)).toBe("");
    expect(isoToDateInput(undefined)).toBe("");
    const iso = dateInputToIso("2024-12-31");
    expect(isoToDateInput(iso ?? "")).toBe("2024-12-31");
  });
});

describe("parseTags / formatTags", () => {
  it("splits on commas and newlines, trims, and de-duplicates preserving order", () => {
    expect(parseTags("alpha, beta\nbeta,  gamma ,,alpha")).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("  , \n ")).toEqual([]);
  });

  it("round-trips through formatTags", () => {
    expect(formatTags(["alpha", "beta"])).toBe("alpha, beta");
    expect(parseTags(formatTags(["alpha", "beta"]))).toEqual(["alpha", "beta"]);
  });
});

describe("buildPersonOptions", () => {
  it("places the current user first with a 'You' hint and de-duplicates by id", () => {
    const options = buildPersonOptions(
      { id: "user_1", name: "Ada" },
      { id: "user_2", name: "Grace" },
      { id: "user_1", name: "Ada (dupe)" },
      null,
      undefined,
    );
    expect(options).toEqual([
      { id: "user_1", name: "Ada", hint: "You" },
      { id: "user_2", name: "Grace" },
    ]);
  });

  it("skips a missing current user and blank ids", () => {
    expect(buildPersonOptions(undefined)).toEqual([]);
    expect(buildPersonOptions({ id: "", name: "Nobody" })).toEqual([]);
  });
});

describe("createProjectFormDefaults", () => {
  it("pre-fills the owner with the current user and sensible defaults", () => {
    const defaults = createProjectFormDefaults({ id: "user_1", name: "Ada" });
    expect(defaults.ownerId).toBe("user_1");
    expect(defaults.type).toBe("client");
    expect(defaults.status).toBe("draft");
    expect(defaults.phase).toBe("intake");
    expect(defaults.priority).toBe("medium");
    expect(defaults.visibility).toBe("organization");
  });

  it("leaves the owner blank when there is no current user", () => {
    expect(createProjectFormDefaults(undefined).ownerId).toBe("");
  });
});

describe("editProjectFormDefaults", () => {
  const source: ProjectFormSource = {
    name: "Atlas",
    type: "client",
    clientId: "client_1",
    ownerId: "user_1",
    techLeadId: "user_2",
    businessOwnerId: null,
    startDate: "2024-01-01T00:00:00.000Z",
    targetDate: null,
    status: "active",
    phase: "delivery",
    priority: "high",
    visibility: "private",
    tags: ["alpha", "beta"],
    description: null,
  };

  it("maps nullable source fields to empty strings and formats tags/dates", () => {
    const defaults = editProjectFormDefaults(source);
    expect(defaults.businessOwnerId).toBe("");
    expect(defaults.targetDate).toBe("");
    expect(defaults.description).toBe("");
    expect(defaults.startDate).toBe("2024-01-01");
    expect(defaults.tags).toBe("alpha, beta");
    expect(defaults.techLeadId).toBe("user_2");
  });
});

describe("toCreateProjectInput", () => {
  it("forwards clientId for client projects and omits blank optionals", () => {
    const input = toCreateProjectInput(baseValues({ tags: "alpha, beta" }));
    expect(input).toEqual({
      name: "Atlas Rollout",
      type: "client",
      ownerId: "user_1",
      status: "draft",
      phase: "intake",
      priority: "medium",
      visibility: "organization",
      tags: ["alpha", "beta"],
      clientId: "client_1",
    });
    expect("techLeadId" in input).toBe(false);
    expect("startDate" in input).toBe(false);
    expect("description" in input).toBe(false);
  });

  it("omits clientId entirely for internal projects even when set in the form", () => {
    const input = toCreateProjectInput(baseValues({ type: "internal", clientId: "client_1" }));
    expect("clientId" in input).toBe(false);
    expect(input.type).toBe("internal");
  });

  it("includes provided optional fields, trimming and converting dates", () => {
    const input = toCreateProjectInput(
      baseValues({
        name: "  Padded  ",
        techLeadId: "user_2",
        businessOwnerId: "user_3",
        startDate: "2024-01-01",
        targetDate: "2024-06-01",
        description: "  Kickoff  ",
      }),
    );
    expect(input.name).toBe("Padded");
    expect(input.techLeadId).toBe("user_2");
    expect(input.businessOwnerId).toBe("user_3");
    expect(input.startDate).toBe("2024-01-01T00:00:00.000Z");
    expect(input.targetDate).toBe("2024-06-01T00:00:00.000Z");
    expect(input.description).toBe("Kickoff");
  });
});

describe("toUpdateProjectInput", () => {
  it("encodes cleared nullable fields as explicit null", () => {
    const input = toUpdateProjectInput(
      baseValues({ type: "internal", techLeadId: "", businessOwnerId: "", description: "" }),
      7,
    );
    expect(input.version).toBe(7);
    expect(input.clientId).toBeNull();
    expect(input.techLeadId).toBeNull();
    expect(input.businessOwnerId).toBeNull();
    expect(input.startDate).toBeNull();
    expect(input.targetDate).toBeNull();
    expect(input.description).toBeNull();
  });

  it("sends concrete values for populated client projects", () => {
    const input = toUpdateProjectInput(
      baseValues({
        clientId: "client_9",
        techLeadId: "user_2",
        startDate: "2024-01-01",
        targetDate: "2024-02-01",
        description: "Notes",
        tags: "x, y",
      }),
      3,
    );
    expect(input.version).toBe(3);
    expect(input.clientId).toBe("client_9");
    expect(input.techLeadId).toBe("user_2");
    expect(input.startDate).toBe("2024-01-01T00:00:00.000Z");
    expect(input.targetDate).toBe("2024-02-01T00:00:00.000Z");
    expect(input.description).toBe("Notes");
    expect(input.tags).toEqual(["x", "y"]);
  });
});
