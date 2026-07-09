import createClient from "openapi-fetch";
import type { paths } from "./generated/openapi.js";

export type { components, paths } from "./generated/openapi.js";

export const DEFAULT_API_BASE_URL = "";

export type AtlasApiClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export function createAtlasApiClient(options: AtlasApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_API_BASE_URL;

  if (options.fetch) {
    return createClient<paths>({ baseUrl, fetch: options.fetch });
  }

  return createClient<paths>({ baseUrl });
}

export function getHealthQueryKey() {
  return ["api", "health"] as const;
}
