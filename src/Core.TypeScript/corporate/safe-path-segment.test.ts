// src/Core.TypeScript/corporate/safe-path-segment.test.ts
//
// THE PREDICATE, AND THE ONE COPY OF IT THAT LIVES IN ANOTHER RUNTIME.
//
// `safe-path-segment.ts` exists because the same guard was written twice —
// privately in `serve-work.ts`, then again in `uat-three-criteria.ts` — and the
// second author could not see the first. Its own docstring predicts a third
// site. The third site arrived as `tools/agent.cjs`, which builds
// `join(OUT_DIR, workId, gate + ".md")` out of two argv values, and which
// CANNOT import this module: it is CommonJS run by `node`, and this is
// TypeScript. So the pattern is restated there, and this file is what stops a
// restatement from becoming a divergence — a copy nothing compares is exactly
// how the second copy got written.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { isSafePathSegment } from "./safe-path-segment.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const AGENT_CJS = join(REPO_ROOT, "tools", "agent.cjs");

/** Every `/^…$/u` regex literal in a source file, as written. */
function regexLiterals(source: string): readonly string[] {
  return source.match(/\/\^[^\n]*?\$\/u/g) ?? [];
}

describe("isSafePathSegment", () => {
  test("accepts the shapes the organization actually mints", () => {
    for (const ok of ["081M28K03G0087G0R00026PN5K", "brd_approval", "AIAGENT-1590", "a", "a.b-c_d"]) {
      expect(isSafePathSegment(ok)).toBe(true);
    }
  });

  test("refuses every traversal, separator and dot-prefixed form", () => {
    for (const bad of ["..", ".", ".git", "../escape", "a/b", "a\\b", "", " a", "a b", `a\u0000b`, "/etc/passwd"]) {
      expect(isSafePathSegment(bad)).toBe(false);
    }
  });

  test("refuses a segment longer than 100 characters", () => {
    expect(isSafePathSegment("a".repeat(100))).toBe(true);
    expect(isSafePathSegment("a".repeat(101))).toBe(false);
  });
});

describe("the tools/agent.cjs copy does not drift from this module", () => {
  test("both files state exactly one pattern, and it is the same pattern", () => {
    const here = regexLiterals(readFileSync(join(import.meta.dir, "safe-path-segment.ts"), "utf-8"));
    const there = regexLiterals(readFileSync(AGENT_CJS, "utf-8"));
    // Exactly one each, so this comparison cannot be satisfied by the wrong
    // literal in a file that happens to contain several.
    expect(here).toHaveLength(1);
    expect(there).toHaveLength(1);
    expect(there[0]).toBe(here[0] as string);
  });
});

describe("tools/agent.cjs refuses argv that would escape ORG_DOCS_DIR", () => {
  // A model is never reached: the guard runs at argv-parse time, and the host
  // below is a port nothing listens on, so an UNGUARDED build gets as far as
  // the fetch and exits 4 ("could not reach"). That difference — 2 with the
  // guard, 4 without it — is what this test measures. Verified by reverting
  // the guard and watching these three cases go red.
  function run(
    gate: string,
    workId: string,
    ...refs: readonly string[]
  ): { readonly status: number | null; readonly stderr: string } {
    const dir = mkdtempSync(join(tmpdir(), "agent-cjs-argv-"));
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- "node" is a trusted PATH runtime lookup (declared in the toolchain manifest); argv is a fixed script path plus the two literals under test.
      const r = spawnSync("node", [AGENT_CJS, gate, workId, ...refs], {
        cwd: dir,
        encoding: "utf-8",
        timeout: 30_000,
        env: {
          ...process.env,
          // Nothing listens on port 1, so the unguarded path fails fast and
          // offline rather than talking to a model somebody has running.
          OLLAMA_HOST: "http://127.0.0.1:1",
          ORG_WORKDIR: dir,
          ORG_DOCS_DIR: join(dir, "docs"),
        },
      });
      // Nothing may appear outside the documents directory, whichever way the
      // run ended.
      expect(existsSync(join(dir, "escaped"))).toBe(false);
      return { status: r.status, stderr: r.stderr ?? "" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("a traversing workId is refused, and named in the refusal", () => {
    const r = run("brd_approval", "../escaped");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("workId is not a single safe path segment");
  });

  test("a traversing gate is refused, and named in the refusal", () => {
    const r = run("../escaped", "081M28K03G0087G0R00026PN5K");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("gate is not a single safe path segment");
  });

  test("a well-formed pair is NOT refused — it reaches the model step and fails there", () => {
    // The control. A guard that refused everything would pass the two tests
    // above and fail this one, which is the only thing separating a check
    // from a check that cannot succeed.
    const r = run("brd_approval", "081M28K03G0087G0R00026PN5K");
    expect(r.stderr).not.toContain("not a single safe path segment");
    expect(r.status).toBe(4);
    expect(r.stderr).toContain("could not reach");
  });

  test("a context document that will not open is SAID, not silently omitted", () => {
    // The other half of the `existsSync`-removal: the reads are now performed
    // and their ENOENT interpreted, and an unreadable context path leaves a
    // line on stderr. It used to be dropped in silence on the reasoning that
    // the absence spoke for itself — but the only surface carrying it was a
    // `relied on <ref>` line that never appeared, which a step handed nothing
    // is indistinguishable from.
    const r = run("brd_approval", "081M28K03G0087G0R00026PN5K", "no-such-context-document.md");
    expect(r.stderr).toContain("context not readable");
    expect(r.stderr).toContain("no-such-context-document.md");
  });
});
