import { Module } from "@nestjs/common";
import { AuditWriter } from "./audit-writer.js";

/**
 * Reusable audit module. `AuditWriter` is stateless — it takes the caller's active Drizzle
 * transaction directly rather than holding a database connection — so this module has no runtime
 * dependency of its own and can be imported by any feature module that needs to append audit
 * events inside its own `db.transaction()` block.
 */
@Module({
  providers: [AuditWriter],
  exports: [AuditWriter],
})
export class AuditModule {}
