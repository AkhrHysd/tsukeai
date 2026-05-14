import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationsDir = path.resolve(import.meta.dirname, "../migrations");
const migrationsTableSql = `
  create table if not exists schema_migrations (
    version text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )
`;

function usage() {
  return [
    "Usage: DATABASE_URL=postgres://... pnpm --filter @tsukeai/api migrate:up",
    "",
    "Options:",
    "  --dry-run   List pending migrations without connecting to the database.",
    "  --to NAME   Apply migrations up to and including NAME.",
  ].join("\n");
}

function toSafeLogError(error) {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }

  return {
    name: error.name,
    ...(typeof error.code === "string" ? { code: error.code } : {}),
  };
}

async function loadMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      return {
        version: file.replace(/\.sql$/, ""),
        file,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    help: false,
    to: undefined,
  };

  const args = argv.filter((arg) => arg !== "--");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--to") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("--to requires a migration name.");
      }

      options.to = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function selectMigrations(migrations, to) {
  if (!to) {
    return migrations;
  }

  const targetIndex = migrations.findIndex((migration) => migration.version === to);

  if (targetIndex === -1) {
    throw new Error(`Migration not found: ${to}`);
  }

  return migrations.slice(0, targetIndex + 1);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const migrations = selectMigrations(await loadMigrations(), options.to);

  if (options.dryRun) {
    for (const migration of migrations) {
      console.log(`${migration.version} ${migration.checksum}`);
    }
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.\n");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const { default: postgres } = await import("postgres");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    await sql.unsafe(migrationsTableSql);

    const appliedRows = await sql`
      select version, checksum
      from schema_migrations
      order by version asc
    `;
    const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));

    for (const migration of migrations) {
      const existingChecksum = applied.get(migration.version);

      if (existingChecksum === migration.checksum) {
        console.log(`skip ${migration.version}`);
        continue;
      }

      if (existingChecksum) {
        throw new Error(
          `Checksum mismatch for ${migration.version}; refusing to reapply an edited migration.`,
        );
      }

      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration.sql);
        await transaction`
          insert into schema_migrations (version, checksum)
          values (${migration.version}, ${migration.checksum})
        `;
      });

      console.log(`apply ${migration.version}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(toSafeLogError(error));
  process.exitCode = 1;
});
