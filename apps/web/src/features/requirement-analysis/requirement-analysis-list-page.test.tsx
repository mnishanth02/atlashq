import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirementAnalysisSearchSchema } from "@/routes/projects/requirement-analysis-search";
import {
  makeAnalysisRunDetailResponse,
  makeAnalysisRunListResponse,
  makeAnalysisRunSummary,
  makeCurrentUser,
  makeEligibleSourcePreviewItem,
  makeEligibleSourcePreviewResponse,
  makeMembership,
  makeMembershipList,
  makeProject,
  makeProviderPolicyListResponse,
  makeProviderPolicySummary,
  makeRequirementAnalysisCapabilities,
} from "@/test/fixtures";
import { apiError, atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { RequirementAnalysisListPage } from "./requirement-analysis-list-page";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: authMocks.useSession,
}));

const server = createMswServer();
setupMswServer(server);

const EMPTY_SEARCH = requirementAnalysisSearchSchema.parse({});
const LAUNCH_SEARCH = requirementAnalysisSearchSchema.parse({ launch: true });
const PROJECT_ID = "project-1";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

function useAnalysisHandlers({
  role = "member" as "admin" | "member",
  membership = makeMembership({
    userId: OWNER_ID,
    role: "Business Analyst / Coordinator",
  }),
  capabilities = makeRequirementAnalysisCapabilities(),
  providerPolicies = makeProviderPolicyListResponse([makeProviderPolicySummary()]),
  eligibleSources = makeEligibleSourcePreviewResponse([makeEligibleSourcePreviewItem()]),
  runs = makeAnalysisRunListResponse([makeAnalysisRunSummary()]),
}: {
  role?: "admin" | "member";
  membership?: ReturnType<typeof makeMembership>;
  capabilities?: ReturnType<typeof makeRequirementAnalysisCapabilities>;
  providerPolicies?: ReturnType<typeof makeProviderPolicyListResponse>;
  eligibleSources?: ReturnType<typeof makeEligibleSourcePreviewResponse>;
  runs?: ReturnType<typeof makeAnalysisRunListResponse>;
} = {}) {
  server.use(
    atlasHandlers.currentUser(makeCurrentUser({ organizationRole: role, id: OWNER_ID })),
    atlasHandlers.project(PROJECT_ID, makeProject({ id: PROJECT_ID })),
    atlasHandlers.memberships(PROJECT_ID, makeMembershipList([membership])),
    atlasHandlers.requirementAnalysisCapabilities(PROJECT_ID, capabilities),
    atlasHandlers.requirementAnalysisProviderPolicies(PROJECT_ID, providerPolicies),
    atlasHandlers.requirementAnalysisEligibleSources(PROJECT_ID, eligibleSources),
    atlasHandlers.analysisRuns(PROJECT_ID, runs),
  );
}

function renderListPage({
  search = EMPTY_SEARCH,
  onSearchChange = vi.fn(),
  onRunLaunched = vi.fn(),
}: {
  search?: typeof EMPTY_SEARCH;
  onSearchChange?: (partial: Partial<typeof EMPTY_SEARCH>) => void;
  onRunLaunched?: (runId: string) => void;
} = {}) {
  return renderWithProviders(
    <RequirementAnalysisListPage
      projectId={PROJECT_ID}
      search={search}
      onSearchChange={onSearchChange}
      onRunLaunched={onRunLaunched}
    />,
    { initialEntry: `/projects/${PROJECT_ID}/requirement-analysis` },
  );
}

describe("RequirementAnalysisListPage", () => {
  beforeEach(() => {
    authMocks.useSession.mockReturnValue({ data: undefined });
  });

  it("renders the heading, Module 4 handoff copy, and a Start fresh run CTA for analysts", async () => {
    useAnalysisHandlers();
    renderListPage();

    expect(
      await screen.findByRole("heading", { name: "Requirement analysis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Module 4 owns accept, edit, reject, and bulk review/i),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Start fresh run/i })).toBeEnabled();
  });

  it("shows the safe-disabled capability notice and hides the launch CTA when the server disables analysis", async () => {
    useAnalysisHandlers({
      capabilities: makeRequirementAnalysisCapabilities({
        analysisEnabled: false,
        safeDisabled: true,
        safeDisabledReason: "analysis_feature_disabled",
      }),
    });
    renderListPage();

    expect(
      await screen.findByText(/AI requirement analysis is disabled for this workspace/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start fresh run/i })).not.toBeInTheDocument();
  });

  it("shows a read-only role note (not a capability reason) for QA readers", async () => {
    useAnalysisHandlers({
      membership: makeMembership({ userId: OWNER_ID, role: "QA" }),
    });
    renderListPage();

    expect(
      await screen.findByRole("heading", { name: "Requirement analysis" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start fresh run/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Read-only role/i)).toBeInTheDocument();
  });

  it("renders the no-eligible-sources empty state when nothing qualifies", async () => {
    useAnalysisHandlers({ eligibleSources: makeEligibleSourcePreviewResponse([]) });
    renderListPage();

    expect(await screen.findByText("No eligible sources")).toBeInTheDocument();
  });

  it("explains that eligible sources require an active project", async () => {
    useAnalysisHandlers();
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/eligible-sources`, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            code: "AI_ANALYSIS_DISABLED",
            message: "Requirement-analysis runs are only allowed for active projects.",
            correlationId: "corr-project-not-active",
          },
          { status: 409 },
        ),
      ),
    );
    renderListPage();

    expect(
      await screen.findByText("This project must be Active before sources can be analyzed."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No eligible sources")).not.toBeInTheDocument();
  });

  it("surfaces exclusion reasons for excluded sources in the eligible-source preview", async () => {
    useAnalysisHandlers({
      eligibleSources: makeEligibleSourcePreviewResponse([
        makeEligibleSourcePreviewItem({ included: true }),
        makeEligibleSourcePreviewItem({
          sourceDocumentId: "source-2",
          title: "Vendor reference deck",
          sourceType: "reference",
          included: false,
          exclusionReason: "reference_not_cleared",
        }),
      ]),
    });
    renderListPage();

    expect(await screen.findByText(/1 of 2 sources qualify/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Vendor reference deck: Reference material has not cleared IP review\./i),
    ).toBeInTheDocument();
  });

  it("renders the no-runs empty state with a Start first run action when launch is allowed", async () => {
    useAnalysisHandlers({ runs: makeAnalysisRunListResponse([]) });
    renderListPage();

    expect(await screen.findByText("No analysis runs yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start first run/i })).toBeInTheDocument();
  });

  it("renders run history rows with status, cost, and artifact counts", async () => {
    useAnalysisHandlers({
      runs: makeAnalysisRunListResponse([
        makeAnalysisRunSummary({
          id: "run-42",
          status: "completed_with_warnings",
          usage: { inputTokensUsed: 1000, outputTokensUsed: 200, costUsd: 2.5 },
          artifactCounts: { requirements: 9, citations: 20, coverageEntries: 18, deliveryItems: 4 },
        }),
      ]),
    });
    renderListPage();

    expect(await screen.findByText("run-42")).toBeInTheDocument();
    expect(screen.getByText("Completed with warnings")).toBeInTheDocument();
    expect(screen.getByText("$2.50")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("requests the launch dialog to open via onSearchChange when Start fresh run is clicked", async () => {
    const onSearchChange = vi.fn();
    useAnalysisHandlers();
    const view = renderListPage({ onSearchChange });

    await view.user.click(await screen.findByRole("button", { name: /Start fresh run/i }));

    expect(onSearchChange).toHaveBeenCalledWith({ launch: true });
  });

  it("navigates to the run detail page after launching a fresh run", async () => {
    useAnalysisHandlers();
    server.use(
      atlasHandlers.createAnalysisFreshRun(
        PROJECT_ID,
        makeAnalysisRunDetailResponse({ id: "run-new", status: "queued" }),
      ),
    );

    let view: ReturnType<typeof renderListPage>;
    const onSearchChange = vi.fn((next: Partial<typeof EMPTY_SEARCH>) => {
      void view.router.navigate({
        to: "/projects/$projectId/requirement-analysis",
        params: { projectId: PROJECT_ID },
        search: ((existing: Record<string, unknown>) => ({ ...existing, ...next })) as never,
        replace: true,
      });
    });
    view = renderListPage({
      search: LAUNCH_SEARCH,
      onSearchChange,
      onRunLaunched: (runId) => {
        void view.router.navigate({
          to: "/projects/$projectId/requirement-analysis/$runId",
          params: { projectId: PROJECT_ID, runId },
        });
      },
    });

    const dialogHeading = await screen.findByRole("heading", {
      name: /Start a fresh analysis run/i,
    });
    expect(dialogHeading).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Start run" }));

    await vi.waitFor(() => {
      expect(view.router.state.location.pathname).toBe(
        `/projects/${PROJECT_ID}/requirement-analysis/run-new`,
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it("shows a no-approved-policy notice and blocks submit when there is no approved provider policy", async () => {
    useAnalysisHandlers({
      providerPolicies: makeProviderPolicyListResponse([
        makeProviderPolicySummary({ status: "draft", approvedForRequirementAnalysis: false }),
      ]),
    });
    renderListPage({ search: LAUNCH_SEARCH });

    expect(await screen.findByText("No approved provider policy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start run" })).toBeDisabled();
  });

  it("hides the launch CTA and shows an access-denied empty state for a Client Viewer / Approver", async () => {
    let providerPoliciesRequestCount = 0;
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      atlasHandlers.project(PROJECT_ID, makeProject({ id: PROJECT_ID })),
      atlasHandlers.memberships(
        PROJECT_ID,
        makeMembershipList([
          makeMembership({ userId: OWNER_ID, role: "Client Viewer / Approver" }),
        ]),
      ),
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/provider-policies`, () => {
        providerPoliciesRequestCount += 1;
        return HttpResponse.json(makeProviderPolicyListResponse([makeProviderPolicySummary()]));
      }),
    );
    renderListPage();

    expect(await screen.findByText(/Access denied/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start fresh run/i })).not.toBeInTheDocument();
    // A Client Viewer / Approver can never read requirement-analysis, so the
    // provider-policies query must be gated off just like capabilities/runs;
    // this must fail loudly on a regression instead of merely logging an
    // "unhandled request" warning.
    expect(providerPoliciesRequestCount).toBe(0);
  });

  it("renders the access-denied state when the project API returns 403", async () => {
    let providerPoliciesRequestCount = 0;
    server.use(
      atlasHandlers.currentUser(makeCurrentUser({ organizationRole: "member", id: OWNER_ID })),
      http.get("*/api/v1/projects/project-1", () => apiError(403, "Not a member of this project")),
      atlasHandlers.memberships(PROJECT_ID, makeMembershipList([])),
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/provider-policies`, () => {
        providerPoliciesRequestCount += 1;
        return HttpResponse.json(makeProviderPolicyListResponse([makeProviderPolicySummary()]));
      }),
    );
    renderListPage();

    expect(await screen.findByText(/Access denied/i)).toBeInTheDocument();
    // No-access states must never issue the provider-policies request either.
    expect(providerPoliciesRequestCount).toBe(0);
  });

  it("shows the run-list error state with a retry action when the run list fails", async () => {
    let attempts = 0;
    useAnalysisHandlers({ runs: makeAnalysisRunListResponse([]) });
    server.use(
      http.get("*/api/v1/projects/project-1/requirement-analysis/runs", () => {
        attempts += 1;
        return attempts === 1
          ? apiError(500, "Run history temporarily unavailable")
          : HttpResponse.json(makeAnalysisRunListResponse([makeAnalysisRunSummary()]));
      }),
    );

    const view = renderListPage();
    expect(await screen.findByText("Run history temporarily unavailable")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("run-1")).toBeInTheDocument();
  });
});
