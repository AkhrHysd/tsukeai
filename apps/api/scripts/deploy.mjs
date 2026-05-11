import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

function usage() {
  return [
    "Usage:",
    "  HYPERDRIVE_ID=... pnpm --filter @tsukeai/api run cf:deploy",
    "",
    "Notes:",
    "- HYPERDRIVE_ID is the Cloudflare Hyperdrive resource id (UUID or 32-hex).",
    "- This script keeps apps/api/wrangler.toml committed with a placeholder id,",
    "  and generates a temporary wrangler config for deploy only.",
  ].join("\n");
}

function assertHyperdriveId(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hex32 = /^[0-9a-f]{32}$/i;
  return uuid.test(trimmed) || hex32.test(trimmed) ? trimmed : undefined;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    console.log(usage());
    return;
  }

  const rawHyperdriveId = process.env.HYPERDRIVE_ID;
  const hyperdriveId = assertHyperdriveId(rawHyperdriveId);
  if (!hyperdriveId) {
    console.error("HYPERDRIVE_ID is required (UUID or 32-hex Cloudflare Hyperdrive ID).\n");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const apiDir = path.resolve(import.meta.dirname, "..");
  const wranglerTomlPath = path.join(apiDir, "wrangler.toml");
  const wranglerToml = await readFile(wranglerTomlPath, "utf8");

  if (!wranglerToml.includes("<hyperdrive-id>")) {
    console.error('Expected wrangler.toml to include "<hyperdrive-id>" placeholder.');
    process.exitCode = 1;
    return;
  }

  // Create the temporary config in the same directory as wrangler.toml so
  // relative paths like main = "src/index.ts" keep working. Wrangler resolves
  // relative paths from the config file location.
  const tmpConfigPath = path.join(apiDir, `wrangler.hyperdrive.${randomUUID()}.toml`);
  const tmpConfig = wranglerToml.replaceAll("<hyperdrive-id>", hyperdriveId);
  await writeFile(tmpConfigPath, tmpConfig, "utf8");

  const child = spawn(
    "pnpm",
    ["exec", "wrangler", "deploy", "--config", tmpConfigPath],
    { cwd: apiDir, stdio: "inherit" },
  );

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });

  await rm(tmpConfigPath, { force: true });
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

