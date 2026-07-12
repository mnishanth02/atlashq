import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SeverityIndicator } from "@/components/atlas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatAtlasErrorMessage } from "@/features/projects/detail/project-detail-model";
import type { AnalysisRunSummary, ProviderPolicySummary } from "./requirement-analysis-api";
import {
  useCancelAnalysisRunMutation,
  useReplayAnalysisRunMutation,
  useReprocessAnalysisRunMutation,
  useRetryAnalysisRunMutation,
} from "./requirement-analysis-hooks";
import {
  canCancelRun,
  canReplayRun,
  canReprocessRun,
  canRetryRun,
  formatRunMode,
  formatRunStatus,
  formatUsd,
  getRunStatusMeta,
} from "./requirement-analysis-presentation";

export type RunHistoryTableProps = {
  projectId: string;
  runs: AnalysisRunSummary[];
  canAnalyze: boolean;
  providerPolicies: ProviderPolicySummary[];
};

export function RunHistoryTable({
  projectId,
  runs,
  canAnalyze,
  providerPolicies,
}: RunHistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Requirements</TableHead>
            <TableHead>Delivery items</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <RunHistoryRow
              key={run.id}
              projectId={projectId}
              run={run}
              canAnalyze={canAnalyze}
              providerPolicies={providerPolicies}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RunHistoryRow({
  projectId,
  run,
  canAnalyze,
  providerPolicies,
}: {
  projectId: string;
  run: AnalysisRunSummary;
  canAnalyze: boolean;
  providerPolicies: ProviderPolicySummary[];
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const statusMeta = getRunStatusMeta(run.status);

  const cancelMutation = useCancelAnalysisRunMutation(projectId, run.id);
  const retryMutation = useRetryAnalysisRunMutation(projectId, run.id);
  const replayMutation = useReplayAnalysisRunMutation(projectId, run.id);

  const showCancel = canCancelRun(run.status, canAnalyze);
  const showRetry = canRetryRun(run.status, run.failureRetryable, canAnalyze);
  const showReplay = canReplayRun(run.status, canAnalyze);
  const showReprocess = canReprocessRun(run.status, canAnalyze);
  const hasActions = showCancel || showRetry || showReplay || showReprocess;

  const handleRetry = async () => {
    try {
      const next = await retryMutation.mutateAsync({});
      toast.success("Retry started.", { description: `New run ${next.id} created.` });
    } catch (error) {
      toast.error("Couldn't retry this run.", {
        description: formatAtlasErrorMessage(error, "The retry request did not complete."),
      });
    }
  };

  const handleReplay = async () => {
    try {
      const next = await replayMutation.mutateAsync({});
      toast.success("Replay started.", { description: `New run ${next.id} created.` });
    } catch (error) {
      toast.error("Couldn't replay this run.", {
        description: formatAtlasErrorMessage(error, "The replay request did not complete."),
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({});
      toast.success("Cancellation requested.");
      setConfirmCancel(false);
    } catch (error) {
      toast.error("Couldn't cancel this run.", {
        description: formatAtlasErrorMessage(error, "The cancel request did not complete."),
      });
    }
  };

  return (
    <TableRow>
      <TableCell className="max-w-56">
        <Link
          to="/projects/$projectId/requirement-analysis/$runId"
          params={{ projectId, runId: run.id }}
          className="font-mono text-xs text-foreground hover:underline"
        >
          {run.id}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{formatRunMode(run.mode)}</Badge>
      </TableCell>
      <TableCell>
        <SeverityIndicator
          size="sm"
          severity={statusMeta.severity}
          label={formatRunStatus(run.status)}
        />
      </TableCell>
      <TableCell>{formatUsd(run.usage.costUsd)}</TableCell>
      <TableCell>{run.artifactCounts.requirements}</TableCell>
      <TableCell>{run.artifactCounts.deliveryItems}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Not started"}
      </TableCell>
      <TableCell className="text-right">
        {hasActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showCancel ? (
                <DropdownMenuItem onSelect={() => setConfirmCancel(true)}>
                  Cancel run
                </DropdownMenuItem>
              ) : null}
              {showRetry ? (
                <DropdownMenuItem onSelect={() => void handleRetry()}>Retry run</DropdownMenuItem>
              ) : null}
              {showReplay ? (
                <DropdownMenuItem onSelect={() => void handleReplay()}>Replay run</DropdownMenuItem>
              ) : null}
              {showReprocess ? (
                <DropdownMenuItem onSelect={() => setReprocessOpen(true)}>
                  Reprocess run
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {confirmCancel ? (
        <AlertDialog open onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this analysis run?</AlertDialogTitle>
              <AlertDialogDescription>
                The run will stop at its next safe checkpoint. Artifacts already produced remain
                available for review.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelMutation.isPending}>
                Keep running
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={cancelMutation.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleCancel();
                }}
              >
                {cancelMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                Cancel run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {reprocessOpen ? (
        <ReprocessRunDialog
          projectId={projectId}
          run={run}
          providerPolicies={providerPolicies}
          open
          onOpenChange={setReprocessOpen}
        />
      ) : null}
    </TableRow>
  );
}

function ReprocessRunDialog({
  projectId,
  run,
  providerPolicies,
  open,
  onOpenChange,
}: {
  projectId: string;
  run: AnalysisRunSummary;
  providerPolicies: ProviderPolicySummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const approvedPolicies = providerPolicies.filter(
    (policy) => policy.status === "approved" && policy.approvedForRequirementAnalysis,
  );
  const [providerPolicyId, setProviderPolicyId] = useState(run.providerPolicy.providerPolicyId);
  const [promptBundleVersion, setPromptBundleVersion] = useState(
    run.provenance.promptBundleVersion,
  );
  const [schemaBundleVersion, setSchemaBundleVersion] = useState(
    run.provenance.schemaBundleVersion,
  );
  const [pipelineVersion, setPipelineVersion] = useState(run.provenance.pipelineVersion);
  const [reason, setReason] = useState("");

  const reprocessMutation = useReprocessAnalysisRunMutation(projectId, run.id);

  const handleSubmit = async () => {
    try {
      const next = await reprocessMutation.mutateAsync({
        providerPolicyId,
        promptBundleVersion,
        schemaBundleVersion,
        pipelineVersion,
        ...(reason.length > 0 ? { reason } : {}),
      });
      toast.success("Reprocess started.", { description: `New run ${next.id} created.` });
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't reprocess this run.", {
        description: formatAtlasErrorMessage(error, "The reprocess request did not complete."),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reprocess run {run.id}</DialogTitle>
          <DialogDescription>
            Reuses the same frozen source snapshot with an explicit new provider policy, prompt,
            schema, or pipeline version. This never overwrites the original run.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reprocess-policy">Provider policy</FieldLabel>
            <Select value={providerPolicyId} onValueChange={setProviderPolicyId}>
              <SelectTrigger id="reprocess-policy" className="w-full">
                <SelectValue placeholder="Select a provider policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Approved policies</SelectLabel>
                  {approvedPolicies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.policyName} · {policy.modelAlias}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="reprocess-prompt-version">Prompt bundle version</FieldLabel>
            <Input
              id="reprocess-prompt-version"
              value={promptBundleVersion}
              onChange={(event) => setPromptBundleVersion(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reprocess-schema-version">Schema bundle version</FieldLabel>
            <Input
              id="reprocess-schema-version"
              value={schemaBundleVersion}
              onChange={(event) => setSchemaBundleVersion(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reprocess-pipeline-version">Pipeline version</FieldLabel>
            <Input
              id="reprocess-pipeline-version"
              value={pipelineVersion}
              onChange={(event) => setPipelineVersion(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reprocess-reason">Reason (optional)</FieldLabel>
            <Textarea
              id="reprocess-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>
              Recorded on the new run for traceability back to this decision.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reprocessMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              reprocessMutation.isPending ||
              providerPolicyId.length === 0 ||
              promptBundleVersion.length === 0 ||
              schemaBundleVersion.length === 0 ||
              pipelineVersion.length === 0
            }
          >
            {reprocessMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Start reprocess
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
