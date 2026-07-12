import { getRouteApi } from "@tanstack/react-router";
import { RequirementAnalysisListPage } from "@/features/requirement-analysis/requirement-analysis-list-page";
import type { RequirementAnalysisSearch } from "./requirement-analysis-search";

const routeApi = getRouteApi("/_authenticated/projects/$projectId/requirement-analysis");

export function RequirementAnalysisRoute() {
  const { projectId } = routeApi.useParams();
  const search = routeApi.useSearch() as RequirementAnalysisSearch;
  const navigate = routeApi.useNavigate();

  return (
    <RequirementAnalysisListPage
      projectId={projectId}
      search={search}
      onSearchChange={(next) => {
        void navigate({
          search: ((existing: Record<string, unknown>) => ({ ...existing, ...next })) as never,
          replace: true,
        });
      }}
      onRunLaunched={(runId) => {
        void navigate({
          to: "/projects/$projectId/requirement-analysis/$runId",
          params: { projectId, runId },
        });
      }}
    />
  );
}
