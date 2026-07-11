import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import {
  getSourceVaultCapabilitiesQueryKey,
  type SourceVaultCapabilitiesResponse,
} from "./sources-api";
import { SAFE_DISABLED_CAPABILITIES, useSourceVaultCapabilities } from "./sources-hooks";

const PROJECT_ID = "project-1";

const server = createMswServer();
setupMswServer(server);

function makeCapabilities(
  overrides: Partial<SourceVaultCapabilitiesResponse> = {},
): SourceVaultCapabilitiesResponse {
  return {
    writesEnabled: true,
    singlePageCaptureEnabled: true,
    ocrProcessingEnabled: false,
    storageAvailable: true,
    queueAvailable: true,
    ...overrides,
  };
}

function withClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useSourceVaultCapabilities", () => {
  it("returns a safe-disabled fallback while the request is pending", () => {
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/source-vault/capabilities`, () => {
        // Never resolves during this synchronous first render.
        return new Promise(() => {});
      }),
    );
    const { wrapper } = withClient();
    const { result } = renderHook(() => useSourceVaultCapabilities(PROJECT_ID), { wrapper });
    expect(result.current.isPending).toBe(true);
    // Pending must not leak "enabled" flags to the UI.
    expect(result.current.data).toEqual(SAFE_DISABLED_CAPABILITIES);
  });

  it("returns the server payload once resolved", async () => {
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/source-vault/capabilities`, () =>
        HttpResponse.json(makeCapabilities({ ocrProcessingEnabled: true })),
      ),
    );
    const { wrapper } = withClient();
    const { result } = renderHook(() => useSourceVaultCapabilities(PROJECT_ID), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data.writesEnabled).toBe(true);
    expect(result.current.data.singlePageCaptureEnabled).toBe(true);
    expect(result.current.data.ocrProcessingEnabled).toBe(true);
  });

  it("falls back to safe-disabled when the request errors", async () => {
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/source-vault/capabilities`, () =>
        HttpResponse.json(
          { statusCode: 500, code: "boom", message: "down", correlationId: "c" },
          { status: 500 },
        ),
      ),
    );
    const { wrapper } = withClient();
    const { result } = renderHook(() => useSourceVaultCapabilities(PROJECT_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toEqual(SAFE_DISABLED_CAPABILITIES);
  });

  it("caches responses under a dedicated key that is separate from list/detail families", async () => {
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/source-vault/capabilities`, () =>
        HttpResponse.json(makeCapabilities()),
      ),
    );
    const { client, wrapper } = withClient();
    const { result } = renderHook(() => useSourceVaultCapabilities(PROJECT_ID), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    // Ensure the cached payload is stored under the expected key.
    const cached = client.getQueryData(getSourceVaultCapabilitiesQueryKey(PROJECT_ID));
    expect(cached).toBeTruthy();
  });

  it("is disabled when no projectId is provided", () => {
    const { wrapper } = withClient();
    const { result } = renderHook(() => useSourceVaultCapabilities(undefined), { wrapper });
    // Disabled queries do not fetch; the safe-disabled fallback is returned.
    expect(result.current.data).toEqual(SAFE_DISABLED_CAPABILITIES);
  });
});
