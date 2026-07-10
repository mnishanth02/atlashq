"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CreateClientInput } from "@/features/api";
import { applyApiFieldErrors, getApiErrorMessage } from "./apply-field-errors";
import {
  CLIENT_CREATE_FORM_FIELDS,
  type ClientCreateFormValues,
  clientCreateFormDefaults,
  clientCreateFormSchema,
  toCreateClientInput,
} from "./client-create-transform";

export type ClientCreateFormProps = {
  /** Persist the new client. Should reject with an `AtlasApiError` on failure. */
  onSubmit: (input: CreateClientInput) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
};

/**
 * Inline, nested "create client" form for organization admins. Lives inside the
 * project form's client step so an admin can add a missing client without
 * leaving the create-project flow. Purely presentational around the shared
 * `clientCreateFormSchema` / `toCreateClientInput` contract.
 */
export function ClientCreateForm({ onSubmit, onCancel, disabled = false }: ClientCreateFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ClientCreateFormValues>({
    resolver: zodResolver(clientCreateFormSchema),
    defaultValues: clientCreateFormDefaults,
  });

  const busy = disabled || form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toCreateClientInput(values));
    } catch (error) {
      const applied = applyApiFieldErrors(form.setError, error, CLIENT_CREATE_FORM_FIELDS);
      if (applied === 0) {
        setFormError(getApiErrorMessage(error, "The client could not be created."));
      }
    }
  });

  // This form is nested inside the project form's <form>; intercept Enter on
  // text inputs so a stray keypress submits the client (not the outer form).
  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">New client</p>
        <p className="text-sm text-muted-foreground">
          Create a client, then it is selected for this project automatically.
        </p>
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't create client</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup className="gap-4">
        <Field data-invalid={!!form.formState.errors.name}>
          <FieldLabel htmlFor="client-create-name">Client name</FieldLabel>
          <Input
            id="client-create-name"
            aria-invalid={!!form.formState.errors.name}
            disabled={busy}
            placeholder="Northwind Traders"
            onKeyDown={handleInputKeyDown}
            {...form.register("name")}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.contactPerson}>
          <FieldLabel htmlFor="client-create-contact">Contact person</FieldLabel>
          <Input
            id="client-create-contact"
            aria-invalid={!!form.formState.errors.contactPerson}
            disabled={busy}
            placeholder="Optional"
            onKeyDown={handleInputKeyDown}
            {...form.register("contactPerson")}
          />
          <FieldError errors={[form.formState.errors.contactPerson]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.email}>
          <FieldLabel htmlFor="client-create-email">Contact email</FieldLabel>
          <Input
            id="client-create-email"
            type="email"
            aria-invalid={!!form.formState.errors.email}
            disabled={busy}
            onKeyDown={handleInputKeyDown}
            placeholder="Optional"
            {...form.register("email")}
          />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <Field data-invalid={!!form.formState.errors.notes}>
          <FieldLabel htmlFor="client-create-notes">Notes</FieldLabel>
          <Textarea
            id="client-create-notes"
            aria-invalid={!!form.formState.errors.notes}
            disabled={busy}
            placeholder="Optional context for the account"
            {...form.register("notes")}
          />
          <FieldDescription>Visible to your organization only.</FieldDescription>
          <FieldError errors={[form.formState.errors.notes]} />
        </Field>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={submit}>
            {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            Add client
          </Button>
        </div>
      </FieldGroup>
    </div>
  );
}
