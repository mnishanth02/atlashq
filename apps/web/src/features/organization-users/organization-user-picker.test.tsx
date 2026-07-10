import { screen, waitFor } from "@testing-library/react";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { FieldLabel } from "@/components/ui/field";
import { makeOrganizationUser, makeOrganizationUserListResponse } from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import {
  OrganizationUserPicker,
  type OrganizationUserPickerProps,
} from "./organization-user-picker";

const server = createMswServer();
setupMswServer(server);

const TRIGGER_NAME = "Member";

const morgan = makeOrganizationUser({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Morgan Admin",
  email: "morgan@example.com",
});
const taylor = makeOrganizationUser({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Taylor Lead",
  email: "taylor@example.com",
});

/** Mirrors real usage: an id-paired `<FieldLabel>` gives the trigger its accessible name. */
function renderPicker(props: Omit<OrganizationUserPickerProps, "id">) {
  return renderWithProviders(
    <>
      <FieldLabel htmlFor="member-picker">{TRIGGER_NAME}</FieldLabel>
      <OrganizationUserPicker id="member-picker" {...props} />
    </>,
  );
}

describe("OrganizationUserPicker", () => {
  it("shows a loading state while the directory query is pending", async () => {
    server.use(
      http.get("*/api/v1/organizations/current/users", async () => {
        await delay(200);
        return HttpResponse.json(makeOrganizationUserListResponse([morgan]));
      }),
    );
    const view = renderPicker({ value: null, onSelect: vi.fn() });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    expect(screen.getByText(/Loading organization members/)).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Morgan Admin/ })).toBeInTheDocument();
  });

  it("shows an accessible error state with retry when the directory query fails", async () => {
    let requestCount = 0;
    server.use(
      http.get("*/api/v1/organizations/current/users", () => {
        requestCount += 1;
        return requestCount === 1
          ? apiError(500, "Directory lookup failed")
          : HttpResponse.json(makeOrganizationUserListResponse([morgan]));
      }),
    );

    const view = renderPicker({ value: null, onSelect: vi.fn() });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    expect(await screen.findByText("Couldn't load organization members.")).toBeInTheDocument();

    await view.user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("option", { name: /Morgan Admin/ })).toBeInTheDocument();
  });

  it("shows an accessible empty state distinct from a genuine zero-result search", async () => {
    server.use(atlasHandlers.organizationUsers(makeOrganizationUserListResponse([])));
    const view = renderPicker({ value: null, onSelect: vi.fn() });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    expect(await screen.findByText("No members available.")).toBeInTheDocument();
  });

  it("searches the directory and never fabricates entries for unmatched input", async () => {
    server.use(atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan])));
    const view = renderPicker({ value: null, onSelect: vi.fn() });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    const searchBox = await screen.findByRole("combobox", {
      name: "Search organization members",
    });

    server.use(atlasHandlers.organizationUsers(makeOrganizationUserListResponse([])));
    await view.user.type(searchBox, "no-such-person");

    expect(await screen.findByText("No members match your search.")).toBeInTheDocument();
    expect(screen.queryByText("no-such-person")).not.toBeInTheDocument();
  });

  it("selects a user, reports it, and closes the popover", async () => {
    server.use(atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan, taylor])));
    const onSelect = vi.fn();
    const view = renderPicker({ value: null, onSelect });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    await view.user.click(await screen.findByRole("option", { name: /Taylor Lead/ }));

    expect(onSelect).toHaveBeenCalledWith(taylor);
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /Taylor Lead/ })).not.toBeInTheDocument(),
    );
  });

  it("excludes user ids already present in the current membership list", async () => {
    server.use(atlasHandlers.organizationUsers(makeOrganizationUserListResponse([morgan, taylor])));
    const view = renderPicker({ value: null, onSelect: vi.fn(), excludeUserIds: [taylor.id] });

    await view.user.click(await screen.findByRole("combobox", { name: TRIGGER_NAME }));
    expect(await screen.findByRole("option", { name: /Morgan Admin/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Taylor Lead/ })).not.toBeInTheDocument();
  });
});
