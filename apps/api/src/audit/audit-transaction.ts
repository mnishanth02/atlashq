import type { Database } from "@atlashq/db";

/**
 * The transaction object passed into `db.transaction(async (tx) => { ... })`. Derived
 * structurally from `Database["transaction"]` (rather than importing Drizzle's internal
 * `NodePgTransaction` type or casting) so the audit writer accepts exactly the transaction a
 * feature service already has in hand, with the same query-builder surface as `Database` itself.
 */
export type AuditTransaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer Transaction,
) => Promise<unknown>
  ? Transaction
  : never;
