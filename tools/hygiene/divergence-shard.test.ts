import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type DivergenceInput,
  buildDivergenceShard,
  divergenceShardRelPath,
  shortContentHash,
  writeDivergenceShard,
  writeShardAtPath,
} from "./divergence-shard";

const TICK = "2026-05-10T11:48:00Z";

const INPUT: DivergenceInput = {
  tick: TICK,
  loopA: {
    identity: { agent: "otto", model: "claude-opus-4-8", harness: "claude-code" },
    body: "Resolve thread: the finding is a false positive (table double-pipe class).",
  },
  loopB: {
    identity: { agent: "codex-loop", model: "gpt-5.5", harness: "codex" },
    body: "Do not resolve: the finding reproduces under local lint; needs a fix.",
  },
  topic: 'PR #4147 thread PRRT_kwExample — "double-pipe" lint finding',
  disagreementSummary:
    "Both loops reviewed the same thread; Loop A reads it as a known false-positive class, Loop B reproduces it locally. The observable delta is resolve-vs-fix.",
  operativeAuthorization: 'aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing"',
};

function withTempRoot<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "diverge-test-"));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("shortContentHash", () => {
  test("is 8 lowercase hex chars", () => {
    expect(shortContentHash("a", "b")).toMatch(/^[0-9a-f]{8}$/);
  });
  test("is deterministic for identical inputs", () => {
    expect(shortContentHash("alpha", "beta")).toBe(shortContentHash("alpha", "beta"));
  });
  test("differs when bodies differ", () => {
    expect(shortContentHash("alpha", "beta")).not.toBe(shortContentHash("alpha", "gamma"));
  });
  test("swapping loop-A/loop-B bodies changes the hash", () => {
    // README spec hashes the bare concatenation (no delimiter): "ab"+"c" vs
    // "c"+"ab" → "abc" vs "cab", which differ. (Bodies that concatenate to the
    // same string — e.g. "x"+"yy" vs "xy"+"y" — do collide; that is the
    // schema's defined behaviour, faithfully reproduced here.)
    expect(shortContentHash("ab", "c")).not.toBe(shortContentHash("c", "ab"));
  });
});

describe("divergenceShardRelPath", () => {
  test("produces the canonical YYYY/MM/DD/HHMMSSZ-<hash>.md shape", () => {
    const p = divergenceShardRelPath(TICK, "a", "b");
    expect(p).toBe(
      `docs/hygiene-history/divergences/2026/05/10/114800Z-${shortContentHash("a", "b")}.md`,
    );
  });
  test("rejects a tick that is not ISO 8601 UTC seconds precision", () => {
    expect(() => divergenceShardRelPath("2026-05-10T11:48Z", "a", "b")).toThrow(/invalid tick/);
    expect(() => divergenceShardRelPath("not-a-date", "a", "b")).toThrow(/invalid tick/);
  });
});

describe("buildDivergenceShard", () => {
  const md = buildDivergenceShard(INPUT);

  test("has type: divergence frontmatter and both loop identities", () => {
    expect(md).toContain("type: divergence");
    expect(md).toContain("agent: otto");
    expect(md).toContain('model: "claude-opus-4-8"');
    expect(md).toContain("harness: claude-code");
    expect(md).toContain("agent: codex-loop");
    expect(md).toContain('model: "gpt-5.5"');
  });

  test("quotes the tick and topic as YAML strings", () => {
    expect(md).toContain(`tick: "${TICK}"`);
    expect(md).toContain("topic: ");
    // topic contains embedded double-quotes; JSON/YAML escaping must apply
    expect(md).toContain('\\"double-pipe\\"');
  });

  test("carries all four required body sections in order", () => {
    const idxA = md.indexOf("## Loop A perspective");
    const idxB = md.indexOf("## Loop B perspective");
    const idxSummary = md.indexOf("## Disagreement summary");
    const idxRecon = md.indexOf("## Reconciliation");
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxSummary);
    expect(idxSummary).toBeLessThan(idxRecon);
  });

  test("attributes each perspective with agent (model, harness)", () => {
    expect(md).toContain("otto (claude-opus-4-8, claude-code): Resolve thread:");
    expect(md).toContain("codex-loop (gpt-5.5, codex): Do not resolve:");
  });

  test("leaves Reconciliation as a maintainer-fills-in placeholder", () => {
    expect(md).toContain("Leave blank until morning reconciliation");
    expect(md).toContain("accept-loop-a | accept-loop-b | accept-both (explicit divergence) | escalate");
  });

  test("is standalone-readable (no external context: PR/topic + delta present)", () => {
    // AC #3: shard readable as a standalone reconciliation document. The topic
    // is YAML/JSON-escaped in frontmatter, so assert its distinctive substring
    // rather than byte-equality through the escaping layer.
    expect(md).toContain("PR #4147 thread PRRT_kwExample");
    expect(md).toContain("double-pipe");
    expect(md).toContain(INPUT.disagreementSummary);
  });

  test("rejects a malformed tick", () => {
    expect(() => buildDivergenceShard({ ...INPUT, tick: "2026/05/10" })).toThrow(/invalid tick/);
  });
});

describe("writeShardAtPath (fail-closed-OR-idempotent)", () => {
  test("writes when the path is free", () => {
    withTempRoot((root) => {
      const p = join(root, "a/b/c/shard.md");
      const r = writeShardAtPath(p, "hello");
      expect(r.status).toBe("written");
      expect(r.absPath).toBe(p);
      expect(readFileSync(p, "utf8")).toBe("hello");
    });
  });

  test("is an idempotent noop when identical content already exists", () => {
    withTempRoot((root) => {
      const p = join(root, "shard.md");
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, "same");
      const r = writeShardAtPath(p, "same");
      expect(r.status).toBe("idempotent-noop");
      expect(r.absPath).toBe(p);
    });
  });

  test("fail-closes to a unique suffix when differing content occupies the path", () => {
    withTempRoot((root) => {
      const p = join(root, "shard.md");
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, "ORIGINAL — must not be overwritten");
      const r = writeShardAtPath(p, "DIFFERENT content");
      expect(r.status).toBe("collision-resolved");
      expect(r.absPath).toBe(join(root, "shard-2.md"));
      // original is preserved (divergence evidence not erased)
      expect(readFileSync(p, "utf8")).toBe("ORIGINAL — must not be overwritten");
      expect(readFileSync(r.absPath, "utf8")).toBe("DIFFERENT content");
    });
  });

  test("collision resolution is itself idempotent on a re-run", () => {
    withTempRoot((root) => {
      const p = join(root, "shard.md");
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, "ORIGINAL");
      const first = writeShardAtPath(p, "SECOND");
      const second = writeShardAtPath(p, "SECOND");
      expect(first.absPath).toBe(join(root, "shard-2.md"));
      expect(second.status).toBe("idempotent-noop");
      expect(second.absPath).toBe(join(root, "shard-2.md"));
    });
  });
});

describe("writeDivergenceShard", () => {
  test("writes to the canonical content-addressed path under repoRoot", () => {
    withTempRoot((root) => {
      const r = writeDivergenceShard(root, INPUT);
      expect(r.status).toBe("written");
      expect(r.relPath).toBe(
        divergenceShardRelPath(TICK, INPUT.loopA.body, INPUT.loopB.body),
      );
      expect(existsSync(join(root, r.relPath))).toBe(true);
    });
  });

  test("identical re-run is an idempotent noop (content-addressing)", () => {
    withTempRoot((root) => {
      writeDivergenceShard(root, INPUT);
      const again = writeDivergenceShard(root, INPUT);
      expect(again.status).toBe("idempotent-noop");
    });
  });

  test("refuses to file when loop bodies are byte-identical (no divergence)", () => {
    const sameBody = "identical conclusion";
    expect(() =>
      writeDivergenceShard("/tmp/unused", {
        ...INPUT,
        loopA: { ...INPUT.loopA, body: sameBody },
        loopB: { ...INPUT.loopB, body: sameBody },
      }),
    ).toThrow(/no divergence to preserve/);
  });
});
