import { z } from "zod";

/**
 * Sign-in form schema. Accounts are provisioned by an organization administrator
 * (see `login-route.tsx`), so this intentionally validates credentials for an
 * existing account rather than a new-account password policy.
 */
export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").max(320, "Email is too long."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
