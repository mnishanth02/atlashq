import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatAtlasErrorMessage } from "@/features/projects/detail/project-detail-model";
import type { EligibleSourcePreviewItem, ProviderPolicySummary } from "./requirement-analysis-api";
import { useCreateAnalysisFreshRunMutation } from "./requirement-analysis-hooks";
import {
  formatExclusionReason,
  formatProviderPolicySummary,
  formatTokenCount,
  formatUsd,
} from "./requirement-analysis-presentation";

export type LaunchRunDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunched: (runId: string) => void;
  providerPolicies: ProviderPolicySummary[];
  providerPoliciesLoading: boolean;
  eligibleSources: EligibleSourcePreviewItem[];
  eligibleSourcesLoading: boolean;
};

export function LaunchRunDialog({
  projectId,
  open,
  onOpenChange,
  onLaunched,
  providerPolicies,
  providerPoliciesLoading,
  eligibleSources,
  eligibleSourcesLoading,
}: LaunchRunDialogProps) {
  const approvedPolicies = providerPolicies.filter(
    (policy) => policy.status === "approved" && policy.approvedForRequirementAnalysis,
  );
  const [providerPolicyId, setProviderPolicyId] = useState<string>(approvedPolicies[0]?.id ?? "");
  const [useAllEligible, setUseAllEligible] = useState(true);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  const createRunMutation = useCreateAnalysisFreshRunMutation(projectId);
  const selectedPolicy = approvedPolicies.find((policy) => policy.id === providerPolicyId);
  const includedSources = eligibleSources.filter((source) => source.included);

  const toggleSource = (sourceDocumentId: string, checked: boolean) => {
    setSelectedSourceIds((current) =>
      checked ? [...current, sourceDocumentId] : current.filter((id) => id !== sourceDocumentId),
    );
  };

  const canSubmit =
    providerPolicyId.length > 0 &&
    includedSources.length > 0 &&
    (useAllEligible || selectedSourceIds.length > 0);

  const handleSubmit = async () => {
    try {
      const run = await createRunMutation.mutateAsync({
        providerPolicyId,
        ...(useAllEligible ? {} : { sourceDocumentIds: selectedSourceIds }),
      });
      toast.success("Analysis run started.", {
        description: `Run ${run.id} is now ${run.status}.`,
      });
      onLaunched(run.id);
    } catch (error) {
      toast.error("Couldn't start the analysis run.", {
        description: formatAtlasErrorMessage(error, "The run request did not complete."),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a fresh analysis run</DialogTitle>
          <DialogDescription>
            Freezes a new snapshot of the selected eligible source evidence and starts a new run.
            Requirements, coverage, and delivery items are produced as suggestions for Module 4
            review — nothing is auto-accepted.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="provider-policy">Provider policy</FieldLabel>
            {providerPoliciesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : approvedPolicies.length === 0 ? (
              <Alert variant="destructive">
                <AlertTitle>No approved provider policy</AlertTitle>
                <AlertDescription>
                  An organization admin must approve a provider policy for requirement analysis
                  before a run can start.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={providerPolicyId} onValueChange={setProviderPolicyId}>
                <SelectTrigger id="provider-policy" className="w-full">
                  <SelectValue placeholder="Select a provider policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Approved policies</SelectLabel>
                    {approvedPolicies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.policyName} · {formatProviderPolicySummary(policy.provider)} ·{" "}
                        {policy.modelAlias}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <FieldDescription>
              Every run is scoped to a single approved, data-retention-safe provider policy.
            </FieldDescription>
          </Field>

          {selectedPolicy ? (
            <Alert>
              <AlertTitle>Conservative run budget</AlertTitle>
              <AlertDescription>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <li>Max cost: {formatUsd(selectedPolicy.maxUsdPerRun)}</li>
                  <li>Max wall clock: {selectedPolicy.maxWallClockSeconds}s</li>
                  <li>Max input tokens: {formatTokenCount(selectedPolicy.maxInputTokensPerRun)}</li>
                  <li>
                    Max output tokens: {formatTokenCount(selectedPolicy.maxOutputTokensPerRun)}
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor="use-all-eligible">
              <Checkbox
                id="use-all-eligible"
                checked={useAllEligible}
                onCheckedChange={(checked) => setUseAllEligible(checked === true)}
              />
              Use all eligible sources
            </FieldLabel>
            <FieldDescription>
              {includedSources.length} of {eligibleSources.length} previewed sources currently
              qualify for analysis.
            </FieldDescription>
          </Field>

          {!useAllEligible ? (
            <Field>
              <FieldLabel>Select sources</FieldLabel>
              {eligibleSourcesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-border p-2">
                  {eligibleSources.map((source) => (
                    <FieldLabel
                      key={source.sourceDocumentId}
                      htmlFor={`source-${source.sourceDocumentId}`}
                      className="text-sm font-normal"
                    >
                      <Checkbox
                        id={`source-${source.sourceDocumentId}`}
                        disabled={!source.included}
                        checked={selectedSourceIds.includes(source.sourceDocumentId)}
                        onCheckedChange={(checked) =>
                          toggleSource(source.sourceDocumentId, checked === true)
                        }
                      />
                      <FieldContent>
                        <span>{source.title}</span>
                        {!source.included ? (
                          <FieldDescription>
                            {formatExclusionReason(source.exclusionReason)}
                          </FieldDescription>
                        ) : null}
                      </FieldContent>
                    </FieldLabel>
                  ))}
                </div>
              )}
            </Field>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRunMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || createRunMutation.isPending}
          >
            {createRunMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Start run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
