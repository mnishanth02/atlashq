import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { ProjectActivityPanel } from "@/features/projects/activity/project-activity-panel";
import {
  makeAuditList,
  makeMembership,
  makeMembershipList,
  makeOrganizationUser,
  makeOrganizationUserListResponse,
} from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { ProjectMembershipPanel } from "./project-membership-panel";

const server = createMswServer();
setupMswServer(server);

const morgan = makeOrganizationUser({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Morgan Admin",
  email: "morgan@example.com",
});

describe("ProjectMembershipPanel", () => {
  it("shows owner/admin controls and requires a directory selection before submitting", async () => {
    server.use(
      atlasHandlers.memberships("project-1", makeMembershipList()),
      atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan])),
    );
    const view = renderWithProviders(
      <ProjectMembershipPanel canManageMembers isArchived={false} projectId="project-1" />,
    );

    expect(await screen.findByRole("combobox", { name: "Member" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Role" })).toBeEnabled();
    await view.user.click(screen.getByRole("button", { name: "Add member" }));

    expect(await screen.findByText(/invalid UUID/i)).toBeInTheDocument();
  });

  it("searches the directory, selects a member, and submits their id with the request", async () => {
    let requestBody: unknown;
    server.use(
      atlasHandlers.memberships("project-1", makeMembershipList()),
      atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan])),
      http.post("*/api/v1/projects/project-1/memberships", async ({ request }) => {
        requestBody = await request.json();
        return apiError(500, "Not implemented in this test");
      }),
    );
    const view = renderWithProviders(
      <ProjectMembershipPanel canManageMembers isArchived={false} projectId="project-1" />,
    );

    await view.user.click(await screen.findByRole("combobox", { name: "Member" }));
    await view.user.click(await screen.findByRole("option", { name: /Morgan Admin/ }));
    expect(screen.getByRole("combobox", { name: "Member" })).toHaveTextContent(
      "Morgan Admin \u00b7 morgan@example.com",
    );

    await view.user.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() =>
      expect(requestBody).toMatchObject({ userId: morgan.id, role: "Developer" }),
    );
  });

  it("excludes users who are already project members from the directory picker", async () => {
    const existingMember = makeMembership({ userId: morgan.id });
    server.use(
      atlasHandlers.memberships("project-1", makeMembershipList([existingMember])),
      atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan])),
    );
    const view = renderWithProviders(
      <ProjectMembershipPanel canManageMembers isArchived={false} projectId="project-1" />,
    );

    await view.user.click(await screen.findByRole("combobox", { name: "Member" }));
    expect(await screen.findByText("No members available.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Morgan Admin/ })).not.toBeInTheDocument();
  });

  it("requires remove confirmation and keeps mutation errors visible", async () => {
    server.use(
      atlasHandlers.memberships("project-1", makeMembershipList([makeMembership()])),
      atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan])),
      http.delete("*/api/v1/projects/project-1/memberships/membership-1", () =>
        apiError(500, "Removal failed safely"),
      ),
    );
    const view = renderWithProviders(
      <ProjectMembershipPanel canManageMembers isArchived={false} projectId="project-1" />,
    );

    await view.user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(
      screen.getByRole("alertdialog", { name: "Remove project membership?" }),
    ).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Remove member" }));

    expect(await screen.findByText(/Removal failed safely/)).toBeInTheDocument();
    expect(
      screen.getByRole("alertdialog", { name: "Remove project membership?" }),
    ).toBeInTheDocument();
  });
});

describe("ProjectActivityPanel", () => {
  it("uses manual provenance and safe summaries without rendering raw sensitive JSON", async () => {
    server.use(
      atlasHandlers.activity(
        "project-1",
        makeAuditList([
          {
            id: "audit-1",
            organizationId: "org-1",
            actorId: "viewer-1",
            action: "project.updated",
            entityType: "project",
            entityId: "project-1",
            projectId: "project-1",
            before: {
              status: "draft",
              password: "old-secret",
              profile: { email: "private-before@example.com" },
            },
            after: {
              status: "active",
              password: "new-secret",
              profile: { email: "private-after@example.com" },
            },
            correlationId: "corr-audit-1",
            at: "2026-07-10T05:11:35.805Z",
          },
        ]),
      ),
    );
    renderWithProviders(<ProjectActivityPanel projectId="project-1" viewerId="viewer-1" />);

    expect(await screen.findByText("Manual provenance")).toBeInTheDocument();
    expect(screen.getByText("Changed Status. Updated 1 sensitive field.")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByText(/old-secret|new-secret/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private-(before|after)@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\{"status"/)).not.toBeInTheDocument();
  });
});
