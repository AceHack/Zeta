import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PackageBoundaryRule = {
  Application: "application",
  ApplicationHost: "application_host",
  Messaging: "messaging",
  Packages: "packages",
  ProductionSource: "production_source",
  Runtime: "runtime",
  StateAdapter: "state_adapter",
  Workers: "workers",
} as const;

export type PackageBoundaryRule = (typeof PackageBoundaryRule)[keyof typeof PackageBoundaryRule];

export type PackageDependencyBoundaryRule = {
  packageName: PackageBoundaryRule;
  sourceGlob: string;
  forbiddenImportFragments: readonly string[];
};

export type PackageDependencyBoundaryViolation = {
  packageName: PackageBoundaryRule;
  filePath: string;
  importFragment: string;
  message: string;
};

export const PackageSourceLayoutViolationReason = {
  TestFileInProductionSource: "test_file_in_production_source",
} as const;

export type PackageSourceLayoutViolationReason =
  (typeof PackageSourceLayoutViolationReason)[keyof typeof PackageSourceLayoutViolationReason];

export type PackageSourceLayoutRule = {
  packageName: PackageBoundaryRule;
  sourceGlob: string;
  forbiddenFileSuffix: string;
  reason: PackageSourceLayoutViolationReason;
};

export type PackageSourceLayoutViolation = {
  packageName: PackageBoundaryRule;
  filePath: string;
  reason: PackageSourceLayoutViolationReason;
  message: string;
};

export type ValidatePackageDependencyBoundariesInput = {
  rootDirectory: URL;
  rules: readonly PackageDependencyBoundaryRule[];
};

export type ValidatePackageSourceLayoutInput = {
  rootDirectory: URL;
  rules: readonly PackageSourceLayoutRule[];
};

const TypeScriptSourceExtension = ".ts";
const TestSourceExtension = ".test.ts";
const RecursiveTypeScriptGlobSuffix = "/**/*.ts";

export async function validatePackageDependencyBoundaries(
  input: ValidatePackageDependencyBoundariesInput,
): Promise<PackageDependencyBoundaryViolation[]> {
  const rootDirectoryPath = fileURLToPath(input.rootDirectory);
  const violations: PackageDependencyBoundaryViolation[] = [];

  for (const rule of input.rules) {
    const sourceFiles = await findSourceFiles(rootDirectoryPath, rule.sourceGlob);

    for (const sourceFile of sourceFiles) {
      const sourceText = await readFile(sourceFile, "utf8");
      const importSpecifiers = extractImportSpecifiers(sourceText);

      for (const importSpecifier of importSpecifiers) {
        for (const forbiddenImportFragment of rule.forbiddenImportFragments) {
          if (importSpecifier.includes(forbiddenImportFragment)) {
            violations.push({
              packageName: rule.packageName,
              filePath: normalizePath(relative(rootDirectoryPath, sourceFile)),
              importFragment: importSpecifier,
              message: `${rule.packageName} may not import ${importSpecifier} from ${normalizePath(
                relative(rootDirectoryPath, sourceFile),
              )}`,
            });
          }
        }
      }
    }
  }

  return violations;
}

export async function validatePackageSourceLayout(
  input: ValidatePackageSourceLayoutInput,
): Promise<PackageSourceLayoutViolation[]> {
  const rootDirectoryPath = fileURLToPath(input.rootDirectory);
  const violations: PackageSourceLayoutViolation[] = [];

  for (const rule of input.rules) {
    const sourceFiles = await findFiles(rootDirectoryPath, rule.sourceGlob);

    for (const sourceFile of sourceFiles) {
      if (!sourceFile.endsWith(rule.forbiddenFileSuffix)) {
        continue;
      }

      violations.push({
        packageName: rule.packageName,
        filePath: normalizePath(relative(rootDirectoryPath, sourceFile)),
        reason: rule.reason,
        message: `${rule.packageName} has forbidden source-layout file ${normalizePath(
          relative(rootDirectoryPath, sourceFile),
        )}`,
      });
    }
  }

  return violations;
}

async function findSourceFiles(rootDirectoryPath: string, sourceGlob: string): Promise<string[]> {
  const sourceFiles = await findFiles(rootDirectoryPath, sourceGlob);
  return sourceFiles.filter((sourceFile) => !sourceFile.endsWith(TestSourceExtension));
}

async function findFiles(rootDirectoryPath: string, sourceGlob: string): Promise<string[]> {
  if (!sourceGlob.endsWith(RecursiveTypeScriptGlobSuffix)) {
    throw new Error(`unsupported source glob: ${sourceGlob}`);
  }

  const sourceRoot = join(rootDirectoryPath, sourceGlob.slice(0, -RecursiveTypeScriptGlobSuffix.length));
  return collectTypeScriptSourceFiles(sourceRoot);
}

async function collectTypeScriptSourceFiles(directoryPath: string): Promise<string[]> {
  const directoryEntries = await readdir(directoryPath, {
    withFileTypes: true,
  });
  const sourceFiles: string[] = [];

  for (const directoryEntry of directoryEntries) {
    const entryPath = join(directoryPath, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      sourceFiles.push(...(await collectTypeScriptSourceFiles(entryPath)));
      continue;
    }

    if (directoryEntry.isFile() && entryPath.endsWith(TypeScriptSourceExtension)) {
      sourceFiles.push(entryPath);
    }
  }

  return sourceFiles;
}

function extractImportSpecifiers(sourceText: string): string[] {
  const importSpecifiers: string[] = [];
  const importExpression = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  let match = importExpression.exec(sourceText);

  while (match !== null) {
    const importSpecifier = match[1];

    if (importSpecifier !== undefined) {
      importSpecifiers.push(importSpecifier);
    }

    match = importExpression.exec(sourceText);
  }

  return importSpecifiers;
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
