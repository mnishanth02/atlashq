import { Link, useMatches } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTE_BREADCRUMB_LABELS } from "./nav-config";

/**
 * Renders a breadcrumb trail for the current authenticated route. The installed
 * TanStack Router version doesn't support `staticData` route options, so labels
 * come from the `ROUTE_BREADCRUMB_LABELS` lookup instead of route metadata, and
 * the (currently flat, sibling) `/projects` → `/projects/$projectId` ancestor
 * relationship is expressed explicitly rather than derived from route nesting.
 */
export function AppBreadcrumbs() {
  const matches = useMatches();
  const current = matches.at(-1);
  const label = current ? ROUTE_BREADCRUMB_LABELS[current.fullPath] : undefined;

  if (!current || !label) {
    return null;
  }

  const showProjectsAncestor =
    current.fullPath === "/projects/$projectId" ||
    current.fullPath === "/projects/$projectId/source-documents" ||
    current.fullPath === "/projects/$projectId/source-documents/$sourceId" ||
    current.fullPath === "/projects/$projectId/requirement-analysis" ||
    current.fullPath === "/projects/$projectId/requirement-analysis/$runId";
  const showProjectAncestor =
    current.fullPath === "/projects/$projectId/source-documents" ||
    current.fullPath === "/projects/$projectId/source-documents/$sourceId" ||
    current.fullPath === "/projects/$projectId/requirement-analysis" ||
    current.fullPath === "/projects/$projectId/requirement-analysis/$runId";
  const showSourceListAncestor =
    current.fullPath === "/projects/$projectId/source-documents/$sourceId";
  const showRequirementAnalysisListAncestor =
    current.fullPath === "/projects/$projectId/requirement-analysis/$runId";
  const projectParams = (current.params as { projectId?: string }) ?? {};
  const projectId = projectParams.projectId;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showProjectsAncestor ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        {showProjectAncestor && projectId ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects/$projectId" params={{ projectId }}>
                  Project
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        {showSourceListAncestor && projectId ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects/$projectId/source-documents" params={{ projectId }}>
                  Source documents
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        {showRequirementAnalysisListAncestor && projectId ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/projects/$projectId/requirement-analysis" params={{ projectId }}>
                  Requirement analysis
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        <BreadcrumbItem>
          <BreadcrumbPage>{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
