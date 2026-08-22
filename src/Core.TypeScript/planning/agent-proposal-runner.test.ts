import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { normalizeUnifiedPatch } from "./agent-proposal-runner";

/**
 * THE EXACT PATCH GitHub delivered for proposal 60b7c599 at 12:28Z on 2026-08-17, decoded from
 * the run's `ZETA_AGENT_PATCH_B64` -- not a reconstruction. Its final line carries no newline,
 * which is the entire defect. Written as an explicit `join` so that no editor, formatter or
 * `.gitattributes` `text eol=lf` rule can quietly re-add the terminator this test exists to
 * remove: a source-literal ending `prohibited.` immediately before a closing backtick would be
 * one save away from becoming a terminated string, and the test would then pass while proving
 * nothing.
 */
const DELIVERED_PATCH = [
  "diff --git a/docs/automation/pages-operator-capability-verification.md b/docs/automation/pages-operator-capability-verification.md",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/docs/automation/pages-operator-capability-verification.md",
  "@@ -0,0 +1,7 @@",
  "+# Pages Operator Capability Verification",
  "+",
  "+This file records one bounded end-to-end Pages capability delivery test.",
  "+",
  "+- Immutable base: `87d76547b4dc8cb90431f1dfd1b70f51f851bf05`",
  "+- Delivery: local Pages capability → verifier → scoped Action → gated review branch.",
  "+- Direct writes to `main`: prohibited.",
].join("\n");

const roots: string[] = [];

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-agent-proposal-"));
  roots.push(root);
  const run = (...args: string[]): void => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  };
  run("init", "-q");
  return root;
}

/** `--check` only: asks whether git would accept the patch, without mutating the tree. */
function applies(root: string, patch: string): boolean {
  const path = join(root, "candidate.patch");
  writeFileSync(path, patch, "utf8");
  return spawnSync("git", ["apply", "--check", "--whitespace=error", path], { cwd: root }).status === 0;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("normalizeUnifiedPatch", () => {
  // THE LOAD-BEARING TEST. The three string assertions below would all pass against a
  // `normalize` that did nothing but `endsWith`/concatenate -- they describe the transformation,
  // not the reason for it. This one asks the actual authority, `git apply`, and fails if the
  // premise ("git rejects an unterminated final line") were ever wrong or version-dependent.
  it("turns a patch git refuses into one git accepts, changing nothing else", () => {
    const root = repo();
    expect(applies(root, DELIVERED_PATCH)).toBe(false);
    expect(applies(root, normalizeUnifiedPatch(DELIVERED_PATCH))).toBe(true);
  });

  // The safety argument from the doc comment, pinned rather than asserted in prose: the binding
  // `planAgentProposal` enforces is over `payload.trim()`, so normalization cannot carry a patch
  // past a digest the delivered bytes would have failed.
  it("is digest-invariant, so it cannot move the authority binding", () => {
    const digest = (patch: string): string => createHash("sha256").update(patch.trim()).digest("hex");
    expect(digest(normalizeUnifiedPatch(DELIVERED_PATCH))).toBe(digest(DELIVERED_PATCH));
  });

  it("leaves an already-terminated patch byte-identical", () => {
    const terminated = `${DELIVERED_PATCH}\n`;
    expect(normalizeUnifiedPatch(terminated)).toBe(terminated);
  });

  it("adds exactly one terminator, never a blank trailing line", () => {
    expect(normalizeUnifiedPatch(DELIVERED_PATCH)).toBe(`${DELIVERED_PATCH}\n`);
  });

  // Normalizing the terminator must not become "normalizing the patch". A patch that is wrong
  // about the tree stays rejected, so the fix cannot be read as a general leniency knob.
  it("does not rescue a patch that is actually inapplicable", () => {
    const root = repo();
    const wrongBase = [
      "diff --git a/absent.txt b/absent.txt",
      "--- a/absent.txt",
      "+++ b/absent.txt",
      "@@ -1 +1 @@",
      "-was never here",
      "+still is not",
    ].join("\n");
    expect(applies(root, normalizeUnifiedPatch(wrongBase))).toBe(false);
  });
});
