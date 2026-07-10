import "reflect-metadata";
import { createAuth } from "@atlashq/auth";
import { loadApiEnv } from "@atlashq/config";
import { createDatabaseClient } from "@atlashq/db";
import { createApiApp } from "./app.factory.js";

async function bootstrap() {
  const env = loadApiEnv(process.env);

  // Lazily create the database client and Better Auth instance from validated
  // env. Nothing here runs at module import time, so offline tooling is safe.
  const databaseClient = createDatabaseClient({ connectionString: env.DATABASE_URL });
  const auth = createAuth({ db: databaseClient.db, env });

  // Build the app through the shared factory so production and the integration
  // tests exercise the exact same middleware/body-parser/auth/prefix/filter stack.
  const app = await createApiApp({ auth, db: databaseClient.db, webOrigin: env.WEB_ORIGIN });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.flushLogs();

    try {
      await app.close();
      await databaseClient.close();
    } finally {
      process.removeListener("SIGTERM", onSignal);
      process.removeListener("SIGINT", onSignal);
      process.kill(process.pid, signal);
    }
  };

  const onSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal);
  };

  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  await app.listen(env.PORT);
}

void bootstrap();
