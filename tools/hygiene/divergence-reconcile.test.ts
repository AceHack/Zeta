import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type DivergenceInput,
  buildDivergenceShard,
  divergenceShardRelPath,
  writeDivergenceShard,
} from "./divergence-shard";
import {
  RECONCILIATION_DECISIONS,
  type ReconciliationDecision,
  fillReconciliation,
  findPendingShards,
  isReconciliationDecision,
  isReconciliationPending,
  parseShardMeta,
  reconciliationBody,
  scanDivergenceDir,
} from "./divergence-reconcile";

// Build fixtures via the WRITER so the reader is tested against exactly what the
// writer emits — a writer<->reader round-trip that catches schema drift between
// the two halves of the protocol.
function inputAt(tick: string, aBody: string, bBody: string): DivergenceInput {
  return {
    tick,
    loopA: {
      identity: { agent: "otto", model: "claude-opus-4-8", harness: "claude-code" },
      body: aBody,
    },
    loopB: {
      identity: { agent: "codex-loop", model: "gpt-5.5", harness: "codex" },
      body: bBody,
    },
    topic: `PR #4147 thread <id> — ${aBody.slice(0, 12)}`,
    disagreementSummary: "Loop A and Loop B reached different conclusions on the same thread.",
    operativeAuthorization: 'aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing"',
  };
}

const PENDING_SHARD = buildDivergenceShard(inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B"));

/** Replace the maintainer placeholder with a real decision (reconciled state). */
function reconcile(shard: string, decision: string): string {
  const idx = shard.indexOf("## Reconciliation");
  return `${shard.slice(0, idx)}## Reconciliation\n\n${decision}\n`;
}

function withTempRoot<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "reconcile-test-"));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("reconciliationBody", () => {
  test("returns the section text for a writer-emitted shard", () => {
    const body = reconciliationBody(PENDING_SHARD);
    expect(body).not.toBeNull();
    expect(body).toContain("Leave blank until morning reconciliation");
  });
  test("returns null when there is no Reconciliation section", () => {
    expect(reconciliationBody("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx")).toBeNull();
  });
});

describe("isReconciliationPending", () => {
  test("a writer-emitted shard is pending (placeholder comments only)", () => {
    expect(isReconciliationPending(PENDING_SHARD)).toBe(true);
  });
  test("a shard with a filled decision is not pending", () => {
    expect(isReconciliationPending(reconcile(PENDING_SHARD, "accept-loop-b — B reproduces locally. (Aaron)"))).toBe(false);
  });
  test("a file with no Reconciliation section is not pending", () => {
    expect(isReconciliationPending("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx")).toBe(false);
  });
  test("spliced/nested comments are stripped to a fixpoint, not one pass", () => {
    // A single `.replace(/<!--…-->/g, "")` pass leaves a residual `<!-- -->`
    // here: removing the inner comment splices `<!` + `-- -->` into a fresh
    // comment the pass already scanned past. The fixpoint loop strips it
    // fully, so a comment-only body still reads as pending. (Regression for
    // CodeQL js/incomplete-multi-character-sanitization.)
    const md = "---\ntype: divergence\n---\n\n## Reconciliation\n\n<!<!-- -->-- -->\n";
    expect(isReconciliationPending(md)).toBe(true);
  });
});

describe("parseShardMeta", () => {
  test("extracts tick, topic, and both loop agents from a writer-emitted shard", () => {
    const meta = parseShardMeta(PENDING_SHARD);
    expect(meta).not.toBeNull();
    expect(meta!.tick).toBe("2026-05-10T11:48:00Z");
    expect(meta!.topic).toContain("PR #4147 thread <id>");
    expect(meta!.loopAAgent).toBe("otto");
    expect(meta!.loopBAgent).toBe("codex-loop");
  });
  test("returns null for a non-divergence frontmatter (README-style file)", () => {
    expect(parseShardMeta("---\ntitle: not a shard\n---\n\nbody")).toBeNull();
  });
  test("returns null when there is no frontmatter at all", () => {
    expect(parseShardMeta("# just a markdown doc\n\nno frontmatter")).toBeNull();
  });
});

describe("findPendingShards", () => {
  test("returns only pending shards, oldest-first, excluding reconciled + non-shards", () => {
    const newer = buildDivergenceShard(inputAt("2026-05-12T09:00:00Z", "newer A", "newer B"));
    const older = buildDivergenceShard(inputAt("2026-05-09T08:00:00Z", "older A", "older B"));
    const reconciled = reconcile(
      buildDivergenceShard(inputAt("2026-05-11T07:00:00Z", "done A", "done B")),
      "accept-loop-a — settled. (Aaron)",
    );
    const files = [
      { relPath: "d/newer.md", content: newer },
      { relPath: "d/reconciled.md", content: reconciled },
      { relPath: "d/older.md", content: older },
      { relPath: "d/README.md", content: "---\ntitle: x\n---\nnot a shard" },
    ];
    const pending = findPendingShards(files);
    expect(pending.map((p) => p.relPath)).toEqual(["d/older.md", "d/newer.md"]);
    expect(pending[0]!.tick).toBe("2026-05-09T08:00:00Z");
  });
});

describe("scanDivergenceDir", () => {
  test("returns [] when the divergence directory is absent", () => {
    withTempRoot((root) => {
      expect(scanDivergenceDir(root)).toEqual([]);
    });
  });

  test("surfaces a writer-written shard, then drops it once reconciled", () => {
    withTempRoot((root) => {
      const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
      const { relPath } = writeDivergenceShard(root, input);
      // sanity: writer chose the canonical content-addressed path
      expect(relPath).toBe(divergenceShardRelPath(input.tick, input.loopA.body, input.loopB.body));

      const before = scanDivergenceDir(root);
      expect(before).toHaveLength(1);
      expect(before[0]!.relPath).toBe(relPath);
      expect(before[0]!.loopAAgent).toBe("otto");
      expect(before[0]!.loopBAgent).toBe("codex-loop");

      // Maintainer fills the Reconciliation section in place → no longer pending.
      writeFileSync(join(root, relPath), reconcile(buildDivergenceShard(input), "accept-loop-b — (Aaron)"));
      expect(scanDivergenceDir(root)).toHaveLength(0);
    });
  });

  test("skips README.md and ignores non-shard markdown", () => {
    withTempRoot((root) => {
      const dir = join(root, "docs/hygiene-history/divergences/2026/05/10");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(root, "docs/hygiene-history/divergences/README.md"), "# README\n\n## Reconciliation outcomes\n\nprose");
      writeFileSync(join(dir, "stray.md"), "---\ntitle: not a shard\n---\n\n## Reconciliation\n\n");
      writeFileSync(join(dir, "114800Z-deadbeef.md"), PENDING_SHARD);
      const pending = scanDivergenceDir(root);
      expect(pending).toHaveLength(1);
      expect(dirname(pending[0]!.relPath)).toBe("docs/hygiene-history/divergences/2026/05/10");
    });
  });
});

const RECONCILIATION_HEADING = "## Reconciliation";
/** Length of the prefix up to and including the Reconciliation heading. */
function reconciliationPrefixLen(shard: string): number {
  return shard.indexOf(RECONCILIATION_HEADING) + RECONCILIATION_HEADING.length;
}

describe("isReconciliationDecision / RECONCILIATION_DECISIONS", () => {
  test("the four canonical decisions match the README vocabulary, in order", () => {
    expect(RECONCILIATION_DECISIONS).toEqual(["accept-loop-a", "accept-loop-b", "accept-both", "escalate"]);
  });
  test("accepts a canonical decision and rejects anything else", () => {
    expect(isReconciliationDecision("accept-both")).toBe(true);
    expect(isReconciliationDecision("escalate")).toBe(true);
    expect(isReconciliationDecision("accept-loop-c")).toBe(false);
    expect(isReconciliationDecision("")).toBe(false);
    expect(isReconciliationDecision("accept-loop-b — (Aaron)")).toBe(false);
  });
});

describe("fillReconciliation", () => {
  test("fills a pending shard with a decision-only section (no note)", () => {
    const filled = fillReconciliation(PENDING_SHARD, "accept-loop-a");
    expect(isReconciliationPending(filled)).toBe(false);
    expect(reconciliationBody(filled)!.trim()).toBe("accept-loop-a");
  });

  test("appends an optional note below the decision", () => {
    const filled = fillReconciliation(PENDING_SHARD, "accept-loop-b", "B reproduces locally. (Aaron)");
    expect(reconciliationBody(filled)!.trim()).toBe("accept-loop-b\n\nB reproduces locally. (Aaron)");
    expect(isReconciliationPending(filled)).toBe(false);
  });

  test("treats a blank/whitespace-only note as no note (note is optional)", () => {
    expect(reconciliationBody(fillReconciliation(PENDING_SHARD, "escalate", "   \n\t"))!.trim()).toBe("escalate");
  });

  test("preserves everything up to and including the heading byte-for-byte", () => {
    const len = reconciliationPrefixLen(PENDING_SHARD);
    const filled = fillReconciliation(PENDING_SHARD, "accept-both");
    expect(filled.slice(0, len)).toBe(PENDING_SHARD.slice(0, len));
  });

  test("preserves a trailing `## ` section after Reconciliation (defensive bounding)", () => {
    const withTail = `${PENDING_SHARD}\n${"## Provenance"}\n\ntrailing section body\n`;
    const filled = fillReconciliation(withTail, "accept-both");
    // The Reconciliation section now carries only the decision...
    expect(reconciliationBody(filled)!.trim()).toBe("accept-both");
    // ...and the trailing section survives untouched.
    expect(filled).toContain("## Provenance");
    expect(filled).toContain("trailing section body");
  });

  test("rejects an invalid decision (EAGER, before any work — runtime callers pass raw strings)", () => {
    expect(() => fillReconciliation(PENDING_SHARD, "accept-loop-c" as ReconciliationDecision)).toThrow(
      /invalid reconciliation decision/,
    );
  });

  test("rejects a shard with no `## Reconciliation` section", () => {
    expect(() => fillReconciliation("---\ntype: divergence\n---\n\n## Loop A perspective\n\nx", "escalate")).toThrow(
      /no .## Reconciliation. section/,
    );
  });

  test("refuses to overwrite an already-reconciled section (history-preserving)", () => {
    const reconciled = fillReconciliation(PENDING_SHARD, "accept-loop-a", "first decision");
    expect(() => fillReconciliation(reconciled, "accept-loop-b")).toThrow(/already reconciled/);
  });

  test("round-trip: writer files a pending shard, fillReconciliation drops it from the pending scan", () => {
    withTempRoot((root) => {
      const input = inputAt("2026-05-10T11:48:00Z", "resolve A", "do not resolve B");
      const { relPath } = writeDivergenceShard(root, input);
      expect(scanDivergenceDir(root)).toHaveLength(1);
      // Reconstruct exactly what the writer wrote (writeDivergenceShard == buildDivergenceShard(input)).
      const filled = fillReconciliation(buildDivergenceShard(input), "accept-loop-b", "B reproduces locally. (Aaron)");
      writeFileSync(join(root, relPath), filled);
      expect(scanDivergenceDir(root)).toHaveLength(0);
    });
  });
});
