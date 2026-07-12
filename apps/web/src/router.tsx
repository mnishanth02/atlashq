import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  RouterProvider,
  redirect,
} from "@tanstack/react-router";
import { ThemeProvider } from "./components/theme/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { AppShell } from "./routes/app-shell";
import {
  AuthenticatedErrorComponent,
  authenticatedBeforeLoad,
} from "./routes/auth/authenticated-layout";
import { SessionLoadingState } from "./routes/auth/session-states";
import { LoginRoute, loginBeforeLoad, loginSearchSchema } from "./routes/login/login-route";
import { ProjectDetailRoute } from "./routes/projects/project-detail-route";
import { ProjectsRoute } from "./routes/projects/projects-route";
import {
  requirementAnalysisDetailSearchSchema,
  requirementAnalysisSearchSchema,
} from "./routes/projects/requirement-analysis-search";
import { sourceDocumentsSearchSchema } from "./routes/projects/source-documents-search";
import { RootLayout } from "./routes/root-layout";
import { queryClient } from "./state/query-client";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: loginSearchSchema,
  beforeLoad: loginBeforeLoad,
  component: LoginRoute,
});

/**
 * Design System kitchen sink is a development-only reference for this repo's
 * component/token conventions — it must not ship in production. Both the
 * route's registration *and* its `lazyRouteComponent(() => import(...))` call
 * live inside the `import.meta.env.DEV` branch below (not as a standalone
 * top-level route), so Vite's static inlining of that check lets the
 * production build's dead branch — including the dynamic `import()` — be
 * eliminated before Rollup ever considers it for a chunk, keeping the
 * kitchen sink's code out of the production bundle entirely.
 */

/**
 * Pathless layout that gates every product route behind a session check
 * (`authenticatedBeforeLoad`) and renders the authenticated product shell.
 * `pendingComponent`/`errorComponent` give the session check explicit loading
 * and error states instead of a blank screen or a silent redirect-on-error.
 */
const authenticatedLayoutRoute = createRoute({
  id: "_authenticated",
  getParentRoute: () => rootRoute,
  beforeLoad: authenticatedBeforeLoad,
  component: AppShell,
  pendingComponent: SessionLoadingState,
  pendingMs: 300,
  errorComponent: AuthenticatedErrorComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
});

/** Route-ready placeholder — see `routes/projects/projects-route.tsx`. */
const projectsRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects",
  component: ProjectsRoute,
});

/** Route-ready placeholder — see `routes/projects/project-detail-route.tsx`. */
const projectDetailRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects/$projectId",
  component: ProjectDetailRoute,
});

/**
 * Module 2 Source Document Vault — list surface. `validateSearch` gives filter
 * state a stable route-search shape so deep links preserve search/type/status.
 */
const sourceDocumentsRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects/$projectId/source-documents",
  validateSearch: sourceDocumentsSearchSchema,
  component: lazyRouteComponent(
    () => import("./routes/projects/source-documents-route"),
    "SourceDocumentsRoute",
  ),
});

/** Module 2 Source Document Vault — detail surface for one source lineage head. */
const sourceDetailRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects/$projectId/source-documents/$sourceId",
  component: lazyRouteComponent(
    () => import("./routes/projects/source-detail-route"),
    "SourceDetailRoute",
  ),
});

/**
 * Module 3 AI Requirement Analyzer — main surface: capabilities, eligible
 * source preview, fresh-run launch, and run history for a project.
 */
const requirementAnalysisRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects/$projectId/requirement-analysis",
  validateSearch: requirementAnalysisSearchSchema,
  component: lazyRouteComponent(
    () => import("./routes/projects/requirement-analysis-route"),
    "RequirementAnalysisRoute",
  ),
});

/**
 * Module 3 AI Requirement Analyzer — run detail surface: stage timeline,
 * read-only requirements/delivery items, coverage matrix, citations, and
 * traceability for one analysis run.
 */
const requirementAnalysisDetailRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: "/projects/$projectId/requirement-analysis/$runId",
  validateSearch: requirementAnalysisDetailSearchSchema,
  component: lazyRouteComponent(
    () => import("./routes/projects/requirement-analysis-detail-route"),
    "RequirementAnalysisDetailRoute",
  ),
});

const authenticatedRoute = authenticatedLayoutRoute.addChildren([
  indexRoute,
  projectsRoute,
  projectDetailRoute,
  sourceDocumentsRoute,
  sourceDetailRoute,
  requirementAnalysisRoute,
  requirementAnalysisDetailRoute,
]);

const routeTree = import.meta.env.DEV
  ? rootRoute.addChildren([
      loginRoute,
      authenticatedRoute,
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/design-system",
        component: lazyRouteComponent(
          () => import("./routes/design-system-route"),
          "DesignSystemRoute",
        ),
      }),
    ])
  : rootRoute.addChildren([loginRoute, authenticatedRoute]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
