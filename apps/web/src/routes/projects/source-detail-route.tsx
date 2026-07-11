import { getRouteApi } from "@tanstack/react-router";
import { SourceDetailPage } from "@/features/source-documents/source-detail-page";

const routeApi = getRouteApi("/_authenticated/projects/$projectId/source-documents/$sourceId");

export function SourceDetailRoute() {
  const { projectId, sourceId } = routeApi.useParams();
  return <SourceDetailPage projectId={projectId} sourceId={sourceId} />;
}
