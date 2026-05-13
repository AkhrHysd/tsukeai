import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const HYPERDRIVE_BINDING = "HYPERDRIVE";

function usage() {
  return [
    "Usage:",
    "  HYPERDRIVE_ID=... pnpm --filter @tsukeai/api run cf:deploy",
    "  HYPERDRIVE_ID=... LOCAL_DATABASE_URL=postgres://... pnpm --filter @tsukeai/api dev",
    "",
    "Environment:",
    "- HYPERDRIVE_ID is the Cloudflare Hyperdrive resource id (UUID or 32-hex).",
    "- LOCAL_DATABASE_URL is required only for dev and is used as Hyperdrive's",
    "  localConnectionString.",
    "",
    "This script keeps apps/api/wrangler.toml free of Neon secrets and",
    "Cloudflare resource IDs by generating a temporary Wrangler config.",
  ].join("\n");
}

function assertHyperdriveId(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hex32 = /^[0-9a-f]{32}$/i;
  return uuid.test(trimmed) || hex32.test(trimmed) ? trimmed : undefined;
}

function assertPostgresUrl(value) {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function tomlString(value) {
  return JSON.stringify(value);
}

function buildHyperdriveBlock({ hyperdriveId, localDatabaseUrl }) {
  const lines = [
    "",
    "[[hyperdrive]]",
    `binding = ${tomlString(HYPERDRIVE_BINDING)}`,
    `id = ${tomlString(hyperdriveId)}`,
  ];

  if (localDatabaseUrl) {
    lines.push(`localConnectionString = ${tomlString(localDatabaseUrl)}`);
  }

  return `${lines.join("\n")}\n`;
}

async function writeTempConfig({ apiDir, hyperdriveId, localDatabaseUrl }) {
  const wranglerTomlPath = path.join(apiDir, "wrangler.toml");
  const wranglerToml = await readFile(wranglerTomlPath, "utf8");

  if (/\[\[hyperdrive\]\]/.test(wranglerToml)) {
    throw new Error("Committed wrangler.toml must not include a [[hyperdrive]] block.");
  }

  const tmpConfigPath = path.join(apiDir, `wrangler.hyperdrive.${randomUUID()}.toml`);
  const tmpConfig = `${wranglerToml.trimEnd()}\n${buildHyperdriveBlock({
    hyperdriveId,
    localDatabaseUrl,
  })}`;

  await writeFile(tmpConfigPath, tmpConfig, "utf8");
  return tmpConfigPath;
}

async function runWrangler({ apiDir, mode, tmpConfigPath }) {
  const wranglerArgs =
    mode === "dev" ? ["dev", "--config", tmpConfigPath] : ["deploy", "--config", tmpConfigPath];
  const child = spawn("pnpm", ["exec", "wrangler", ...wranglerArgs], {
    cwd: apiDir,
    stdio: "inherit",
  });

  return new Promise((resolve) => {
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const mode = process.argv[2];
  if (mode === "--help" || mode === "-h") {
    console.log(usage());
    return;
  }

  if (mode !== "dev" && mode !== "deploy") {
    console.error("Expected mode to be dev or deploy.\n");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const hyperdriveId = assertHyperdriveId(process.env.HYPERDRIVE_ID);
  if (!hyperdriveId) {
    console.error("HYPERDRIVE_ID is required (UUID or 32-hex Cloudflare Hyperdrive ID).\n");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const localDatabaseUrl = assertPostgresUrl(process.env.LOCAL_DATABASE_URL);
  if (mode === "dev" && !localDatabaseUrl) {
    console.error(
      "LOCAL_DATABASE_URL is required for dev and must be a postgres:// or postgresql:// URL.\n",
    );
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const apiDir = path.resolve(import.meta.dirname, "..");
  const tmpConfigPath = await writeTempConfig({
    apiDir,
    hyperdriveId,
    localDatabaseUrl: mode === "dev" ? localDatabaseUrl : undefined,
  });

  try {
    process.exitCode = await runWrangler({ apiDir, mode, tmpConfigPath });
  } finally {
    await rm(tmpConfigPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
