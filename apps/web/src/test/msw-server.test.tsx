import { describe, expect, it } from "vitest";
import { fetchProjects } from "@/features/api";
import { makeProjectListResponse } from "./fixtures";
import { atlasHandlers } from "./handlers";
import { createMswServer, setupMswServer } from "./msw-server";

const server = createMswServer();
setupMswServer(server);

describe("MSW component server", () => {
  it("intercepts explicit real API-client requests", async () => {
    server.use(atlasHandlers.projects(makeProjectListResponse()));

    await expect(fetchProjects()).resolves.toMatchObject({
      items: [expect.objectContaining({ name: "Atlas rollout" })],
    });
  });
});
