/**
 * corporate/memory-store.ts — where a memory lives: a file an agent owns, in a repository.
 *
 * ── WHY GIT AND NOT A DATABASE ───────────────────────────────────────────────
 * The source design keeps memory in Cockroach. The requirement here is different and better suited
 * to what this register already is: **each agent keeps its memory in a git repository it owns**, and
 * the organization keeps one shared library for the memory that belongs to roles rather than to
 * people. That buys three things a table does not:
 *
 *   - `git log docs/hat/code_reviewer/require-rollback-plan.md` is the history of a belief.
 *   - A memory is a readable markdown file. Somebody can review what the organization thinks.
 *   - Ownership is a real boundary: an agent's repository is its own, and the shared library is a
 *     separate one that promotion moves things INTO, deliberately.
 *
 * ── CONTENT AND STATE ARE SEPARATE FILES, AND THAT IS THE POINT ──────────────
 * `<key>.md` holds the belief. `<key>.state.json` holds the counters that move every time the memory
 * is injected. Together in one file, `git log` on the belief would be a wall of "injected 41 → 42"
 * and the actual edits — the moments the organization changed its mind — would be unfindable. This
 * is the Data-Vault change-rate split, applied where it earns its keep.
 *
 * ── A KEY IS UNTRUSTED INPUT ─────────────────────────────────────────────────
 * Keys and scopes are written by agents. `../../.ssh/id_rsa` is a legal-looking key, so every path
 * is slugged and then CHECKED for containment before anything is written. The check is on the
 * resolved path, not on the input, because that is the only form that cannot be tricked.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, sep } from "node:path";

import {
  memoryIdOf,
  MemoryPhase,
  MemoryTier,
  type Memory,
  type MemoryContent,
  type MemoryState,
} from "./memory";

/**
 * A filesystem-safe name that keeps the original readable.
 *
 * Ordinal replacement, no locale. Everything outside a small safe set becomes `-`, so `../..` is
 * `-----` — a name, not a traversal. The containment check below is still performed, because a
 * slug function is the wrong place to rest a security property.
 */
export function slug(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^\.+/, "-");
  return cleaned === "" ? "-" : cleaned.slice(0, 120);
}

/** Where a memory's two files live, relative to a root. */
export function pathsFor(tier: MemoryTier, scope: string, key: string): { readonly dir: string; readonly base: string } {
  // Agent memory is rooted at `agents/<id>` so that directory can be its own repository.
  const dir =
    tier === MemoryTier.Agent
      ? join("agents", slug(scope))
      : tier === MemoryTier.Work
        ? join("work", slug(scope))
        : join("library", slug(tier), slug(scope));
  return { dir, base: slug(key) };
}

/**
 * Refuse a path that escapes its root.
 *
 * Checked on the RESOLVED path. A check on the input string can be defeated by a name that only
 * becomes a traversal after normalisation, which is the whole trick.
 */
function within(root: string, candidate: string): boolean {
  const r = resolve(root);
  const c = resolve(candidate);
  return c === r || c.startsWith(r + sep);
}

function frontMatter(content: MemoryContent): string {
  const lines = [
    "---",
    `memoryId: ${content.memoryId}`,
    `tier: ${content.tier}`,
    `scope: ${content.scope}`,
    `key: ${content.key}`,
    `protected: ${String(content.protected)}`,
    `writtenBy: ${content.writtenBy}`,
    `writtenAtMs: ${String(content.writtenAtMs)}`,
    ...(content.contextHint === undefined ? [] : [`contextHint: ${content.contextHint.replace(/\n/g, " ")}`]),
    "---",
    "",
  ];
  return lines.join("\n");
}

function parseFrontMatter(text: string): { readonly fields: Record<string, string>; readonly body: string } {
  if (!text.startsWith("---\n")) return { fields: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { fields: {}, body: text };
  const fields: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { fields, body: text.slice(end + 4).replace(/^\n+/, "") };
}

export interface MemoryStore {
  /** Every memory under this root. */
  readonly load: () => readonly Memory[];
  /** Write one memory's two files. Returns the paths written, for a commit message. */
  readonly save: (memory: Memory) => readonly string[];
  /**
   * Commit what has been written to the repository that owns it.
   *
   * Returns a refusal rather than throwing when the directory is not a repository — a memory that
   * was written to disk but not committed is still a memory, and losing the write because the
   * repository was not initialised would be the worse outcome.
   */
  readonly commit: (message: string, scopeDir?: string) => { readonly ok: boolean; readonly reason?: string };
  readonly root: string;
}

/**
 * A memory store over a directory tree, with git as the history.
 *
 * `agents/<id>` and `library` are intended to be separate repositories. Nothing here requires that —
 * a plain directory works and simply has no history — because requiring `git init` before an agent
 * can remember anything would make memory a deployment concern.
 */
export function directoryMemoryStore(root: string): MemoryStore {
  if (typeof root !== "string" || root.trim() === "") {
    // The same runtime guard `gitChangeControl` keeps, for the same reason: a store with no root
    // would write into whatever directory the process happens to be standing in.
    throw new Error("directoryMemoryStore needs an explicit root directory");
  }

  const readOne = (mdPath: string): Memory | undefined => {
    const text = readFileSync(mdPath, "utf-8");
    const { fields, body } = parseFrontMatter(text);
    const tier = fields["tier"] as MemoryTier | undefined;
    const scope = fields["scope"];
    const key = fields["key"];
    if (tier === undefined || scope === undefined || key === undefined) return undefined;

    const statePath = mdPath.replace(/\.md$/, ".state.json");
    let state: MemoryState | undefined;
    {
      // No `existsSync` gate: the try/catch below ALREADY handles a missing file, so the
      // check only added a window in which the answer could go stale (CWE-367).
      try {
        state = JSON.parse(readFileSync(statePath, "utf-8")) as MemoryState;
      } catch {
        // A corrupt state file loses the COUNTERS, not the belief. Rebuilding a default state is
        // right: the memory still says what it said, and its history restarts rather than the file
        // being skipped and the organization silently forgetting it.
        state = undefined;
      }
    }
    const memoryId = memoryIdOf(tier, scope, key);
    return {
      content: {
        memoryId,
        tier,
        scope,
        key,
        value: body.trim(),
        ...(fields["contextHint"] === undefined ? {} : { contextHint: fields["contextHint"] }),
        protected: fields["protected"] === "true",
        writtenBy: fields["writtenBy"] ?? "unknown",
        writtenAtMs: Number.parseInt(fields["writtenAtMs"] ?? "0", 10) || 0,
      },
      state: state ?? {
        memoryId,
        confidence: 0.5,
        freshnessAtMs: Number.parseInt(fields["writtenAtMs"] ?? "0", 10) || 0,
        reinforcementCount: 0,
        outcome: { successCount: 0, failureCount: 0, inconclusiveCount: 0, lastOutcomeAtMs: undefined, workItemsObserved: [] },
        utility: { injectedCount: 0, citedCount: 0, lastInjectedAtMs: undefined },
        crossScope: { distinctScopes: [scope], firstObservedAtMs: 0, lastObservedAtMs: 0 },
        phase: MemoryPhase.Draft,
      },
    };
  };

  const walk = (dir: string, out: string[]): void => {
    // Let the read decide existence, and take the kind FROM the listing: two races closed
    // at once (CWE-367). A directory that is gone is empty, which is what the old
    // `existsSync` early-return meant anyway.
    let entries: readonly import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirent of entries) {
      const entry = dirent.name;
      const full = join(dir, entry);
      if (dirent.isDirectory()) {
        // `.git` is skipped so a repository's own objects are never read as memories.
        if (entry !== ".git") walk(full, out);
      } else if (entry.endsWith(".md")) {
        out.push(full);
      }
    }
  };

  return {
    root,
    load: () => {
      const files: string[] = [];
      walk(root, files);
      const out: Memory[] = [];
      for (const file of files) {
        const memory = readOne(file);
        if (memory !== undefined) out.push(memory);
      }
      return out;
    },
    save: (memory) => {
      const { dir, base } = pathsFor(memory.content.tier, memory.content.scope, memory.content.key);
      const fullDir = join(root, dir);
      if (!within(root, fullDir)) {
        throw new Error(`refusing to write outside the memory root: ${dir}`);
      }
      mkdirSync(fullDir, { recursive: true });
      const mdPath = join(fullDir, `${base}.md`);
      const statePath = join(fullDir, `${base}.state.json`);
      if (!within(root, mdPath) || !within(root, statePath)) {
        throw new Error(`refusing to write outside the memory root: ${base}`);
      }
      writeFileSync(mdPath, `${frontMatter(memory.content)}${memory.content.value}\n`, "utf-8");
      writeFileSync(statePath, `${JSON.stringify(memory.state, null, 2)}\n`, "utf-8");
      return [mdPath, statePath];
    },
    commit: (message, scopeDir) => {
      const cwd = scopeDir === undefined ? root : join(root, scopeDir);
      if (!within(root, cwd)) return { ok: false, reason: "outside the memory root" };
      if (!existsSync(join(cwd, ".git"))) {
        return { ok: false, reason: `${cwd} is not a git repository — the write landed, the history did not` };
      }
      const add = spawnSync("git", ["add", "-A"], { cwd, encoding: "utf-8", shell: false });
      if (add.status !== 0) return { ok: false, reason: `git add: ${(add.stderr ?? "").trim()}` };
      const done = spawnSync("git", ["commit", "-m", message], { cwd, encoding: "utf-8", shell: false });
      if (done.status !== 0) {
        const out = `${done.stdout ?? ""}${done.stderr ?? ""}`;
        // NOTHING TO COMMIT IS NOT A FAILURE. Saving a memory whose bytes did not change is the
        // ordinary case for a reinforcement that only touched the state file.
        if (out.includes("nothing to commit")) return { ok: true };
        return { ok: false, reason: `git commit: ${out.trim()}` };
      }
      return { ok: true };
    },
  };
}

/** Initialise a repository for a scope, so its memory has a history. Idempotent. */
export function initMemoryRepo(root: string, scopeDir: string, identity = "zeta-agent"): { readonly ok: boolean; readonly reason?: string } {
  const cwd = join(root, scopeDir);
  if (!within(root, cwd)) return { ok: false, reason: "outside the memory root" };
  mkdirSync(cwd, { recursive: true });
  if (existsSync(join(cwd, ".git"))) return { ok: true };
  const init = spawnSync("git", ["init", "-q", "-b", "main"], { cwd, encoding: "utf-8", shell: false });
  if (init.status !== 0) return { ok: false, reason: `git init: ${(init.stderr ?? "").trim()}` };
  spawnSync("git", ["config", "user.name", identity], { cwd, encoding: "utf-8", shell: false });
  spawnSync("git", ["config", "user.email", `${slug(identity)}@zeta.local`], { cwd, encoding: "utf-8", shell: false });
  return { ok: true };
}

/** Which repository owns a memory — where a commit for it belongs. */
export function repoDirFor(memory: Memory): string {
  return memory.content.tier === MemoryTier.Agent
    ? join("agents", slug(memory.content.scope))
    : memory.content.tier === MemoryTier.Work
      ? join("work", slug(memory.content.scope))
      : "library";
}
