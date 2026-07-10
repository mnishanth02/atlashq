import { zodResolver } from "@hookform/resolvers/zod";
import { getRouteApi, redirect } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getSession, signIn } from "@/lib/auth-client";
import { sanitizeRedirectTarget } from "@/lib/auth-redirect";
import { queryClient } from "@/state/query-client";
import { evaluateLoginGuard } from "../auth/session-guard";
import { type LoginFormValues, loginSchema } from "./login-schema";

/** `/login`'s search params: an optional post-login redirect target, sanitized before use. */
export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

const routeApi = getRouteApi("/login");

/**
 * Redirects an already-authenticated visitor straight to their intended
 * destination instead of showing the sign-in form again.
 */
export async function loginBeforeLoad({ search }: { search: { redirect?: string | undefined } }) {
  const { data } = await getSession();
  const outcome = evaluateLoginGuard(!!data, search.redirect);

  if (outcome.kind === "redirect-to-target") {
    throw redirect({ href: outcome.href });
  }
}

/**
 * Public sign-in screen. Accounts are provisioned by an organization
 * administrator, so there is intentionally no sign-up affordance here.
 * Invalid-credentials errors are shown generically (not "no such email" /
 * "wrong password") to avoid leaking account existence.
 */
export function LoginRoute() {
  const { redirect: redirectParam } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { error } = await signIn.email({ email: values.email, password: values.password });

      if (error) {
        setFormError("Invalid email or password. Please try again.");
        return;
      }

      queryClient.clear();
      await navigate({ href: sanitizeRedirectTarget(redirectParam), replace: true });
    } catch {
      setFormError("Sign-in is temporarily unavailable. Please try again.");
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to AtlasHQ</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Accounts are provisioned by your organization administrator.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {formError ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={!!form.formState.errors.email || undefined}>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                disabled={isSubmitting}
                {...form.register("email")}
              />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            <Field data-invalid={!!form.formState.errors.password || undefined}>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                disabled={isSubmitting}
                {...form.register("password")}
              />
              <FieldError errors={[form.formState.errors.password]} />
            </Field>

            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                Sign in
              </Button>
              <FieldDescription>
                No sign-up here — ask your administrator for access.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
