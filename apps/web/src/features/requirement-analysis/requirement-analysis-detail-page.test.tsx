import { screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requirementAnalysisDetailSearchSchema } from "@/routes/projects/requirement-analysis-search";
import {
  makeAnalysisBatchListResponse,
  makeAnalysisBatchSummary,
  makeAnalysisRunDetailResponse,
  makeAnalysisStageListResponse,
  makeAnalysisStageSummary,
  makeAssumptionDeliveryItem,
  makeBlockerDeliveryItem,
  makeCitationEvidenceResponse,
  makeCitationListItem,
  makeCitationListResponse,
  makeCoverageEntry,
  makeCoverageListResponse,
  makeCurrentUser,
  makeDeliveryItemListResponse,
  makeDependencyDeliveryItem,
  makeMembership,
  makeMembershipList,
  makeProject,
  makeQuestionDeliveryItem,
  makeRequirementListItem,
  makeRequirementListResponse,
  makeRiskDeliveryItem,
  makeScopeChangeCandidateDeliveryItem,
  makeTraceabilityLink,
  makeTraceabilityListResponse,
} from "@/test/fixtures";
import { atlasHandlers } from "@/test/handlers";
import { createMswServer, setupMswServer } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { RequirementAnalysisDetailPage } from "./requirement-analysis-detail-page";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: authMocks.useSession,
}));

const server = createMswServer();
setupMswServer(server);

const PROJECT_ID = "project-1";
const RUN_ID = "run-1";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const EMPTY_SEARCH = requirementAnalysisDetailSearchSchema.parse({});

function useBaseHandlers({
  role = "member" as "admin" | "member",
  membership = makeMembership({
    userId: OWNER_ID,
    role: "Business Analyst / Coordinator",
  }),
} = {}) {
  server.use(
    atlasHandlers.currentUser(makeCurrentUser({ organizationRole: role, id: OWNER_ID })),
    atlasHandlers.project(PROJECT_ID, makeProject({ id: PROJECT_ID })),
    atlasHandlers.memberships(PROJECT_ID, makeMembershipList([membership])),
  );
}

function renderDetailPage(
  initialSearch = EMPTY_SEARCH,
  onSearchChangeSpy?: (partial: Partial<typeof EMPTY_SEARCH>) => void,
) {
  // Mirrors the real route: `search` is controlled by the parent and only
  // changes when `onSearchChange` feeds a new value back in, so tab clicks
  // (which are implemented as `onSearchChange({ tab })`) actually switch the
  // visible panel here, the same way TanStack Router re-renders on navigation.
  function Harness() {
    const [search, setSearch] = useState(initialSearch);
    return (
      <RequirementAnalysisDetailPage
        projectId={PROJECT_ID}
        runId={RUN_ID}
        search={search}
        onSearchChange={(partial) => {
          onSearchChangeSpy?.(partial);
          setSearch((prev) => ({ ...prev, ...partial }));
        }}
      />
    );
  }

  return renderWithProviders(<Harness />, {
    initialEntry: `/projects/${PROJECT_ID}/requirement-analysis/${RUN_ID}`,
  });
}

describe("RequirementAnalysisDetailPage", () => {
  beforeEach(() => {
    authMocks.useSession.mockReturnValue({ data: undefined });
    vi.useRealTimers();
  });

  it("renders the read-only Module 4 handoff banner and run header", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID, status: "completed" }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
    );
    renderDetailPage();

    expect(await screen.findByRole("heading", { name: RUN_ID })).toBeInTheDocument();
    expect(screen.getByText("This is a read-only AI draft")).toBeInTheDocument();
    expect(
      screen.getByText(/Module 4 owns accept, edit, reject, and bulk review/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders a failure banner when the run has failed", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({
          id: RUN_ID,
          status: "failed",
          failureCode: "BUDGET_EXCEEDED",
          failureDetail: "The run exceeded its configured USD budget.",
          failureRetryable: true,
        }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
    );
    renderDetailPage();

    expect(await screen.findByText("BUDGET_EXCEEDED")).toBeInTheDocument();
    expect(screen.getByText("The run exceeded its configured USD budget.")).toBeInTheDocument();
  });

  it("shows a confidence meter only for confirmed/assumed requirements, never for unknown/conflicting", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(
        PROJECT_ID,
        RUN_ID,
        makeRequirementListResponse([
          makeRequirementListItem({
            id: "req-confirmed",
            title: "Confirmed requirement",
            epistemicStatus: "confirmed",
            confidenceBand: "high",
          }),
          makeRequirementListItem({
            id: "req-unknown",
            title: "Unknown requirement",
            epistemicStatus: "unknown",
            confidenceBand: null,
          }),
          makeRequirementListItem({
            id: "req-conflicting",
            title: "Conflicting requirement",
            epistemicStatus: "conflicting",
            confidenceBand: null,
          }),
        ]),
      ),
    );
    renderDetailPage();

    expect(await screen.findByText("Confirmed requirement")).toBeInTheDocument();
    expect(screen.getByText("Unknown requirement")).toBeInTheDocument();
    expect(screen.getByText("Conflicting requirement")).toBeInTheDocument();

    const notApplicableLabels = screen.getAllByText("Not applicable");
    expect(notApplicableLabels).toHaveLength(2);
  });

  it("renders every 6 delivery item types via the discriminated union", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
      atlasHandlers.analysisDeliveryItems(
        PROJECT_ID,
        RUN_ID,
        makeDeliveryItemListResponse([
          makeQuestionDeliveryItem(),
          makeRiskDeliveryItem(),
          makeAssumptionDeliveryItem(),
          makeDependencyDeliveryItem(),
          makeBlockerDeliveryItem(),
          makeScopeChangeCandidateDeliveryItem(),
        ]),
      ),
    );
    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });

    await view.user.click(screen.getByRole("tab", { name: "Delivery items" }));

    expect(await screen.findByText("What SSO provider should be used?")).toBeInTheDocument();
    expect(screen.getByText("Vendor SLA may not cover peak load")).toBeInTheDocument();
    expect(screen.getByText("Assumed single-region deployment")).toBeInTheDocument();
    expect(screen.getByText("Depends on identity platform migration")).toBeInTheDocument();
    expect(screen.getByText("Conflicting statements about password policy")).toBeInTheDocument();
    expect(screen.getByText("New reporting export format requested")).toBeInTheDocument();
  });

  it("always renders all 18 fixed coverage categories, even with only a few entries recorded", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
      atlasHandlers.analysisCoverage(
        PROJECT_ID,
        RUN_ID,
        makeCoverageListResponse([makeCoverageEntry({ categoryKey: "auth_identity" })]),
      ),
    );
    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });

    await view.user.click(screen.getByRole("tab", { name: "Coverage" }));

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    // Header row + 18 fixed rubric rows.
    expect(rows).toHaveLength(19);
    expect(within(table).getByText("Auth/identity")).toBeInTheDocument();
    expect(within(table).getByText("Backup/DR")).toBeInTheDocument();
    expect(within(table).getAllByText("Not yet analyzed").length).toBeGreaterThan(0);
  });

  it("expands a stage row to show its batches and any failure detail", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
      atlasHandlers.analysisStages(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisStageListResponse([
          makeAnalysisStageSummary({
            id: "stage-failed",
            kind: "batch_planning",
            status: "failed",
            failureCode: "SCHEMA_VALIDATION_FAILED",
            failureDetail: "Batch output did not match the expected schema.",
          }),
        ]),
      ),
      atlasHandlers.analysisBatches(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisBatchListResponse([makeAnalysisBatchSummary({ stageId: "stage-failed" })]),
      ),
    );
    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });

    await view.user.click(screen.getByRole("tab", { name: "Stages" }));
    await view.user.click(await screen.findByRole("button", { name: /Batch planning/i }));

    expect(
      await screen.findByText(/SCHEMA_VALIDATION_FAILED: Batch output did not match/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Batch 1 · chunks 0-20/i)).toBeInTheDocument();
  });

  it("opens the evidence drawer for a requirement and shows full citation provenance", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(
        PROJECT_ID,
        RUN_ID,
        makeRequirementListResponse([
          makeRequirementListItem({ id: "req-1", title: "Users can reset their password" }),
        ]),
      ),
      atlasHandlers.analysisCitations(
        PROJECT_ID,
        RUN_ID,
        makeCitationListResponse([
          makeCitationListItem({ id: "citation-1", requirementId: "req-1" }),
        ]),
      ),
      atlasHandlers.analysisCitationEvidence(
        PROJECT_ID,
        RUN_ID,
        "citation-1",
        makeCitationEvidenceResponse({ id: "citation-1" }),
      ),
    );
    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });

    await view.user.click(await screen.findByRole("button", { name: "View evidence" }));

    expect(
      await screen.findByRole("heading", { name: /Evidence — Users can reset their password/i }),
    ).toBeInTheDocument();

    await view.user.click(await screen.findByRole("button", { name: /Source chunk #4/i }));

    expect(await screen.findByText(/Initial requirements pack · v1/i)).toBeInTheDocument();
    expect(screen.getByText("Verified exact match")).toBeInTheDocument();
  });

  it("renders traceability links between requirements and citations", async () => {
    useBaseHandlers();
    server.use(
      atlasHandlers.analysisRunDetail(
        PROJECT_ID,
        RUN_ID,
        makeAnalysisRunDetailResponse({ id: RUN_ID }),
      ),
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
      atlasHandlers.analysisTraceability(
        PROJECT_ID,
        RUN_ID,
        makeTraceabilityListResponse([
          makeTraceabilityLink({
            fromId: "requirement-1",
            toId: "citation-1",
            relation: "supported_by",
          }),
        ]),
      ),
    );
    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });

    await view.user.click(screen.getByRole("tab", { name: "Traceability" }));

    expect(await screen.findByText("requirement-1")).toBeInTheDocument();
    expect(screen.getByText(/supported_by → citation/i)).toBeInTheDocument();
  });

  it("stops polling exactly once the run reaches a terminal status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useBaseHandlers();
    let requestCount = 0;
    server.use(
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
    );
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/runs/${RUN_ID}`, () => {
        requestCount += 1;
        const status: "completed" | "running" = requestCount >= 2 ? "completed" : "running";
        return HttpResponse.json(makeAnalysisRunDetailResponse({ id: RUN_ID, status }));
      }),
    );

    renderDetailPage();

    await vi.waitFor(() => expect(requestCount).toBeGreaterThanOrEqual(1));
    expect(await screen.findByText("Running")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3_100);
    await vi.waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());

    const countAtTerminal = requestCount;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requestCount).toBe(countAtTerminal);

    vi.useRealTimers();
  });

  it("polls the stage list every 3 seconds while the run is non-terminal and stops exactly at terminal status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useBaseHandlers();
    let runRequestCount = 0;
    let stagesRequestCount = 0;
    server.use(
      atlasHandlers.analysisRequirements(PROJECT_ID, RUN_ID, makeRequirementListResponse([])),
    );
    server.use(
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/runs/${RUN_ID}`, () => {
        runRequestCount += 1;
        const status: "completed" | "running" = runRequestCount >= 3 ? "completed" : "running";
        return HttpResponse.json(makeAnalysisRunDetailResponse({ id: RUN_ID, status }));
      }),
      http.get(`*/api/v1/projects/${PROJECT_ID}/requirement-analysis/runs/${RUN_ID}/stages`, () => {
        stagesRequestCount += 1;
        return HttpResponse.json(makeAnalysisStageListResponse([]));
      }),
    );

    const view = renderDetailPage();
    await screen.findByRole("heading", { name: RUN_ID });
    await view.user.click(screen.getByRole("tab", { name: "Stages" }));

    await vi.waitFor(() => expect(stagesRequestCount).toBeGreaterThanOrEqual(1));
    const initialStagesCount = stagesRequestCount;

    // Two more 3-second polling windows while the run is still running should
    // produce additional stage-list requests (live refresh), not a single
    // fetch-and-forget.
    await vi.advanceTimersByTimeAsync(3_100);
    await vi.advanceTimersByTimeAsync(3_100);
    await vi.waitFor(() => expect(stagesRequestCount).toBeGreaterThan(initialStagesCount));

    // The run detail poll flips to "completed" on its third fetch.
    await vi.advanceTimersByTimeAsync(3_100);
    await vi.waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());

    const stagesCountAtTerminal = stagesRequestCount;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(stagesRequestCount).toBe(stagesCountAtTerminal);

    vi.useRealTimers();
  });
});
