import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import postgres from "postgres";

type Bindings = {
  API_ALLOWED_ORIGINS?: string;
  HYPERDRIVE: Hyperdrive;
  SESSION_COOKIE_NAME?: string;
  SESSION_SECRET?: string;
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
const DEFAULT_SESSION_COOKIE_NAME = "__Host-tanka_session";
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

function isProtectedWrite(method: string, path: string): boolean {
  return (
    (method === "POST" || method === "DELETE") &&
    path.startsWith("/api/") &&
    !/^\/api\/(?:auth|sessions)(?:\/|$)/.test(path)
  );
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

async function verifySessionCookie(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!cookieValue || !secret) {
    return false;
  }

  const separatorIndex = cookieValue.indexOf(".");

  if (separatorIndex <= 0 || separatorIndex === cookieValue.length - 1) {
    return false;
  }

  const accountId = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSignature = toBase64Url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(accountId)),
  );

  return signaturesMatch(signature, expectedSignature);
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

app.use("*", async (c, next) => {
  if (!isProtectedWrite(c.req.method, c.req.path)) {
    return next();
  }

  const cookieName = c.env.SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME;
  const isAuthenticated = await verifySessionCookie(
    getCookie(c, cookieName),
    c.env.SESSION_SECRET,
  );

  if (isAuthenticated) {
    return next();
  }

  return c.json(
    {
      error: {
        code: "unauthorized",
        message: "Authentication is required for this write operation.",
      },
    },
    401,
  );
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
