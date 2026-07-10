import {
  projectDescriptionSchema,
  projectNameSchema,
  projectPhaseSchema,
  projectPrioritySchema,
  projectTagSchema,
  projectTypeSchema,
  projectVisibilitySchema,
  projectWritableStatusSchema,
} from "@atlashq/validators";
import { z } from "zod";
import { type ProjectFormValues, parseTags } from "./project-form-transform";

const MAX_TAGS = 20;

/**
 * Zod schema over the string-first {@link ProjectFormValues}. Field rules reuse
 * the shared `@atlashq/validators` schemas (via `safeParse`) so the form matches
 * the API contract exactly, while the enum fields reuse the shared enum schemas
 * directly. No field transforms are applied here — trimming/parsing happens in
 * the transforms — so the resolver's input and output types both equal
 * `ProjectFormValues`.
 */
export const projectFormSchema = z
  .object({
    name: z.string(),
    type: projectTypeSchema,
    clientId: z.string(),
    ownerId: z.string(),
    techLeadId: z.string(),
    businessOwnerId: z.string(),
    startDate: z.string(),
    targetDate: z.string(),
    status: projectWritableStatusSchema,
    phase: projectPhaseSchema,
    priority: projectPrioritySchema,
    visibility: projectVisibilitySchema,
    tags: z.string(),
    description: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!projectNameSchema.safeParse(values.name).success) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Enter a project name (1–200 characters).",
      });
    }

    if (values.ownerId.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["ownerId"],
        message: "An owner is required.",
      });
    }

    if (values.type === "client" && values.clientId.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Select a client for client projects.",
      });
    }

    const tags = parseTags(values.tags);
    if (tags.length > MAX_TAGS) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: `Use at most ${MAX_TAGS} tags.`,
      });
    }
    if (tags.some((tag) => !projectTagSchema.safeParse(tag).success)) {
      ctx.addIssue({
        code: "custom",
        path: ["tags"],
        message: "Each tag must be 1–64 characters.",
      });
    }

    if (
      values.description.trim() !== "" &&
      !projectDescriptionSchema.safeParse(values.description).success
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Description is too long (max 4000 characters).",
      });
    }

    if (
      values.startDate !== "" &&
      values.targetDate !== "" &&
      values.targetDate < values.startDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date can't be before the start date.",
      });
    }
  });

// Compile-time guarantee the schema output matches the hand-written form shape.
type SchemaValues = z.infer<typeof projectFormSchema>;
const _assertSchemaMatchesFormValues: (value: SchemaValues) => ProjectFormValues = (value) => value;
void _assertSchemaMatchesFormValues;

/** Ordered list of writable form fields, used to route API field errors. */
export const PROJECT_FORM_FIELDS = [
  "name",
  "type",
  "clientId",
  "ownerId",
  "techLeadId",
  "businessOwnerId",
  "startDate",
  "targetDate",
  "status",
  "phase",
  "priority",
  "visibility",
  "tags",
  "description",
] as const satisfies ReadonlyArray<keyof ProjectFormValues>;

type SelectOption<T extends string> = { value: T; label: string };

export const PROJECT_TYPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "internal", label: "Internal" },
] as const satisfies ReadonlyArray<SelectOption<ProjectFormValues["type"]>>;

export const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
] as const satisfies ReadonlyArray<SelectOption<ProjectFormValues["status"]>>;

export const PROJECT_PHASE_OPTIONS = [
  { value: "intake", label: "Intake" },
  { value: "requirements", label: "Requirements" },
  { value: "clarification", label: "Clarification" },
  { value: "baseline", label: "Baseline" },
  { value: "architecture", label: "Architecture" },
  { value: "delivery", label: "Delivery" },
  { value: "handoff", label: "Handoff" },
  { value: "closed", label: "Closed" },
] as const satisfies ReadonlyArray<SelectOption<ProjectFormValues["phase"]>>;

export const PROJECT_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const satisfies ReadonlyArray<SelectOption<ProjectFormValues["priority"]>>;

export const PROJECT_VISIBILITY_OPTIONS = [
  { value: "organization", label: "Organization" },
  { value: "private", label: "Private" },
] as const satisfies ReadonlyArray<SelectOption<ProjectFormValues["visibility"]>>;
