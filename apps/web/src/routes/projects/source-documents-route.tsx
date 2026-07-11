import { getRouteApi } from "@tanstack/react-router";
import { SourceVaultPage } from "@/features/source-documents/source-vault-page";
import type { SourceDocumentsSearch } from "./source-documents-search";

const routeApi = getRouteApi("/_authenticated/projects/$projectId/source-documents");

export function SourceDocumentsRoute() {
  const { projectId } = routeApi.useParams();
  const search = routeApi.useSearch() as SourceDocumentsSearch;
  const navigate = routeApi.useNavigate();

  return (
    <SourceVaultPage
      projectId={projectId}
      search={search}
      onSearchChange={(next) => {
        void navigate({
          search: ((existing: Record<string, unknown>) => ({ ...existing, ...next })) as never,
          replace: true,
        });
      }}
    />
  );
}
