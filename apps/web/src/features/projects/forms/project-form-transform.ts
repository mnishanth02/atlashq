import type {
  ProjectPhase,
  ProjectPriority,
  ProjectStatus,
  ProjectType,
  ProjectVisibility,
  ProjectWritableStatus,
} from "@atlashq/types";
import type { CreateProjectInput, UpdateProjectInput } from "@/features/api";

/**
 * String-first representation of a project used by the create/edit form. Every
 * field is a plain string (or a controlled enum) so it maps directly onto
 * native inputs and Radix selects; the API-shaped payloads are derived from
 * this by the transforms below. Keep this in lockstep with `projectFormSchema`
 * — `zodResolver` pins the two together at compile time in `ProjectForm`.
 */
export type ProjectFormValues = {
  name: string;
  type: ProjectType;
  clientId: string;
  ownerId: string;
  techLeadId: string;
  businessOwnerId: string;
  startDate: string;
  targetDate: string;
  status: ProjectWritableStatus;
  phase: ProjectPhase;
  priority: ProjectPriority;
  visibility: ProjectVisibility;
  tags: string;
  description: string;
};

/** Minimal person shape the form needs for owner / lead assignment. */
export type ProjectFormPerson = {
  id: string;
  name: string;
};

/** Selectable person option, `hint` annotates the current user ("You"). */
export type PersonOption = {
  id: string;
  name: string;
  hint?: string;
};

/**
 * Structural subset of a project response used to seed edit-mode defaults.
 * Declared locally (rather than importing the generated DTO) so the transforms
 * stay decoupled from the wire type and trivially unit-testable.
 */
export type ProjectFormSource = {
  name: string;
  type: ProjectType;
  clientId: string | null;
  ownerId: string;
  techLeadId: string | null;
  businessOwnerId: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: ProjectStatus;
  phase: ProjectPhase;
  priority: ProjectPriority;
  visibility: ProjectVisibility;
  tags: readonly string[];
  description: string | null;
};

const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Trim a value; return `undefined` when it is blank (for omit-when-empty payloads). */
function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Convert a `<input type="date">` value (`YYYY-MM-DD`) to an offset-qualified
 * ISO datetime at UTC midnight, or `undefined` when blank/malformed. Anchoring
 * to `T00:00:00.000Z` keeps the round-trip deterministic regardless of the
 * viewer's timezone.
 */
export function dateInputToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!DATE_INPUT_PATTERN.test(trimmed)) {
    return undefined;
  }
  return `${trimmed}T00:00:00.000Z`;
}

/** Extract the `YYYY-MM-DD` portion of an ISO datetime for a date input. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? "";
}

/**
 * Parse a free-form tag string (comma or newline separated) into a trimmed,
 * de-duplicated, order-preserving list.
 */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const piece of raw.split(/[\n,]/)) {
    const tag = piece.trim();
    if (tag === "" || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Render a tag list back into the editable comma-separated string. */
export function formatTags(tags: readonly string[]): string {
  return tags.join(", ");
}

/**
 * Build the ordered candidate list for owner / tech-lead / business-owner
 * selects. The current user is always first (annotated "You"); any already
 * assigned people (edit mode) are appended without fabricating directory
 * entries. De-duplicates by id so a future directory endpoint can be merged in
 * without special-casing the current user.
 */
export function buildPersonOptions(
  currentUser: ProjectFormPerson | undefined,
  ...existing: Array<ProjectFormPerson | null | undefined>
): PersonOption[] {
  const options: PersonOption[] = [];
  const seen = new Set<string>();

  const add = (person: ProjectFormPerson | null | undefined, hint?: string) => {
    if (!person || person.id === "" || seen.has(person.id)) {
      return;
    }
    seen.add(person.id);
    options.push({ id: person.id, name: person.name, ...(hint ? { hint } : {}) });
  };

  add(currentUser, "You");
  for (const person of existing) {
    add(person);
  }
  return options;
}

/** Create-mode defaults; owner is pre-filled with the current user. */
export function createProjectFormDefaults(
  currentUser: ProjectFormPerson | undefined,
): ProjectFormValues {
  return {
    name: "",
    type: "client",
    clientId: "",
    ownerId: currentUser?.id ?? "",
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
  };
}

/** Edit-mode defaults derived from an existing project. */
export function editProjectFormDefaults(project: ProjectFormSource): ProjectFormValues {
  return {
    name: project.name,
    type: project.type,
    clientId: project.clientId ?? "",
    ownerId: project.ownerId,
    techLeadId: project.techLeadId ?? "",
    businessOwnerId: project.businessOwnerId ?? "",
    startDate: isoToDateInput(project.startDate),
    targetDate: isoToDateInput(project.targetDate),
    status: project.status === "archived" ? "active" : project.status,
    phase: project.phase,
    priority: project.priority,
    visibility: project.visibility,
    tags: formatTags(project.tags),
    description: project.description ?? "",
  };
}

/**
 * Map form values to a `POST /projects` body. Optional fields are omitted (not
 * set to `undefined`) to satisfy `exactOptionalPropertyTypes`; `clientId` is
 * only forwarded for `client` projects so `internal` projects never carry one.
 */
export function toCreateProjectInput(values: ProjectFormValues): CreateProjectInput {
  const techLeadId = normalizeOptional(values.techLeadId);
  const businessOwnerId = normalizeOptional(values.businessOwnerId);
  const startDate = dateInputToIso(values.startDate);
  const targetDate = dateInputToIso(values.targetDate);
  const description = normalizeOptional(values.description);

  const common = {
    name: values.name.trim(),
    ownerId: values.ownerId.trim(),
    status: values.status,
    phase: values.phase,
    priority: values.priority,
    visibility: values.visibility,
    tags: parseTags(values.tags),
    ...(techLeadId ? { techLeadId } : {}),
    ...(businessOwnerId ? { businessOwnerId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(targetDate ? { targetDate } : {}),
    ...(description ? { description } : {}),
  };

  return values.type === "client"
    ? { ...common, type: "client", clientId: values.clientId.trim() }
    : { ...common, type: "internal" };
}

/**
 * Map form values to a `PATCH /projects/:id` body. Emits the full editable
 * field set and encodes cleared nullable fields as explicit `null` (rather than
 * omitting them) so an edit can actively unset a client, lead, date, or
 * description. `internal` projects always send `clientId: null`.
 */
export function toUpdateProjectInput(
  values: ProjectFormValues,
  version: number,
): UpdateProjectInput {
  const clientId = values.type === "client" ? normalizeOptional(values.clientId) : undefined;

  return {
    version,
    name: values.name.trim(),
    type: values.type,
    ownerId: values.ownerId.trim(),
    status: values.status,
    phase: values.phase,
    priority: values.priority,
    visibility: values.visibility,
    tags: parseTags(values.tags),
    clientId: clientId ?? null,
    techLeadId: normalizeOptional(values.techLeadId) ?? null,
    businessOwnerId: normalizeOptional(values.businessOwnerId) ?? null,
    startDate: dateInputToIso(values.startDate) ?? null,
    targetDate: dateInputToIso(values.targetDate) ?? null,
    description: normalizeOptional(values.description) ?? null,
  };
}
