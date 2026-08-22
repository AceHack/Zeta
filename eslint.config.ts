// eslint.config.ts — Zeta's TypeScript lint configuration.
//
// Shape mirrors SQLSharp's (see `../SQLSharp/eslint.config.ts`) —
// strict-type-checked + stylistic-type-checked from typescript-eslint,
// plus eslint-plugin-sonarjs recommended, plus `@eslint/js` recommended.
// Same rule-strictness; different scaffolding (SQLSharp pulls rules
// from a `tools/automation/format/repo-file-globs.ts` helper module
// that Zeta does not yet have — when Zeta grows a parallel automation
// library, this file can refactor to consume it).
//
// Rationale for adopting this strictness on day one rather than
// easing in incrementally: the whole reason for picking bun+TypeScript
// over bash in the post-setup scripting ADR was *static types on
// automation code*. Running with loose lint settings would neutralize
// that argument. Crank it up from day one.
//
// Decision provenance:
//   docs/DECISIONS/2026-04-20-tools-scripting-language.md

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const typeCheckedProject = path.join(repoRoot, "tsconfig.json");
const typeScriptFilePatterns = ["**/*.ts"];

const nodeGlobals = {
  ...globals.node,
  ...globals.nodeBuiltin,
};

const sonarjsRecommended = sonarjs.configs?.recommended;
if (!sonarjsRecommended || Array.isArray(sonarjsRecommended)) {
  throw new Error("eslint-plugin-sonarjs did not expose the expected flat recommended config.");
}

const sonarjsConfig = {
  plugins: { sonarjs },
  rules: sonarjsRecommended.rules ?? {},
  ...(sonarjsRecommended.settings ? { settings: sonarjsRecommended.settings } : {}),
};

const typeCheckedConfigOverrides = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({
  ...config,
  files: typeScriptFilePatterns,
}));

const disableTypeCheckedConfig = {
  ...tseslint.configs.disableTypeChecked,
  files: ["eslint.config.ts"],
};

// Excludes — must cover every heavy directory in the Zeta tree or
// eslint's glob walk becomes minutes per invocation. Doubled patterns
// (root-level + `**/...`) catch nested occurrences (e.g. a transient
// `tools/foo/node_modules` created by a script). Inherited shape from
// SQLSharp `tools/automation/format/repo-file-globs.ts`
// (`defaultRepoPathIgnorePatterns`) with Zeta-specific additions for
// the Lake build store (`tools/lean4/.lake`, ~7 GB) and solver JAR
// stores (`tools/alloy`, `tools/tla`).
const ignorePatterns = [
  "node_modules/**",
  "**/node_modules/**",
  ".git/**",
  "bin/**",
  "obj/**",
  "**/bin/**",
  "**/obj/**",
  "BenchmarkDotNet.Artifacts/**",
  "**/BenchmarkDotNet.Artifacts/**",
  "TestResults/**",
  "**/TestResults/**",
  "artifacts/**",
  "**/artifacts/**",
  "references/prior-art/**",
  ".lake/**",
  "**/.lake/**",
  "tools/lean4/.lake/**",
  "tools/alloy/**",
  "tools/tla/**",
];

export default defineConfig(
  { ignores: ignorePatterns },
  js.configs.recommended,
  sonarjsConfig,
  {
    files: typeScriptFilePatterns,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-console": "off",
    },
  },
  ...typeCheckedConfigOverrides,
  {
    files: typeScriptFilePatterns,
    languageOptions: {
      parserOptions: {
        project: [typeCheckedProject],
        tsconfigRootDir: repoRoot,
      },
    },
  },
  disableTypeCheckedConfig,
);
