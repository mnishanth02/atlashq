import { DEFAULT_API_BASE_URL, getHealthQueryKey } from "@atlashq/api-client";
import { surfaceClassName } from "@atlashq/ui";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

type IntakePreview = {
  id: string;
  name: string;
  status: "draft" | "ready";
};

type WorkspaceForm = {
  workspaceName: string;
};

const columnHelper = createColumnHelper<IntakePreview>();
const columns = [
  columnHelper.accessor("name", {
    header: "Workspace",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => info.getValue(),
  }),
];

const intakePreviews: IntakePreview[] = [
  { id: "doc-intake", name: "Document intake", status: "draft" },
  { id: "stakeholder-map", name: "Stakeholder map", status: "ready" },
];

export function IndexRoute() {
  const form = useForm<WorkspaceForm>({
    defaultValues: { workspaceName: "AtlasHQ project workspace" },
  });
  const table = useReactTable({
    data: intakePreviews,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const apiBaseUrlLabel = apiBaseUrl || "same-origin /api/v1";
  const apiHealthQueryKey = getHealthQueryKey().join(".");
  const formState = form.watch("workspaceName");

  const readinessSummary = useMemo(
    () => [
      "React + Vite SPA",
      "TanStack Router route tree",
      "TanStack Query client",
      "React Hook Form",
      "TanStack Table",
      "Tailwind CSS + shadcn/ui-compatible aliases",
    ],
    [],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <div className={surfaceClassName("rounded-[2rem] p-8")}>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            AtlasHQ Phase 2
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-2xl flex-col gap-4">
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
                Implementation workspace placeholder
              </h1>
              <p className="text-lg text-muted-foreground">
                The web shell is ready for Module 1 with shared API client and UI placeholders wired
                through workspace packages.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              API base: <span className="font-medium text-foreground">{apiBaseUrlLabel}</span>
              <br />
              Health query: <span className="font-medium text-foreground">{apiHealthQueryKey}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Form and table readiness</h2>
            <form className="mt-5 flex flex-col gap-3" aria-label="Workspace readiness form">
              <label className="text-sm font-medium" htmlFor="workspaceName">
                Workspace name
              </label>
              <input
                id="workspaceName"
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none ring-ring transition focus-visible:ring-2"
                {...form.register("workspaceName")}
              />
            </form>
            <p className="mt-3 text-sm text-muted-foreground">Previewing: {formState}</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th className="px-4 py-3 font-medium" key={header.id}>
                          {String(header.column.columnDef.header)}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="border-t border-border" key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td className="px-4 py-3" key={cell.id}>
                          {String(cell.getValue())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Phase 3 boundary</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              The shared API client placeholder is wired for future TanStack Query hooks.
            </p>
            <ul className="mt-5 flex flex-col gap-3">
              {readinessSummary.map((item) => (
                <li className="rounded-2xl bg-muted px-4 py-3 text-sm" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
