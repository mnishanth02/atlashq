import { getRouteApi } from "@tanstack/react-router";
import { ProjectDetailPage } from "@/features/projects/detail/project-detail-page";

const routeApi = getRouteApi("/_authenticated/projects/$projectId");

export function ProjectDetailRoute() {
  const { projectId } = routeApi.useParams();

  return <ProjectDetailPage projectId={projectId} />;
}
