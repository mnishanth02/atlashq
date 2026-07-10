"use client";

import { useNavigate } from "@tanstack/react-router";
import { LockIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  type CreateClientInput,
  type CreateProjectInput,
  useClientsQuery,
  useCreateClientMutation,
  useCreateProjectMutation,
  useOrganizationUsersQuery,
} from "@/features/api";
import {
  buildPersonOptions,
  createProjectFormDefaults,
  ProjectForm,
  type ProjectFormClient,
  type ProjectFormPerson,
} from "../forms";
import type { ProjectCreatePermission } from "./project-permissions";

export type CreateProjectActionProps = {
  permission: ProjectCreatePermission;
  currentUser: ProjectFormPerson | undefined;
  /** Org admins may add clients inline; mirrors the create permission today. */
  canManageClients: boolean;
};

/**
 * Permission-aware primary create action. Admins get a dialog-backed Create
 * Project flow; everyone else sees explicit read-only copy — never a disabled
 * control masquerading as actionable.
 */
export function CreateProjectAction({
  permission,
  currentUser,
  canManageClients,
}: CreateProjectActionProps) {
  if (!permission.canCreate) {
    return <ReadOnlyCreateNote reason={permission.reason} />;
  }
  return <AdminCreateProject currentUser={currentUser} canManageClients={canManageClients} />;
}

function ReadOnlyCreateNote({ reason }: { reason: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <LockIcon className="size-4 shrink-0" aria-hidden="true" />
      <span>{reason}</span>
    </div>
  );
}

function AdminCreateProject({
  currentUser,
  canManageClients,
}: {
  currentUser: ProjectFormPerson | undefined;
  canManageClients: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createProject = useCreateProjectMutation();
  const createClient = useCreateClientMutation();
  const clientsQuery = useClientsQuery({ status: "active", limit: 100 });
  const organizationUsersQuery = useOrganizationUsersQuery({ status: "active", limit: 100 });

  const clients = useMemo<ProjectFormClient[]>(
    () => (clientsQuery.data?.items ?? []).map((client) => ({ id: client.id, name: client.name })),
    [clientsQuery.data],
  );
  const directoryUsers = useMemo(
    () =>
      (organizationUsersQuery.data?.items ?? []).map((user) => ({ id: user.id, name: user.name })),
    [organizationUsersQuery.data],
  );
  const people = useMemo(
    () => buildPersonOptions(currentUser, ...directoryUsers),
    [currentUser, directoryUsers],
  );
  const defaultValues = useMemo(() => createProjectFormDefaults(currentUser), [currentUser]);

  async function handleSubmit(input: CreateProjectInput) {
    const created = await createProject.mutateAsync(input);
    toast.success("Project created.", {
      description: `${created.name} is ready to configure.`,
    });
    setOpen(false);
    await navigate({ to: "/projects/$projectId", params: { projectId: created.id } });
  }

  async function handleCreateClient(input: CreateClientInput): Promise<ProjectFormClient> {
    const created = await createClient.mutateAsync(input);
    toast.success("Client created.", {
      description: `${created.name} is now selectable.`,
    });
    return { id: created.id, name: created.name };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <PlusIcon data-icon="inline-start" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Set up a new engagement and its governance metadata.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="create"
          defaultValues={defaultValues}
          people={people}
          peopleLoading={organizationUsersQuery.isPending}
          peopleError={organizationUsersQuery.isError}
          onRetryPeople={() => {
            void organizationUsersQuery.refetch();
          }}
          clients={clients}
          clientsLoading={clientsQuery.isPending}
          clientsError={clientsQuery.isError}
          onRetryClients={() => {
            void clientsQuery.refetch();
          }}
          canManageClients={canManageClients}
          onCreateClient={handleCreateClient}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
