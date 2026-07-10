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

  const showProjectsAncestor = current.fullPath === "/projects/$projectId";

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
        <BreadcrumbItem>
          <BreadcrumbPage>{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
