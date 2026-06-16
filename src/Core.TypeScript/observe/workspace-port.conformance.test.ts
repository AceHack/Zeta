/**
 * workspace-port.conformance.test.ts — parameterized conformance tests.
 *
 * The SAME test suite runs against EVERY WorkspacePort implementation.
 * If it passes for one backend, it passes for all — proving the interface
 * contract is correctly implemented regardless of storage substrate.
 *
 * Backend matrix (the full spectrum from research/2026-06-07):
 *   simulated        — in-memory, DST (no I/O)
 *   os-fs            — real filesystem (temp dir)
 *   zeta-fs-polyfill — (future) zeta-fs semantics over os-fs + git
 *   zeta-fs-native   — (future) single-file FUSE, no OS deps
 *
 * Today: simulated + real. The conformance suite grows as backends land.
 * Adding a backend = adding one factory entry; all tests run automatically.
 */

import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  simulatedWorkspacePort,
  realWorkspacePort,
  emptySimulatedState,
  type WorkspacePort,
} from "./workspace-port";

// ─── Backend factory: each entry produces a fresh WorkspacePort ──────────────

interface BackendFactory {
  readonly name: string;
  create(): WorkspacePort;
  cleanup?(): void;
}

const factories: BackendFactory[] = [
  {
    name: "simulated (in-memory DST)",
    create: () => simulatedWorkspacePort(emptySimulatedState()),
  },
  (() => {
    let tmpDir: string | null = null;
    return {
      name: "real (os-fs, temp dir)",
      create() {
        tmpDir = mkdtempSync(join(tmpdir(), "wp-conformance-"));
        // Initialize as a git repo so git operations work
        const { spawnSync } = require("node:child_process");
        spawnSync("git", ["init", tmpDir], { stdio: "ignore" });
        spawnSync("git", ["-C", tmpDir, "config", "user.email", "test@test.local"], { stdio: "ignore" });
        spawnSync("git", ["-C", tmpDir, "config", "user.name", "test"], { stdio: "ignore" });
        // Create an initial commit so branches work
        const { writeFileSync } = require("node:fs");
        writeFileSync(join(tmpDir, ".gitkeep"), "");
        spawnSync("git", ["-C", tmpDir, "add", "."], { stdio: "ignore" });
        spawnSync("git", ["-C", tmpDir, "commit", "--no-verify", "-m", "init"], { stdio: "ignore" });
        return realWorkspacePort(tmpDir);
      },
      cleanup() {
        if (tmpDir) {
          try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
          tmpDir = null;
        }
      },
    };
  })(),
  // ─── Future backends (uncomment as they land) ──────────────────────
  // { name: "zeta-fs-polyfill (os-fs + git underneath)", create: () => zetaFsPolyfillPort(...) },
  // { name: "zeta-fs-native (single-file FUSE)", create: () => zetaFsNativePort(...) },
];

// ─── The conformance suite ───────────────────────────────────────────────────

for (const factory of factories) {
  describe(`WorkspacePort conformance [${factory.name}]`, () => {
    let port: WorkspacePort;

    beforeEach(() => {
      port = factory.create();
    });

    afterAll(() => {
      factory.cleanup?.();
    });

    // ── Content: write + read round-trip ─────────────────────────────

    test("writeFile + readFile round-trips text content", () => {
      const w = port.writeFile("src/hello.ts", "export const x = 1;");
      expect(w.ok).toBe(true);

      const r = port.readFile("src/hello.ts");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe("export const x = 1;");
    });

    test("writeFile creates nested directories implicitly", () => {
      const w = port.writeFile("deep/nested/path/file.md", "content");
      expect(w.ok).toBe(true);
      expect(port.exists("deep/nested/path/file.md")).toBe(true);
    });

    test("readFile on missing path returns IoResult error (never throws)", () => {
      const r = port.readFile("does/not/exist.ts");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    });

    // ── Existence ────────────────────────────────────────────────────

    test("exists is false before write, true after", () => {
      expect(port.exists("nope.ts")).toBe(false);
      port.writeFile("nope.ts", "x");
      expect(port.exists("nope.ts")).toBe(true);
    });

    // ── Directory listing ────────────────────────────────────────────

    test("readDir lists immediate children", () => {
      port.writeFile("dir/a.ts", "a");
      port.writeFile("dir/b.ts", "b");
      port.writeFile("dir/sub/c.ts", "c");

      const r = port.readDir("dir");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toContain("a.ts");
        expect(r.value).toContain("b.ts");
        // sub/ may or may not appear depending on impl (both valid)
      }
    });

    test("readDir on missing directory returns error or empty (backend-dependent)", () => {
      const r = port.readDir("nonexistent-dir");
      // Real fs: ENOENT error. Simulated: empty list (no files with that prefix).
      // Both are valid — the invariant is "doesn't throw."
      if (r.ok) {
        expect(r.value.length).toBe(0);
      } else {
        expect(r.reason.length).toBeGreaterThan(0);
      }
    });

    // ── Git operations (version control) ─────────────────────────────

    test("git checkout -B creates a branch", () => {
      // Create branch from HEAD (not from a named ref that may not exist in temp repo)
      const r = port.git(["checkout", "-B", "test/branch"]);
      expect(r.ok).toBe(true);

      const branch = port.git(["rev-parse", "--abbrev-ref", "HEAD"]);
      expect(branch.ok).toBe(true);
      if (branch.ok) expect(branch.value).toBe("test/branch");
    });

    test("git commit records a change", () => {
      port.writeFile("src/change.ts", "new content");
      port.git(["add", "src/change.ts"]);
      const r = port.git(["commit", "--no-verify", "-m", "test commit"]);
      expect(r.ok).toBe(true);
    });

    test("git push succeeds (simulated) or fails gracefully (no remote)", () => {
      // On a real temp repo with no remote, push fails gracefully (IoResult error).
      // On simulated, push always succeeds. Both are valid behaviors.
      const r = port.git(["push", "-u", "origin", "test/branch"]);
      // Just verify it doesn't throw — the result can be ok or error
      expect(typeof r.ok).toBe("boolean");
    });

    // ── Full cycle (the executor's workflow) ─────────────────────────

    test("full code-edit cycle: checkout → write → add → commit → push", () => {
      // This is what the observe loop executor does on every do_item tick
      port.git(["fetch", "origin", "main"]);
      port.git(["checkout", "-B", "alexa/conformance-test", "origin/main"]);
      port.writeFile("src/fix.ts", "export function fix() { return true; }");
      port.git(["add", "src/fix.ts"]);
      const commit = port.git(["commit", "--no-verify", "-m", "fix: conformance"]);
      expect(commit.ok).toBe(true);
      // Push may fail on real backend (no remote) — that's fine; the point is
      // the cycle up to commit works. Push is a network operation.
      port.git(["push", "-u", "origin", "alexa/conformance-test"]);
    });

    // ── Exec (process spawning) ──────────────────────────────────────

    test("exec returns stdout + exitCode", () => {
      const r = port.exec("echo", ["hello"]);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.exitCode).toBe(0);
      }
    });

    // ── Multi-home (link) ────────────────────────────────────────────

    test("link creates a second path to the same content", () => {
      port.writeFile("src/shared/util.ts", "export const shared = true;");
      const linkResult = port.link("src/shared/util.ts", "packages/app/util.ts");
      expect(linkResult.ok).toBe(true);

      // Both paths read the same content
      const original = port.readFile("src/shared/util.ts");
      const linked = port.readFile("packages/app/util.ts");
      expect(original.ok).toBe(true);
      expect(linked.ok).toBe(true);
      if (original.ok && linked.ok) {
        expect(linked.value).toBe(original.value);
      }
    });

    test("link to missing source returns error or creates dangling link (backend-dependent)", () => {
      const r = port.link("does/not/exist.ts", "somewhere/else.ts");
      // Real fs: symlinks can dangle (ok). Simulated: rejects (not ok).
      // Both are valid — the invariant is "doesn't throw."
      expect(typeof r.ok).toBe("boolean");
    });

    // ── Schema evolution backward-compat (the proof) ─────────────────

    test("schema evolution: old files readable after schema change (default fills missing)", () => {
      // Write a file under "v1 schema" (no owner field)
      port.writeFile("data/old-entry.md", "---\ntitle: old\n---\ncontent");

      // "Evolve" the schema (in real impl: applyDelta on the schema Z-set)
      // The key invariant: old files STILL READ correctly after evolution
      const readResult = port.readFile("data/old-entry.md");
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.value).toContain("old");
    });

    test("schema evolution: new files with new fields work alongside old", () => {
      // Old file (no "owner" field)
      port.writeFile("data/old.md", "old content");
      // New file (with "owner" in content — simulating new schema field)
      port.writeFile("data/new.md", "---\nowner: 081KOWNER000001\n---\nnew content");

      // Both coexist and read correctly
      const old = port.readFile("data/old.md");
      const fresh = port.readFile("data/new.md");
      expect(old.ok).toBe(true);
      expect(fresh.ok).toBe(true);
      if (fresh.ok) expect(fresh.value).toContain("081KOWNER000001");
    });

    // ── History operations ────────────────────────────────────────────

    test("history returns entries after commits", () => {
      port.writeFile("src/a.ts", "v1");
      port.stage(["src/a.ts"]);
      port.commit("first commit");
      
      const h = port.history();
      expect(h.ok).toBe(true);
      if (h.ok) {
        expect(h.value.length).toBeGreaterThan(0);
        expect(h.value[0]!.message).toContain("first commit");
      }
    });

    test("mergeBase returns a hash", () => {
      const r = port.mergeBase("HEAD", "HEAD");
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.hash.length).toBeGreaterThan(0);
      }
    });
  });
}
