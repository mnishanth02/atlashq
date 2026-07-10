"use client";

import { SquarePenIcon } from "lucide-react";
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
  type ProjectResponse,
  type UpdateProjectInput,
  useClientsQuery,
  useOrganizationUsersQuery,
  useUpdateProjectMutation,
} from "@/features/api";
import { ProjectForm, type ProjectFormClient, type ProjectFormPerson } from "../forms";
import {
  buildProjectEditClients,
  buildProjectEditDefaults,
  buildProjectEditPeople,
  buildProjectUpdateVariables,
} from "./edit-project-model";
import { formatAtlasErrorMessage } from "./project-detail-model";

export function EditProjectDialog({
  project,
  currentUser,
  canTransferOwner,
}: {
  project: ProjectResponse;
  currentUser: ProjectFormPerson | undefined;
  canTransferOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clientsQuery = useClientsQuery({ status: "active", limit: 100 });
  const organizationUsersQuery = useOrganizationUsersQuery({ status: "active", limit: 100 });
  const updateProject = useUpdateProjectMutation();

  const activeClients = useMemo<ProjectFormClient[]>(
    () => (clientsQuery.data?.items ?? []).map((client) => ({ id: client.id, name: client.name })),
    [clientsQuery.data],
  );
  const clients = useMemo(
    () => buildProjectEditClients(project, activeClients),
    [activeClients, project],
  );
  const directoryUsers = useMemo(
    () =>
      (organizationUsersQuery.data?.items ?? []).map((user) => ({ id: user.id, name: user.name })),
    [organizationUsersQuery.data],
  );
  const people = useMemo(
    () => buildProjectEditPeople(project, currentUser, directoryUsers),
    [currentUser, directoryUsers, project],
  );
  const defaultValues = useMemo(() => buildProjectEditDefaults(project), [project]);

  async function handleSubmit(input: UpdateProjectInput) {
    try {
      const updated = await updateProject.mutateAsync(
        buildProjectUpdateVariables(project.id, input),
      );
      toast.success("Project updated.", {
        description: `${updated.name} now reflects the saved workspace settings.`,
      });
      setOpen(false);
    } catch (error) {
      toast.error("Couldn't update project.", {
        description: formatAtlasErrorMessage(error, "The project changes were not saved."),
      });
      throw error;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!updateProject.isPending) {
          setOpen(nextOpen);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <SquarePenIcon data-icon="inline-start" />
          Edit project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            {canTransferOwner
              ? "Update workspace ownership, governance, client, and delivery metadata."
              : "Update workspace client, governance, and delivery metadata."}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          mode="edit"
          version={project.version}
          canTransferOwner={canTransferOwner}
          defaultValues={defaultValues}
          people={people}
          peopleLoading={organizationUsersQuery.isPending}
          peopleError={organizationUsersQuery.isError}
          onRetryPeople={() => {
            void organizationUsersQuery.refetch();
          }}
          clients={clients}
          clientsNote="Active clients are listed, and this project's current client remains selectable."
          clientsLoading={clientsQuery.isPending}
          clientsError={clientsQuery.isError}
          onRetryClients={() => {
            void clientsQuery.refetch();
          }}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
