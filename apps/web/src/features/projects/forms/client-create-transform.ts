import {
  clientContactPersonSchema,
  clientEmailSchema,
  clientNameSchema,
  clientNotesSchema,
} from "@atlashq/validators";
import { z } from "zod";
import type { CreateClientInput } from "@/features/api";

/** String-first values for the inline "create client" form. */
export type ClientCreateFormValues = {
  name: string;
  contactPerson: string;
  email: string;
  notes: string;
};

export const CLIENT_CREATE_FORM_FIELDS = [
  "name",
  "contactPerson",
  "email",
  "notes",
] as const satisfies ReadonlyArray<keyof ClientCreateFormValues>;

export const clientCreateFormDefaults: ClientCreateFormValues = {
  name: "",
  contactPerson: "",
  email: "",
  notes: "",
};

/** Validates the inline client form, reusing the shared client validators. */
export const clientCreateFormSchema = z
  .object({
    name: z.string(),
    contactPerson: z.string(),
    email: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!clientNameSchema.safeParse(values.name).success) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Enter a client name (1–200 characters).",
      });
    }

    if (
      values.contactPerson.trim() !== "" &&
      !clientContactPersonSchema.safeParse(values.contactPerson).success
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["contactPerson"],
        message: "Contact person is too long (max 200 characters).",
      });
    }

    if (values.email.trim() !== "" && !clientEmailSchema.safeParse(values.email.trim()).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email address.",
      });
    }

    if (values.notes.trim() !== "" && !clientNotesSchema.safeParse(values.notes).success) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Notes are too long (max 4000 characters).",
      });
    }
  });

type SchemaValues = z.infer<typeof clientCreateFormSchema>;
const _assertSchemaMatchesFormValues: (value: SchemaValues) => ClientCreateFormValues = (value) =>
  value;
void _assertSchemaMatchesFormValues;

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Map inline-client form values to a `POST /clients` body. New clients default
 * to `active` status so they are immediately selectable in the client picker;
 * blank optional fields are omitted.
 */
export function toCreateClientInput(values: ClientCreateFormValues): CreateClientInput {
  const contactPerson = normalizeOptional(values.contactPerson);
  const email = normalizeOptional(values.email);
  const notes = normalizeOptional(values.notes);

  return {
    name: values.name.trim(),
    status: "active",
    ...(contactPerson ? { contactPerson } : {}),
    ...(email ? { email } : {}),
    ...(notes ? { notes } : {}),
  };
}
