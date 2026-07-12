import { getRouteApi } from "@tanstack/react-router";
import { RequirementAnalysisDetailPage } from "@/features/requirement-analysis/requirement-analysis-detail-page";
import type { RequirementAnalysisDetailSearch } from "./requirement-analysis-search";

const routeApi = getRouteApi("/_authenticated/projects/$projectId/requirement-analysis/$runId");

export function RequirementAnalysisDetailRoute() {
  const { projectId, runId } = routeApi.useParams();
  const search = routeApi.useSearch() as RequirementAnalysisDetailSearch;
  const navigate = routeApi.useNavigate();

  return (
    <RequirementAnalysisDetailPage
      projectId={projectId}
      runId={runId}
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
