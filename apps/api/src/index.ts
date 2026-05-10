import { Hono } from "hono";
import { cors } from "hono/cors";
import postgres from "postgres";

type Bindings = {
  API_ALLOWED_ORIGINS?: string;
  HYPERDRIVE: Hyperdrive;
};

type HealthResponse = {
  status: "ok";
  service: "api";
};

type DatabaseHealthRow = {
  ok: number;
  database: string;
  server_version: string;
};

type DatabaseHealthResponse = {
  status: "ok";
  database: string;
  serverVersion: string;
};

const LOCAL_WEB_ORIGIN = "http://localhost:3000";
const ALLOWED_METHODS = ["GET", "POST", "DELETE", "OPTIONS"];
const ALLOWED_HEADERS = ["Content-Type", "Authorization"];
const HEALTH_RESPONSE: HealthResponse = {
  status: "ok",
  service: "api",
};

const app = new Hono<{ Bindings: Bindings }>();

function createSql(connectionString: string) {
  return postgres(connectionString, {
    max: 1,
    fetch_types: false,
    prepare: false,
  });
}

function allowedOrigins(value: string | undefined): string[] {
  const origins =
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? [];

  return origins.length > 0 ? origins : [LOCAL_WEB_ORIGIN];
}

app.use("*", async (c, next) => {
  const middleware = cors({
    origin: allowedOrigins(c.env.API_ALLOWED_ORIGINS),
    credentials: true,
    allowHeaders: ALLOWED_HEADERS,
    allowMethods: ALLOWED_METHODS,
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86_400,
  });

  return middleware(c, next);
});

app.get("/health", (c) => {
  return c.json(HEALTH_RESPONSE);
});

app.get("/api/health", (c) => {
  return c.json(HEALTH_RESPONSE);
});

app.get("/api/db/health", async (c) => {
  let sql: ReturnType<typeof createSql> | undefined;

  try {
    sql = createSql(c.env.HYPERDRIVE.connectionString);
    const [row] = await sql<DatabaseHealthRow[]>`
      select
        1 as ok,
        current_database() as database,
        current_setting('server_version') as server_version
    `;

    if (row?.ok !== 1) {
      return c.json(
        {
          error: {
            code: "database_health_check_failed",
            message: "Database health check did not return the expected row.",
          },
        },
        503,
      );
    }

    const response: DatabaseHealthResponse = {
      status: "ok",
      database: row.database,
      serverVersion: row.server_version,
    };

    return c.json(response);
  } catch (error) {
    console.error("Database health check failed", error);

    return c.json(
      {
        error: {
          code: "database_unavailable",
          message: "Database health check failed.",
        },
      },
      503,
    );
  } finally {
    try {
      await sql?.end({ timeout: 5 });
    } catch (error) {
      console.error("Failed to close database health check client", error);
    }
  }
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "not_found",
        message: "Route not found.",
      },
    },
    404,
  ),
);

export default app;
