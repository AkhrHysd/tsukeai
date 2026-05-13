import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

async function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listWorkspacePackages(baseDir, layer) {
  const entries = await readdir(path.join(root, baseDir), { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const relativeDir = path.join(baseDir, entry.name);
    const manifest = await readJson(path.join(relativeDir, "package.json"));
    packages.push({
      layer,
      manifest,
      name: manifest.name,
      relativeDir,
    });
  }

  return packages;
}

async function collectSourceFiles(relativeDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await readdir(path.join(root, currentDir), { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== "dist") {
          await walk(relativePath);
        }
        continue;
      }

      if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        files.push(relativePath);
      }
    }
  }

  await walk(relativeDir);
  return files;
}

function collectWorkspaceDependencyNames(manifest) {
  const names = [];

  for (const field of dependencyFields) {
    for (const dependencyName of Object.keys(manifest[field] ?? {})) {
      names.push(dependencyName);
    }
  }

  return names;
}

async function main() {
  const workspacePackages = [
    ...(await listWorkspacePackages("apps", "app")),
    ...(await listWorkspacePackages("packages", "package")),
  ];
  const packageByName = new Map(
    workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
  );
  const errors = [];

  for (const workspacePackage of workspacePackages) {
    for (const dependencyName of collectWorkspaceDependencyNames(workspacePackage.manifest)) {
      const dependency = packageByName.get(dependencyName);

      if (!dependency) {
        continue;
      }

      if (workspacePackage.layer === "package" && dependency.layer === "app") {
        errors.push(`${workspacePackage.name} must not depend on app workspace ${dependency.name}`);
      }

      if (workspacePackage.layer === "app" && dependency.layer === "app") {
        errors.push(
          `${workspacePackage.name} must not depend on sibling app workspace ${dependency.name}`,
        );
      }
    }
  }

  const importPattern = new RegExp(
    [
      "\\b(?:import|export)\\s+(?:[^\"'`]+?\\s+from\\s+)?[\"']([^\"']+)[\"']",
      "import\\([\"']([^\"']+)[\"']\\)",
      "require\\([\"']([^\"']+)[\"']\\)",
    ].join("|"),
    "g",
  );

  for (const workspacePackage of workspacePackages) {
    const sourceFiles = await collectSourceFiles(workspacePackage.relativeDir);

    for (const sourceFile of sourceFiles) {
      const source = await readFile(path.join(root, sourceFile), "utf8");

      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? match[3];
        const workspaceDependency = packageByName.get(specifier);
        const resolvedRelativePath = specifier.startsWith(".")
          ? path.relative(root, path.resolve(root, path.dirname(sourceFile), specifier))
          : undefined;

        if (workspaceDependency?.layer === "app") {
          errors.push(`${sourceFile} must not import app workspace ${specifier}`);
        }

        if (workspacePackage.layer === "package" && resolvedRelativePath?.startsWith("apps/")) {
          errors.push(`${sourceFile} must not import from apps via ${specifier}`);
        }

        if (
          workspacePackage.layer === "app" &&
          resolvedRelativePath?.startsWith("apps/") &&
          !resolvedRelativePath.startsWith(`${workspacePackage.relativeDir}/`)
        ) {
          errors.push(`${sourceFile} must not import from sibling apps via ${specifier}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("Workspace dependency direction check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
}

await main();
