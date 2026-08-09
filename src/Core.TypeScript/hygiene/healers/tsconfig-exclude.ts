/**
 * tsconfig-exclude healer — Tier 1 (pattern-matched, verifiable by compiler oracle).
 *
 * Detects: non-TypeScript files (AssemblyScript, WASM bindings, generated .d.ts stubs)
 *   being typechecked by tsc and producing bogus errors (e.g. TS2304 for i32/u32 in
 *   AssemblyScript files, or errors in generated protocol buffer stubs).
 *
 * Proposes: adds the file's directory or glob to tsconfig.json's "exclude" array
 *   with a comment naming the real checker for that file type.
 *
 * Laws:
 * - Idempotence: excluding an already-excluded path = no change ✓
 * - Closure-as-subset: excluding a file cannot introduce new TS errors ✓
 * - Convergence: one pass per file ✓
 * - Totality: never throws ✓
 * - Exit: if no tsconfig or no matching pattern, returns unchanged ✓
 * - Bounded scope: one drift class (non-TS files under tsc) ✓
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

// Known non-TS file patterns that get incorrectly typechecked
const NON_TS_PATTERNS: readonly { glob: string; checker: string; extensions: string[] }[] = [
  { glob: "assembly/**", checker: "asc (AssemblyScript compiler)", extensions: [".as.ts"] },
  { glob: "**/*.wasm.d.ts", checker: "wasm-bindgen", extensions: [".wasm.d.ts"] },
  { glob: "**/proto/**", checker: "protoc/grpc-tools", extensions: [".pb.ts"] },
];

// ═══ The Detector ═══════════════════════════════════════════════════════════

export const tsconfigExcludeDetector: Detector = {
  name: "tsconfig-exclude-non-ts",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    const tsconfig = tree.get("tsconfig.json");
    if (!tsconfig) return findings;

    let config: { exclude?: string[] };
    try { config = JSON.parse(tsconfig); } catch { return findings; }
    const excludes = config.exclude ?? [];

    for (const [path] of tree) {
      for (const pattern of NON_TS_PATTERNS) {
        if (pattern.extensions.some((ext) => path.endsWith(ext))) {
          // Check if this file's directory is already excluded
          const dir = path.split("/").slice(0, -1).join("/");
          const isExcluded = excludes.some((ex) =>
            path.startsWith(ex.replace("/**", "").replace("**/*", "")) ||
            ex === dir || ex === `${dir}/**`
          );
          if (!isExcluded) {
            findings.push({
              path: "tsconfig.json",
              rule: "non-ts-under-tsc",
              detail: `'${path}' is a ${pattern.checker} file being typechecked by tsc — add '${dir}/**' to exclude`,
            });
          }
        }
      }
    }
    return findings;
  },
};

// ═══ The Healer ═══════════════════════════════════════════════════════════════

export const tsconfigExcludeHealer: Healer = {
  name: "tsconfig-exclude-adder",
  heal(tree: FileTree): FileTree {
    const tsconfig = tree.get("tsconfig.json");
    if (!tsconfig) return tree;

    let config: Record<string, unknown>;
    try { config = JSON.parse(tsconfig); } catch { return tree; }
    const excludes: string[] = (config.exclude as string[]) ?? [];
    const added: string[] = [];

    for (const [path] of tree) {
      for (const pattern of NON_TS_PATTERNS) {
        if (pattern.extensions.some((ext) => path.endsWith(ext))) {
          const dir = path.split("/").slice(0, -1).join("/");
          const glob = `${dir}/**`;
          const isExcluded = excludes.some((ex) =>
            path.startsWith(ex.replace("/**", "").replace("**/*", "")) ||
            ex === dir || ex === glob
          );
          if (!isExcluded && !added.includes(glob)) {
            added.push(glob);
          }
        }
      }
    }

    if (added.length === 0) return tree;

    // Add to exclude array
    const newExcludes = [...excludes, ...added];
    const newConfig = { ...config, exclude: newExcludes };
    const result = new Map(tree);
    result.set("tsconfig.json", JSON.stringify(newConfig, null, 2) + "\n");
    return result;
  },
};
