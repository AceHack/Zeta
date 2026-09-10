/**
 * lint-no-committed-build-intermediates
 *
 * Falsifier for one clause of `.claude/rules/no-binary-in-proof-lineage.md`:
 *
 *   "Not covered by this exception ... build intermediates (`.o`, `.a`, `.bc`,
 *    `.rcgu.o`), binaries nothing executes, binaries with no committed source"
 *
 * The rule already has an enforcer, `audit-proof-lineage-binaries.ts`, but its
 * scope is `src/wasm-dla/bytelock/` -- it derives the exempt set from the
 * byte-lock runner's own roster, which is exactly right for the "artifact under
 * test" exception and says nothing about the rest of the tree.
 *
 * That gap was not theoretical. `src/Core.Alloy/classes/AlloyRunner.class` --
 * compiled output of a committed `.java`, and named "Regenerated; not source"
 * by the repo's own `.gitignore` -- was tracked, because the ignore rule said
 * `tools/alloy/classes/` and the directory had moved to
 * `src/Core.Alloy/classes/`. Scorecard saw it (BinaryArtifactsID alert 244);
 * no in-repo check did.
 *
 * The hazard is sharper than untidiness. `tests/Tests.FSharp/Formal/
 * Alloy.Runner.Tests.fs` skips `javac` when the `.class` is NEWER than the
 * `.java`, so a committed intermediate silently outranks the source it claims
 * to be built from -- a checked-in binary deciding what the formal-methods
 * harness actually runs.
 *
 * There is deliberately NO allowlist. An exception with a hand-maintained list
 * drifts from the thing it describes, which is the failure the rule names; a
 * genuine new case is a reviewed diff to this file and to the rule, not a line
 * appended at 2am.
 *
 * Scope note, stated so it is not mistaken for more than it is: this checks
 * EXTENSIONS on tracked paths. It cannot see a build intermediate that carries
 * no telltale suffix, and it makes no claim to.
 */

import { trackedFiles } from "../git/tracked-files.ts";

const INTERMEDIATE_SUFFIXES: readonly string[] = Object.freeze([
  ".class", // JVM bytecode -- compiled from .java
  ".o", // object file (covers .rcgu.o, which is a rustc intermediate)
  ".obj", // MSVC object file
  ".a", // static archive
  ".bc", // LLVM bitcode
  ".pyc", // CPython bytecode
  ".pdb", // MSVC debug symbols
]);

export interface Offender {
  readonly path: string;
  readonly suffix: string;
}

/**
 * Pure classifier -- the unit the tests exercise, so the falsifier does not
 * need a git tree to be meaningful.
 */
export function findIntermediates(paths: readonly string[]): Offender[] {
  const out: Offender[] = [];
  for (const p of paths) {
    const suffix = INTERMEDIATE_SUFFIXES.find((s) => p.endsWith(s));
    if (suffix !== undefined) out.push({ path: p, suffix });
  }
  return out;
}

if (import.meta.main) {
  const root = process.argv[2] ?? ".";
  const paths = trackedFiles(root);
  const offenders = findIntermediates(paths);
  if (offenders.length !== 0) {
    const n = offenders.length;
    const head = "lint-no-committed-build-intermediates: " + n + " tracked build intermediate(s).";
    console.error(head);
    console.error("A build intermediate is not the artifact under test and is not evidence.");
    console.error("It is output that can outrank its own source. Build it, ignore it, never commit it.");
    console.error("Rule: .claude/rules/no-binary-in-proof-lineage.md");
    console.error("");
    const listed = offenders.map((o) => o.path + "  -- " + o.suffix).join("\n");
    console.error(listed);
    process.exit(1);
  }

  const watched = INTERMEDIATE_SUFFIXES.length;
  const ok =
    "lint-no-committed-build-intermediates: OK -- " +
    paths.length +
    " tracked file(s), 0 build intermediate(s) across " +
    watched +
    " watched suffix(es).";
  console.log(ok);
}
