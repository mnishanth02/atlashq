import { toast } from "sonner";
import {
  CitationChip,
  CONFIDENCE_LEVELS,
  ConfidenceMeter,
  EPISTEMIC_STATUSES,
  EpistemicBadge,
  type Evidence,
  LIFECYCLE_STATUSES,
  PROVENANCE_KINDS,
  ProvenanceTag,
  SEVERITIES,
  SeverityIndicator,
  StatusPill,
  TraceabilityChain,
  type TraceNode,
} from "@/components/atlas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border/70 py-14 first:border-t-0">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

function Swatch({ swatch, name, note }: { swatch: string; name: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-14 w-full rounded-lg border border-border/60", swatch)} />
      <div className="flex flex-col">
        <span className="font-mono text-xs text-foreground">{name}</span>
        {note ? <span className="text-[0.6875rem] text-muted-foreground">{note}</span> : null}
      </div>
    </div>
  );
}

const UI_SWATCHES: { swatch: string; name: string; note?: string }[] = [
  { swatch: "bg-background", name: "background", note: "App canvas" },
  { swatch: "bg-card", name: "card", note: "Raised surface" },
  { swatch: "bg-muted", name: "muted", note: "Subtle fill" },
  { swatch: "bg-primary", name: "primary", note: "Meridian teal" },
  { swatch: "bg-secondary", name: "secondary" },
  { swatch: "bg-accent", name: "accent" },
  { swatch: "bg-foreground", name: "foreground", note: "Ink text" },
  { swatch: "bg-destructive", name: "destructive" },
];

const EPISTEMIC_SWATCHES: { swatch: string; name: string }[] = [
  { swatch: "bg-confirmed", name: "confirmed" },
  { swatch: "bg-assumed", name: "assumed" },
  { swatch: "bg-unknown", name: "unknown" },
  { swatch: "bg-conflicting", name: "conflicting" },
];

const SEVERITY_SWATCHES: { swatch: string; name: string }[] = [
  { swatch: "bg-sev-critical", name: "critical" },
  { swatch: "bg-sev-high", name: "high" },
  { swatch: "bg-sev-medium", name: "medium" },
  { swatch: "bg-sev-low", name: "low" },
  { swatch: "bg-sev-info", name: "info" },
];

const TRACE_NODES: TraceNode[] = [
  { id: "SRC-02", label: "SRC-02", kind: "Source", onSelect: () => {} },
  { id: "REQ-014", label: "REQ-014", kind: "Requirement", onSelect: () => {} },
  { id: "SCP-07", label: "SCP-07", kind: "Scope", current: true, onSelect: () => {} },
  { id: "ADR-03", label: "ADR-03", kind: "Architecture", onSelect: () => {} },
];

const SAMPLE_EVIDENCE: Evidence = {
  id: "S-12",
  source: "Discovery call — Acme Corp (transcript)",
  excerpt: "Sessions must expire after 30 minutes of inactivity for anyone touching billing data.",
  locator: "00:42:18 · line 214",
  provenance: "source",
  confidence: "high",
};

export function DesignSystemRoute() {
  return (
    <main className="bg-background text-foreground">
      <header className="relative overflow-hidden border-b border-border/70">
        <div className="absolute inset-0 bg-grid-whisper opacity-70" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            Cartographer — Ink + Meridian Teal
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            A precise, fast design system for software-delivery governance.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            AtlasHQ turns messy client inputs into cited requirements, approved scope, and
            defensible decisions. This foundation gives that work a calm, dense, legible surface —
            one confident accent, a semantic vocabulary for evidence and risk, and full light &amp;
            dark parity.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {EPISTEMIC_STATUSES.map((status) => (
              <EpistemicBadge key={status} status={status} />
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <ConfidenceMeter level="high" />
          </div>
          <nav className="mt-9 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {[
              ["Color", "color"],
              ["Typography", "typography"],
              ["Buttons", "buttons"],
              ["Forms", "forms"],
              ["Feedback", "feedback"],
              ["Overlays", "overlays"],
              ["Data", "data"],
              ["Domain", "domain"],
              ["In context", "composition"],
            ].map(([label, anchor]) => (
              <a
                key={anchor}
                href={`#${anchor}`}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6">
        <Section
          id="color"
          title="Color"
          description="A tinted-neutral base carries the interface; Meridian Teal is the single brand accent reserved for action, selection, and focus. Evidence and risk get their own semantic families so status never rides on the brand color alone."
        >
          <div className="space-y-8">
            <div>
              <FieldLabel>Interface</FieldLabel>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
                {UI_SWATCHES.map((item) => (
                  <Swatch key={item.name} {...item} />
                ))}
              </div>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <FieldLabel>Epistemic status</FieldLabel>
                <div className="grid grid-cols-4 gap-4">
                  {EPISTEMIC_SWATCHES.map((item) => (
                    <Swatch key={item.name} {...item} />
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Severity</FieldLabel>
                <div className="grid grid-cols-5 gap-4">
                  {SEVERITY_SWATCHES.map((item) => (
                    <Swatch key={item.name} {...item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="typography"
          title="Typography"
          description="Geist Sans carries the UI at a fixed rem scale; Geist Mono does the technical work — identifiers, citations, metrics, and coordinates — so structured data reads as data."
        >
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel className="flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight">
                  Requirements, made defensible
                </h1>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground/90">
                  Evidence over assertion
                </h2>
                <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
                  Body copy stays comfortable and legible at a measured line length, with pretty
                  wrapping and a calm rhythm suited to long review sessions.
                </p>
                <p className="text-sm text-muted-foreground">
                  Small print and helper text remain readable at 14px on both themes.
                </p>
              </div>
            </Panel>
            <Panel className="flex flex-col gap-5">
              <div>
                <div className="font-sans text-5xl font-semibold tracking-tight">Ag</div>
                <p className="mt-1 text-xs text-muted-foreground">Geist Sans · variable</p>
              </div>
              <Separator />
              <div className="space-y-1.5 font-mono text-sm text-foreground">
                <div>REQ-014 · ADR-03</div>
                <div className="tabular-nums">0123456789 · 99.4%</div>
                <div>40.7128&deg; N, 74.0060&deg; W</div>
                <p className="pt-0.5 font-sans text-xs text-muted-foreground">
                  Geist Mono · variable
                </p>
              </div>
            </Panel>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          description="A restrained hierarchy: one primary action per view, secondary and ghost for everything else. Focus is always visible; motion is limited to state."
        >
          <Panel className="space-y-6">
            <div>
              <FieldLabel>Variants</FieldLabel>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>
            <div>
              <FieldLabel>Sizes</FieldLabel>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </Panel>
        </Section>

        <Section
          id="forms"
          title="Forms"
          description="Inputs favor clarity and hit-area over ornament. Labels are always present, states are obvious, and controls line up on a shared baseline grid."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Panel className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ds-workspace">Workspace name</Label>
                <Input id="ds-workspace" defaultValue="Acme Corp — Billing platform" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-owner">Owner</Label>
                <Select defaultValue="ea">
                  <SelectTrigger id="ds-owner" className="w-full">
                    <SelectValue placeholder="Assign an owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Delivery leads</SelectLabel>
                      <SelectItem value="ea">Erin Alvarez</SelectItem>
                      <SelectItem value="jd">Jordan Diaz</SelectItem>
                      <SelectItem value="ml">Mara Lindqvist</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-notes">Reviewer note</Label>
                <Textarea id="ds-notes" placeholder="Add context for the next reviewer…" rows={3} />
              </div>
            </Panel>
            <Panel className="space-y-5">
              <div className="flex items-start gap-3">
                <Checkbox id="ds-cite" defaultChecked />
                <div className="space-y-0.5">
                  <Label htmlFor="ds-cite">Require citations</Label>
                  <p className="text-sm text-muted-foreground">
                    Block acceptance until every requirement links to evidence.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="ds-auto">Auto-flag conflicts</Label>
                  <p className="text-sm text-muted-foreground">
                    Surface contradictions as they appear.
                  </p>
                </div>
                <Switch id="ds-auto" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="ds-notify">Email me on approval</Label>
                  <p className="text-sm text-muted-foreground">One digest per baseline change.</p>
                </div>
                <Switch id="ds-notify" />
              </div>
            </Panel>
          </div>
        </Section>

        <Section
          id="feedback"
          title="Feedback"
          description="Badges, alerts, tooltips, and toasts share the same semantic palette so a color always means the same thing across the product."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="space-y-5">
              <div>
                <FieldLabel>Badges</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </div>
              <div>
                <FieldLabel>Interactive</FieldLabel>
                <div className="flex flex-wrap items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        Hover for tooltip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cited from 3 sources</TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      toast.success("Scope baseline approved", {
                        description: "REQ-014 moved to Approved.",
                      })
                    }
                  >
                    Fire a toast
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toast.warning("Conflict detected", {
                        description: "Two sources disagree on the timeout value.",
                      })
                    }
                  >
                    Warn
                  </Button>
                </div>
              </div>
              <div>
                <FieldLabel>Loading</FieldLabel>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            </Panel>
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Baseline is current</AlertTitle>
                <AlertDescription>
                  All accepted requirements trace to at least one source.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>2 requirements need clarification</AlertTitle>
                <AlertDescription>
                  Resolve open questions before requesting client sign-off.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </Section>

        <Section
          id="overlays"
          title="Overlays"
          description="Dialogs, sheets, menus, and the command palette layer predictably above content with a coherent z-index scale and consistent motion."
        >
          <Panel className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve scope baseline?</DialogTitle>
                  <DialogDescription>
                    This freezes REQ-001 through REQ-042 as version 1.3. Changes after approval are
                    tracked as amendments.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button>Approve baseline</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Evidence drawer</SheetTitle>
                  <SheetDescription>Inspect the sources behind a requirement.</SheetDescription>
                </SheetHeader>
                <div className="space-y-3 px-4">
                  <ProvenanceTag kind="source" variant="outline" />
                  <p className="text-sm text-muted-foreground">
                    Drawers keep supporting detail one click away without losing the reviewer&apos;s
                    place.
                  </p>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Row actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>REQ-014</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Accept</DropdownMenuItem>
                <DropdownMenuItem>Request clarification</DropdownMenuItem>
                <DropdownMenuItem variant="destructive">Reject</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-full max-w-sm">
              <FieldLabel>Command palette</FieldLabel>
              <Command className="rounded-lg border border-border shadow-sm">
                <CommandInput placeholder="Jump to requirement, source, decision…" />
                <CommandList>
                  <CommandGroup heading="Requirements">
                    <CommandItem>
                      REQ-014 · Session timeout policy
                      <CommandShortcut>⌘1</CommandShortcut>
                    </CommandItem>
                    <CommandItem>REQ-022 · Audit log retention</CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Decisions">
                    <CommandItem>ADR-03 · Token storage</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </Panel>
        </Section>

        <Section
          id="data"
          title="Data display"
          description="Tables, tabs, and identity elements are tuned for density — quiet gridlines, clear headers, and mono identifiers that stay scannable in long lists."
        >
          <div className="space-y-6">
            <Tabs defaultValue="requirements">
              <TabsList>
                <TabsTrigger value="requirements">Requirements</TabsTrigger>
                <TabsTrigger value="risks">Risks</TabsTrigger>
                <TabsTrigger value="decisions">Decisions</TabsTrigger>
              </TabsList>
              <TabsContent value="requirements" className="mt-4">
                <Panel className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">ID</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-xs">REQ-014</TableCell>
                        <TableCell>Session timeout after 30m inactivity</TableCell>
                        <TableCell>
                          <StatusPill status="accepted" size="sm" />
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfidenceMeter level="high" showLabel={false} className="justify-end" />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs">REQ-022</TableCell>
                        <TableCell>Audit logs retained for 18 months</TableCell>
                        <TableCell>
                          <StatusPill status="under-review" size="sm" />
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfidenceMeter
                            level="medium"
                            showLabel={false}
                            className="justify-end"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-xs">REQ-031</TableCell>
                        <TableCell>SSO via client identity provider</TableCell>
                        <TableCell>
                          <StatusPill status="needs-clarification" size="sm" />
                        </TableCell>
                        <TableCell className="text-right">
                          <ConfidenceMeter level="low" showLabel={false} className="justify-end" />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Panel>
              </TabsContent>
              <TabsContent value="risks" className="mt-4">
                <Panel className="flex flex-wrap gap-2">
                  {SEVERITIES.map((severity) => (
                    <SeverityIndicator key={severity} severity={severity} />
                  ))}
                </Panel>
              </TabsContent>
              <TabsContent value="decisions" className="mt-4">
                <Panel className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>EA</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <div className="font-medium">Erin Alvarez</div>
                    <div className="text-muted-foreground">Approved ADR-03 · 2 days ago</div>
                  </div>
                </Panel>
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        <Section
          id="domain"
          title="Domain components"
          description="The signature vocabulary of AtlasHQ — the pieces that make the epistemic model visible. Each is fully themed, accessible, and built from the semantic tokens above."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="space-y-4">
              <FieldLabel>Epistemic badge</FieldLabel>
              <div className="space-y-3">
                {(["subtle", "solid", "outline"] as const).map((appearance) => (
                  <div key={appearance} className="flex flex-wrap items-center gap-2">
                    {EPISTEMIC_STATUSES.map((status) => (
                      <EpistemicBadge key={status} status={status} appearance={appearance} />
                    ))}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="space-y-4">
              <FieldLabel>Confidence meter</FieldLabel>
              <div className="flex flex-wrap items-center gap-6">
                {CONFIDENCE_LEVELS.map((level) => (
                  <ConfidenceMeter key={level} level={level} />
                ))}
              </div>
              <ConfidenceMeter level="high" value={92} showValue />
            </Panel>

            <Panel className="space-y-4">
              <FieldLabel>Severity</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                {SEVERITIES.map((severity) => (
                  <SeverityIndicator key={severity} severity={severity} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {SEVERITIES.map((severity) => (
                  <SeverityIndicator key={severity} severity={severity} format="dot" />
                ))}
              </div>
            </Panel>

            <Panel className="space-y-4">
              <FieldLabel>Lifecycle status</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                {LIFECYCLE_STATUSES.map((status) => (
                  <StatusPill key={status} status={status} />
                ))}
              </div>
            </Panel>

            <Panel className="space-y-4">
              <FieldLabel>Provenance &amp; citations</FieldLabel>
              <div className="flex flex-wrap items-center gap-4">
                {PROVENANCE_KINDS.map((kind) => (
                  <ProvenanceTag key={kind} kind={kind} />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sessions must expire after 30 minutes of inactivity{" "}
                <CitationChip evidence={SAMPLE_EVIDENCE} /> for anyone touching billing data.
              </p>
            </Panel>

            <Panel className="space-y-4">
              <FieldLabel>Traceability chain</FieldLabel>
              <TraceabilityChain nodes={TRACE_NODES} />
              <p className="text-sm text-muted-foreground">
                Follow any artifact from source evidence to the decision it justifies.
              </p>
            </Panel>
          </div>
        </Section>

        <Section
          id="composition"
          title="In context"
          description="The system earns its keep when the pieces compose. Here every primitive and domain component works together in a single requirement record."
        >
          <Card className="overflow-hidden">
            <CardHeader className="border-b [.border-b]:pb-6">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                REQ-014
                <span className="size-1 rounded-full bg-muted-foreground/40" />
                Session timeout policy
              </div>
              <CardTitle className="mt-1 text-lg">
                Sessions expire after 30 minutes of inactivity
              </CardTitle>
              <CardDescription className="mt-1">
                Applies to any user with access to billing or audit data.
              </CardDescription>
              <CardAction>
                <StatusPill status="accepted" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <EpistemicBadge status="confirmed" />
                <SeverityIndicator severity="high" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Confidence</span>
                  <ConfidenceMeter level="high" showLabel={false} />
                </div>
                <ProvenanceTag kind="source" />
              </div>
              <p className="max-w-prose text-sm leading-relaxed text-foreground/90">
                Derived from the Acme discovery call and confirmed in the security questionnaire{" "}
                <CitationChip evidence={SAMPLE_EVIDENCE} />. A second source proposed 15 minutes,
                logged as a conflict for the client to resolve.
              </p>
            </CardContent>
            <CardFooter className="flex-col items-start gap-3 border-t [.border-t]:pt-6">
              <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Traceability
              </div>
              <TraceabilityChain nodes={TRACE_NODES} />
            </CardFooter>
          </Card>
        </Section>
      </div>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-10">
          <p className="text-sm text-foreground">AtlasHQ Design System — Cartographer</p>
          <p className="text-sm text-muted-foreground">
            Foundation: OKLCH tokens, light &amp; dark parity, core primitives, and the epistemic
            domain vocabulary. See <span className="font-mono text-xs">apps/web/DESIGN.md</span>.
          </p>
        </div>
      </footer>
    </main>
  );
}
