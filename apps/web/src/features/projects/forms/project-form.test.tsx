import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateProjectInput } from "@/features/api";
import { renderWithProviders } from "@/test/render";
import { ProjectForm } from "./project-form";
import { createProjectFormDefaults, type ProjectFormValues } from "./project-form-transform";

const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Morgan Owner",
};
const lead = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Taylor Lead",
};
const businessOwner = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Casey Sponsor",
};
const clients = [
  { id: "client-1", name: "Northwind" },
  { id: "client-2", name: "Contoso" },
];

async function choose(
  user: ReturnType<typeof renderWithProviders>["user"],
  label: string,
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("ProjectForm", () => {
  it("requires a client for client work and clears it when switched to internal", async () => {
    const onSubmit = vi.fn(async (_input: CreateProjectInput) => undefined);
    const view = renderWithProviders(
      <ProjectForm
        mode="create"
        clients={clients}
        defaultValues={createProjectFormDefaults(owner)}
        people={[owner]}
        onSubmit={onSubmit}
      />,
    );
    await view.user.type(await screen.findByLabelText("Project name"), "Internal platform");
    await view.user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Select a client for client projects.")).toBeInTheDocument();

    await choose(view.user, "Client", "Northwind");
    await choose(view.user, "Engagement type", "Internal");

    expect(screen.queryByRole("combobox", { name: "Client" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Internal work has no client and never carries a client link."),
    ).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.not.objectContaining({
          clientId: expect.anything(),
        }),
      ),
    );
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: "Internal platform",
      type: "internal",
    });
  }, 15_000);

  it("creates a client inline and selects it for the project", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const onCreateClient = vi.fn(async () => ({ id: "client-new", name: "Fabrikam" }));
    const view = renderWithProviders(
      <ProjectForm
        mode="create"
        canManageClients
        clients={[]}
        defaultValues={createProjectFormDefaults(owner)}
        people={[owner]}
        onCreateClient={onCreateClient}
        onSubmit={onSubmit}
      />,
    );
    await view.user.type(await screen.findByLabelText("Project name"), "Fabrikam launch");
    await view.user.click(screen.getByRole("button", { name: "New" }));
    await view.user.type(screen.getByLabelText("Client name"), " Fabrikam ");
    await view.user.type(screen.getByLabelText("Contact email"), "owner@fabrikam.example");
    await view.user.click(screen.getByRole("button", { name: "Add client" }));

    await waitFor(() =>
      expect(onCreateClient).toHaveBeenCalledWith({
        name: "Fabrikam",
        email: "owner@fabrikam.example",
        status: "active",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Client" })).toHaveTextContent("Fabrikam"),
    );

    await view.user.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "client-new", name: "Fabrikam launch" }),
      ),
    );
  });

  it("transforms create dates, tags, and optional values into the API payload", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const view = renderWithProviders(
      <ProjectForm
        mode="create"
        clients={clients}
        defaultValues={createProjectFormDefaults(owner)}
        people={[owner]}
        onSubmit={onSubmit}
      />,
    );
    await view.user.type(await screen.findByLabelText("Project name"), "  Atlas migration  ");
    await choose(view.user, "Client", "Contoso");
    await view.user.type(screen.getByLabelText("Start date"), "2026-08-01");
    await view.user.type(screen.getByLabelText("Target date"), "2026-09-15");
    await view.user.type(screen.getByLabelText("Tags"), " platform, migration\nplatform ");
    await view.user.type(screen.getByLabelText("Description"), "  Customer migration  ");
    await view.user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Atlas migration",
          clientId: "client-2",
          startDate: "2026-08-01T00:00:00.000Z",
          targetDate: "2026-09-15T00:00:00.000Z",
          tags: ["platform", "migration"],
          description: "Customer migration",
        }),
      ),
    );
  });

  it("emits explicit nulls when nullable edit fields are cleared", async () => {
    const defaults: ProjectFormValues = {
      ...createProjectFormDefaults(owner),
      name: "Existing project",
      clientId: "client-1",
      techLeadId: lead.id,
      businessOwnerId: businessOwner.id,
      startDate: "2026-08-01",
      targetDate: "2026-09-15",
      tags: "platform",
      description: "Existing description",
    };
    const onSubmit = vi.fn(async () => undefined);
    const view = renderWithProviders(
      <ProjectForm
        mode="edit"
        version={4}
        canTransferOwner
        clients={clients}
        defaultValues={defaults}
        people={[owner, lead, businessOwner]}
        onSubmit={onSubmit}
      />,
    );
    await screen.findByLabelText("Project name");
    await choose(view.user, "Tech lead", "Unassigned");
    await choose(view.user, "Business owner", "Unassigned");
    await view.user.clear(screen.getByLabelText("Start date"));
    await view.user.clear(screen.getByLabelText("Target date"));
    await view.user.clear(screen.getByLabelText("Tags"));
    await view.user.clear(screen.getByLabelText("Description"));
    await choose(view.user, "Engagement type", "Internal");
    await view.user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: null,
          version: 4,
          techLeadId: null,
          businessOwnerId: null,
          startDate: null,
          targetDate: null,
          tags: [],
          description: null,
        }),
      ),
    );
  }, 15_000);

  it("keeps ownership read-only for metadata editors without project-admin permission", async () => {
    renderWithProviders(
      <ProjectForm
        mode="edit"
        version={2}
        canTransferOwner={false}
        clients={clients}
        defaultValues={{
          ...createProjectFormDefaults(owner),
          name: "Existing project",
          clientId: "client-1",
        }}
        people={[owner, lead]}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(await screen.findByRole("combobox", { name: "Owner" })).toBeDisabled();
    expect(
      screen.getByText("Project-admin permission is required to transfer ownership."),
    ).toBeInTheDocument();
  });

  it("shows optimistic concurrency conflicts as a save error", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("The project was modified by another user. Reload and try again.");
    });
    const view = renderWithProviders(
      <ProjectForm
        mode="edit"
        version={3}
        canTransferOwner
        clients={clients}
        defaultValues={{
          ...createProjectFormDefaults(owner),
          name: "Existing project",
          clientId: "client-1",
        }}
        people={[owner]}
        onSubmit={onSubmit}
      />,
    );

    await view.user.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("The project was modified by another user. Reload and try again."),
    ).toBeInTheDocument();
  });

  it("renders field-level API validation errors beside the accessible control", async () => {
    const apiValidationError = Object.assign(new Error("Validation failed"), {
      name: "AtlasApiError",
      details: [
        {
          path: ["body", "name"],
          message: "A project with this name already exists.",
          code: "duplicate",
        },
      ],
    });
    const onSubmit = vi.fn(async () => {
      throw apiValidationError;
    });
    const view = renderWithProviders(
      <ProjectForm
        mode="create"
        clients={clients}
        defaultValues={createProjectFormDefaults(owner)}
        people={[owner]}
        onSubmit={onSubmit}
      />,
    );
    await view.user.type(await screen.findByLabelText("Project name"), "Duplicate");
    await choose(view.user, "Client", "Northwind");
    await view.user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("A project with this name already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("The project could not be saved.")).not.toBeInTheDocument();
  });
});
