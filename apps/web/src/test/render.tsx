import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { type RenderResult, render } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

type RenderRouteOptions = {
  initialEntry?: string;
  queryClient?: QueryClient;
};

export type TestRenderResult = RenderResult & {
  history: RouterHistory;
  queryClient: QueryClient;
  router: AnyRouter;
  user: UserEvent;
};

export function renderWithProviders(
  ui: ReactElement,
  { initialEntry = "/", queryClient = createTestQueryClient() }: RenderRouteOptions = {},
): TestRenderResult {
  const initialPathname = new URL(initialEntry, "http://test.local").pathname;
  const selectedRoute =
    initialPathname === "/login"
      ? "/login"
      : initialPathname === "/projects"
        ? "/projects"
        : initialPathname.startsWith("/projects/")
          ? "/projects/$projectId"
          : initialPathname === "/design-system"
            ? "/design-system"
            : "/";
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider defaultTheme="light">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>
            <Outlet />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    ),
  });

  const componentFor = (path: string) =>
    path === selectedRoute ? () => ui : () => <div data-test-route={path} />;
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: componentFor("/"),
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    validateSearch: (search: Record<string, unknown>) => ({
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    }),
    component: componentFor("/login"),
  });
  const projectsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/projects",
    component: componentFor("/projects"),
  });
  const projectDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/projects/$projectId",
    component: componentFor("/projects/$projectId"),
  });
  const designSystemRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/design-system",
    component: componentFor("/design-system"),
  });
  const routeTree = rootRoute.addChildren([
    indexRoute,
    loginRoute,
    projectsRoute,
    projectDetailRoute,
    designSystemRoute,
  ]);
  const history = createMemoryHistory({ initialEntries: [initialEntry] });
  const router = createRouter({ routeTree, history });

  return {
    ...render(<RouterProvider router={router} />),
    history,
    queryClient,
    router,
    user: userEvent.setup(),
  };
}
