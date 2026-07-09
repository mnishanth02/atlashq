export const uiPrimitiveClassNames = {
  surface: "rounded-3xl border border-border bg-card shadow-sm",
  mutedSurface: "rounded-2xl border border-border bg-muted",
  button: "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium",
} as const;

export type ButtonTone = "neutral" | "primary";

export function createButtonClassName(tone: ButtonTone = "neutral") {
  const toneClassName =
    tone === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground";

  return `${uiPrimitiveClassNames.button} ${toneClassName}`;
}

export function surfaceClassName(extraClassName?: string) {
  return [uiPrimitiveClassNames.surface, extraClassName].filter(Boolean).join(" ");
}
