import type { UpdateProjectInput } from "@/features/api";
import type { ProjectFormClient } from "../forms/project-form";
import type {
  PersonOption,
  ProjectFormPerson,
  ProjectFormSource,
  ProjectFormValues,
} from "../forms/project-form-transform";
import { buildPersonOptions, editProjectFormDefaults } from "../forms/project-form-transform";

type AssignedPerson = ProjectFormPerson | null;

export type ProjectEditSource = ProjectFormSource & {
  client: ProjectFormClient | null;
  owner: AssignedPerson;
  techLead: AssignedPerson;
  businessOwner: AssignedPerson;
};

function assignedPerson(id: string | null, person: AssignedPerson): ProjectFormPerson | null {
  if (!id) {
    return null;
  }
  return person ?? { id, name: id };
}

export function buildProjectEditPeople(
  project: ProjectEditSource,
  currentUser: ProjectFormPerson | undefined,
  directoryUsers: readonly ProjectFormPerson[] = [],
): PersonOption[] {
  return buildPersonOptions(
    currentUser,
    ...directoryUsers,
    assignedPerson(project.ownerId, project.owner),
    assignedPerson(project.techLeadId, project.techLead),
    assignedPerson(project.businessOwnerId, project.businessOwner),
  );
}

export function buildProjectEditClients(
  project: ProjectEditSource,
  activeClients: readonly ProjectFormClient[],
): ProjectFormClient[] {
  const clients = new Map(activeClients.map((client) => [client.id, client]));

  if (project.clientId) {
    clients.set(
      project.clientId,
      project.client ?? { id: project.clientId, name: project.clientId },
    );
  }

  return [...clients.values()];
}

export function buildProjectEditDefaults(project: ProjectEditSource): ProjectFormValues {
  return editProjectFormDefaults(project);
}

export function buildProjectUpdateVariables(
  projectId: string,
  input: UpdateProjectInput,
): { projectId: string; input: UpdateProjectInput } {
  return { projectId, input };
}
