"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Control, Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CreateClientInput, CreateProjectInput, UpdateProjectInput } from "@/features/api";
import { applyApiFieldErrors, getApiErrorMessage } from "./apply-field-errors";
import { ClientCreateForm } from "./client-create-form";
import {
  PROJECT_FORM_FIELDS,
  PROJECT_PHASE_OPTIONS,
  PROJECT_PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROJECT_VISIBILITY_OPTIONS,
  projectFormSchema,
} from "./project-form-schema";
import {
  type PersonOption,
  type ProjectFormValues,
  toCreateProjectInput,
  toUpdateProjectInput,
} from "./project-form-transform";

/** Sentinel select value for the optional "Unassigned" person option. */
const UNASSIGNED_VALUE = "__unassigned__";

export type ProjectFormClient = { id: string; name: string };

type PersonFieldName = "ownerId" | "techLeadId" | "businessOwnerId";

type ProjectFormBaseProps = {
  /** Assignable people for owner / tech-lead / business-owner selects. */
  people: PersonOption[];
  /** True while the organization directory page backing `people` is loading. */
  peopleLoading?: boolean;
  /** True when the organization directory request failed; `people` still reflects known assignments. */
  peopleError?: boolean;
  /** Retry the organization directory fetch after `peopleError`. */
  onRetryPeople?: () => void;
  /** Active clients for the client selector. */
  clients: ProjectFormClient[];
  clientsNote?: string;
  clientsLoading?: boolean;
  clientsError?: boolean;
  onRetryClients?: () => void;
  /** When true (org admins), the inline "create client" affordance is shown. */
  canManageClients?: boolean;
  /** Persist a new client and return it so it can be selected immediately. */
  onCreateClient?: (input: CreateClientInput) => Promise<ProjectFormClient>;
  defaultValues: ProjectFormValues;
  /** Explicit copy about how the owner is derived (no user directory yet). */
  ownerNote?: string;
  disabled?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
};

type CreateProps = ProjectFormBaseProps & {
  mode: "create";
  onSubmit: (input: CreateProjectInput) => Promise<void>;
};

type EditProps = ProjectFormBaseProps & {
  mode: "edit";
  version: number;
  canTransferOwner: boolean;
  onSubmit: (input: UpdateProjectInput) => Promise<void>;
};

export type ProjectFormProps = CreateProps | EditProps;

function dedupeClients(clients: ProjectFormClient[]): ProjectFormClient[] {
  const seen = new Set<string>();
  const result: ProjectFormClient[] = [];
  for (const client of clients) {
    if (client.id === "" || seen.has(client.id)) {
      continue;
    }
    seen.add(client.id);
    result.push(client);
  }
  return result;
}

/**
 * Reusable create/edit project form built on React Hook Form + the shared
 * `projectFormSchema`. It owns validation, the type→client cross-field rule, the
 * inline create-client flow, and API field-error routing; the caller's
 * `onSubmit` performs the mutation and any success side effects (toast /
 * navigate) and may reject with an `AtlasApiError` to surface field errors.
 */
export function ProjectForm(props: ProjectFormProps) {
  const {
    people,
    peopleLoading = false,
    peopleError = false,
    onRetryPeople,
    clients,
    clientsNote,
    clientsLoading = false,
    clientsError = false,
    onRetryClients,
    canManageClients = false,
    onCreateClient,
    defaultValues,
    ownerNote,
    disabled = false,
    submitLabel,
    onCancel,
  } = props;

  const [formError, setFormError] = useState<string | null>(null);
  const [showClientCreate, setShowClientCreate] = useState(false);
  const [createdClients, setCreatedClients] = useState<ProjectFormClient[]>([]);
  const [createdClientSelection, setCreatedClientSelection] = useState<string | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues,
  });

  const type = form.watch("type");
  const isClient = type === "client";
  const busy = disabled || form.formState.isSubmitting;
  const errors = form.formState.errors;

  const clientOptions = useMemo(
    () => dedupeClients([...createdClients, ...clients]),
    [createdClients, clients],
  );

  useEffect(() => {
    if (
      createdClientSelection &&
      clientOptions.some((client) => client.id === createdClientSelection)
    ) {
      form.setValue("clientId", createdClientSelection, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setCreatedClientSelection(null);
    }
  }, [clientOptions, createdClientSelection, form]);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (props.mode === "create") {
        await props.onSubmit(toCreateProjectInput(values));
      } else {
        await props.onSubmit(toUpdateProjectInput(values, props.version));
      }
    } catch (error) {
      const applied = applyApiFieldErrors(form.setError, error, PROJECT_FORM_FIELDS);
      if (applied === 0) {
        setFormError(getApiErrorMessage(error, "The project could not be saved."));
      }
    }
  });

  async function handleCreateClient(input: CreateClientInput) {
    if (!onCreateClient) {
      return;
    }
    const created = await onCreateClient(input);
    setCreatedClients((prev) => dedupeClients([created, ...prev]));
    setCreatedClientSelection(created.id);
    setShowClientCreate(false);
  }

  const resolvedSubmitLabel =
    submitLabel ?? (props.mode === "create" ? "Create project" : "Save changes");
  const ownerDescription =
    props.mode === "edit" && !props.canTransferOwner
      ? "Project-admin permission is required to transfer ownership."
      : peopleError
        ? "Couldn't load the organization directory. Only your account and current assignments are shown."
        : peopleLoading
          ? "Loading the organization directory…"
          : (ownerNote ??
            "Owner defaults to you. Any active teammate in your organization can be assigned.");

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't save project</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup className="gap-6">
        <FieldSet>
          <FieldLegend variant="label">Overview</FieldLegend>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="project-name">Project name</FieldLabel>
              <Input
                id="project-name"
                aria-invalid={!!errors.name}
                disabled={busy}
                placeholder="Atlas platform rollout"
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.type}>
                <FieldLabel htmlFor="project-type">Engagement type</FieldLabel>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      disabled={busy}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === "internal") {
                          form.setValue("clientId", "", { shouldValidate: true });
                          setShowClientCreate(false);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="project-type"
                        aria-invalid={!!errors.type}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Engagement type</SelectLabel>
                          {PROJECT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  {isClient
                    ? "Client work is tied to a specific client account."
                    : "Internal work has no client and never carries a client link."}
                </FieldDescription>
              </Field>

              <PersonField
                control={form.control}
                name="ownerId"
                label="Owner"
                description={ownerDescription}
                options={people}
                disabled={busy || (props.mode === "edit" && !props.canTransferOwner)}
                invalid={!!errors.ownerId}
                error={errors.ownerId}
                onRetry={peopleError ? onRetryPeople : undefined}
              />
            </div>

            {isClient ? (
              <Field data-invalid={!!errors.clientId}>
                <FieldLabel htmlFor="project-clientId">Client</FieldLabel>
                <div className="flex items-center gap-2">
                  <Controller
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        disabled={busy || clientsLoading || clientsError}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="project-clientId"
                          aria-invalid={!!errors.clientId}
                          className="w-full"
                        >
                          <SelectValue
                            placeholder={clientsLoading ? "Loading clients…" : "Select a client"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Clients</SelectLabel>
                            {clientOptions.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {canManageClients && onCreateClient ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setShowClientCreate((value) => !value)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      New
                    </Button>
                  ) : null}
                </div>

                {clientsError ? (
                  <FieldDescription className="flex items-center gap-2 text-destructive">
                    Couldn't load clients.
                    {onRetryClients ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={onRetryClients}
                        disabled={busy}
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        Retry
                      </Button>
                    ) : null}
                  </FieldDescription>
                ) : clientOptions.length === 0 && !clientsLoading ? (
                  <FieldDescription>
                    No active clients yet.
                    {canManageClients ? " Use “New” to add one." : " Ask an admin to add one."}
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    {clientsNote ?? "Only active clients can be selected."}
                  </FieldDescription>
                )}
                <FieldError errors={[errors.clientId]} />

                {showClientCreate && canManageClients && onCreateClient ? (
                  <ClientCreateForm
                    disabled={busy}
                    onSubmit={handleCreateClient}
                    onCancel={() => setShowClientCreate(false)}
                  />
                ) : null}
              </Field>
            ) : null}

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Textarea
                id="project-description"
                aria-invalid={!!errors.description}
                disabled={busy}
                placeholder="What is this engagement about?"
                {...form.register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Governance</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumField
              control={form.control}
              name="status"
              label="Status"
              options={PROJECT_STATUS_OPTIONS}
              disabled={busy}
              invalid={!!errors.status}
            />
            <EnumField
              control={form.control}
              name="phase"
              label="Phase"
              options={PROJECT_PHASE_OPTIONS}
              disabled={busy}
              invalid={!!errors.phase}
            />
            <EnumField
              control={form.control}
              name="priority"
              label="Priority"
              options={PROJECT_PRIORITY_OPTIONS}
              disabled={busy}
              invalid={!!errors.priority}
            />
            <EnumField
              control={form.control}
              name="visibility"
              label="Visibility"
              options={PROJECT_VISIBILITY_OPTIONS}
              disabled={busy}
              invalid={!!errors.visibility}
            />
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">People &amp; timeline</FieldLegend>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <PersonField
                control={form.control}
                name="techLeadId"
                label="Tech lead"
                options={people}
                allowUnassigned
                disabled={busy}
                invalid={!!errors.techLeadId}
                error={errors.techLeadId}
              />
              <PersonField
                control={form.control}
                name="businessOwnerId"
                label="Business owner"
                options={people}
                allowUnassigned
                disabled={busy}
                invalid={!!errors.businessOwnerId}
                error={errors.businessOwnerId}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.startDate}>
                <FieldLabel htmlFor="project-startDate">Start date</FieldLabel>
                <Input
                  id="project-startDate"
                  type="date"
                  aria-invalid={!!errors.startDate}
                  disabled={busy}
                  {...form.register("startDate")}
                />
                <FieldError errors={[errors.startDate]} />
              </Field>
              <Field data-invalid={!!errors.targetDate}>
                <FieldLabel htmlFor="project-targetDate">Target date</FieldLabel>
                <Input
                  id="project-targetDate"
                  type="date"
                  aria-invalid={!!errors.targetDate}
                  disabled={busy}
                  {...form.register("targetDate")}
                />
                <FieldError errors={[errors.targetDate]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.tags}>
              <FieldLabel htmlFor="project-tags">Tags</FieldLabel>
              <Textarea
                id="project-tags"
                aria-invalid={!!errors.tags}
                disabled={busy}
                placeholder="platform, migration, q3"
                {...form.register("tags")}
              />
              <FieldDescription>Separate tags with commas or new lines.</FieldDescription>
              <FieldError errors={[errors.tags]} />
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          {resolvedSubmitLabel}
        </Button>
      </div>
    </form>
  );
}

type PersonFieldProps = {
  control: Control<ProjectFormValues>;
  name: PersonFieldName;
  label: string;
  description?: string;
  options: PersonOption[];
  allowUnassigned?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  error?: { message?: string } | undefined;
  /** Shown as a retry affordance next to `description` when the directory failed to load. */
  onRetry?: (() => void) | undefined;
};

function PersonField({
  control,
  name,
  label,
  description,
  options,
  allowUnassigned = false,
  disabled = false,
  invalid = false,
  error,
  onRetry,
}: PersonFieldProps) {
  const inputId = `project-${name}`;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const selectValue =
            field.value === "" ? (allowUnassigned ? UNASSIGNED_VALUE : "") : field.value;
          return (
            <Select
              value={selectValue}
              disabled={disabled}
              onValueChange={(value) => field.onChange(value === UNASSIGNED_VALUE ? "" : value)}
            >
              <SelectTrigger id={inputId} aria-invalid={invalid} className="w-full">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{label}</SelectLabel>
                  {allowUnassigned ? (
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                  ) : null}
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.hint ? `${option.name} · ${option.hint}` : option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          );
        }}
      />
      {description ? (
        onRetry ? (
          <FieldDescription className="flex items-center gap-2 text-destructive">
            {description}
            <Button type="button" variant="ghost" size="xs" onClick={onRetry} disabled={disabled}>
              <RotateCcwIcon data-icon="inline-start" />
              Retry
            </Button>
          </FieldDescription>
        ) : (
          <FieldDescription>{description}</FieldDescription>
        )
      ) : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

type EnumFieldName = "status" | "phase" | "priority" | "visibility";

type EnumFieldProps = {
  control: Control<ProjectFormValues>;
  name: EnumFieldName;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  invalid?: boolean;
};

function EnumField({
  control,
  name,
  label,
  options,
  disabled = false,
  invalid = false,
}: EnumFieldProps) {
  const inputId = `project-${name}`;
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} disabled={disabled} onValueChange={field.onChange}>
            <SelectTrigger id={inputId} aria-invalid={invalid} className="w-full">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{label}</SelectLabel>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
