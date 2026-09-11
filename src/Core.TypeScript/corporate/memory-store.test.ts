/**
 * memory-store.test.ts — a memory an agent owns, in a repository, that survives a restart.
 *
 * Two properties matter here and neither is about storage mechanics. A key is written by an agent,
 * so it is untrusted input and must not be able to address a file outside the store. And a memory
 * must round-trip: what the organization believed before the process died is what it believes after.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { MemoryPhase, MemoryTier, memoryIdOf, write, type Memory } from "./memory";
import { directoryMemoryStore, initMemoryRepo, pathsFor, repoDirFor, slug } from "./memory-store";

const roots: string[] = [];
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-memory-"));
  roots.push(dir);
  return dir;
}
afterEach(() => {
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

function made(tier: MemoryTier, scope: string, key: string, value: string, atMs = 1_700_000_000_000): Memory {
  const r = write(undefined, { tier, scope, key, value, writtenBy: "code_reviewer", atMs });
  if (!r.ok) throw new Error(r.reason);
  return r.memory;
}

describe("A KEY IS UNTRUSTED INPUT", () => {
  test("a traversal in the key becomes ONE NAME, not a path", () => {
    // The property is that the result is a single path SEGMENT and is never `.` or `..`. Asserting
    // "contains no dots" would be wrong for the same reason it was wrong once before in this repo:
    // `..` with no separator traverses nothing, it is just a filename with two dots in it.
    const out = slug("../../.ssh/id_rsa");
    expect(out).not.toContain("/");
    expect(out).not.toContain("\\");
    expect(out).not.toBe(".");
    expect(out).not.toBe("..");
  });

  test("a key that is exactly a traversal segment cannot stay one", () => {
    // These two are the only slug outputs that would actually traverse, so they are the ones
    // worth naming: a segment equal to `.` or `..` is a directory move, anything else is a name.
    expect(slug("..")).not.toBe("..");
    expect(slug(".")).not.toBe(".");
    expect(slug("...")).not.toBe("...");
  });

  test("a leading dot cannot make a hidden file", () => {
    expect(slug(".git")).not.toStartWith(".");
  });

  test("an empty or fully-stripped key still yields a name", () => {
    expect(slug("")).toBe("-");
    expect(slug("///")).not.toBe("");
  });

  test("writing a traversal key lands INSIDE the root", () => {
    const root = tempRoot();
    const store = directoryMemoryStore(root);
    const written = store.save(made(MemoryTier.Hat, "../../etc", "../../passwd", "nope"));
    for (const path of written) expect(path.startsWith(root)).toBe(true);
    expect(existsSync(join(root, "..", "passwd.md"))).toBe(false);
  });

  test("a store with no root refuses to exist rather than writing to the process directory", () => {
    expect(() => directoryMemoryStore("")).toThrow();
  });
});

describe("LAYOUT: an agent's memory is its own directory, so it can be its own repository", () => {
  test("agent memory is under agents/<id>", () => {
    expect(pathsFor(MemoryTier.Agent, "agent-7", "k").dir).toBe(join("agents", "agent-7"));
    expect(repoDirFor(made(MemoryTier.Agent, "agent-7", "k", "v"))).toBe(join("agents", "agent-7"));
  });

  test("hat, department and org memory share the library", () => {
    expect(pathsFor(MemoryTier.Hat, "code_reviewer", "k").dir).toBe(join("library", "hat", "code_reviewer"));
    expect(repoDirFor(made(MemoryTier.Hat, "code_reviewer", "k", "v"))).toBe("library");
    expect(repoDirFor(made(MemoryTier.Org, "org", "k", "v"))).toBe("library");
  });

  test("work memory is separate from both, because it dies with the work", () => {
    expect(pathsFor(MemoryTier.Work, "task-1", "k").dir).toBe(join("work", "task-1"));
  });
});

describe("ROUND TRIP: what it believed before the restart", () => {
  test("a saved memory loads back with its value, tier, scope and key", () => {
    const root = tempRoot();
    const store = directoryMemoryStore(root);
    const original = made(MemoryTier.Hat, "code_reviewer", "require-rollback-plan", "Require a rollback plan.");
    store.save(original);

    const loaded = directoryMemoryStore(root).load();
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.content.value).toBe("Require a rollback plan.");
    expect(loaded[0]?.content.tier).toBe(MemoryTier.Hat);
    expect(loaded[0]?.content.scope).toBe("code_reviewer");
    expect(loaded[0]?.content.memoryId).toBe(memoryIdOf(MemoryTier.Hat, "code_reviewer", "require-rollback-plan"));
  });

  test("the counters survive too — otherwise every restart resets what was learned", () => {
    const root = tempRoot();
    const store = directoryMemoryStore(root);
    const m = made(MemoryTier.Agent, "agent-7", "pad-qa", "I under-estimate test effort.");
    store.save({
      content: m.content,
      state: { ...m.state, confidence: 0.9, reinforcementCount: 4, phase: MemoryPhase.Reinforced },
    });
    const back = directoryMemoryStore(root).load()[0];
    expect(back?.state.confidence).toBe(0.9);
    expect(back?.state.reinforcementCount).toBe(4);
    expect(back?.state.phase).toBe(MemoryPhase.Reinforced);
  });

  test("protection survives, so a memory that must not be forgotten still cannot be", () => {
    const root = tempRoot();
    const r = write(undefined, {
      tier: MemoryTier.Org, scope: "org", key: "legal-review", value: "Public copy goes through Legal.",
      writtenBy: "human", atMs: 1, protected: true,
    });
    if (!r.ok) throw new Error(r.reason);
    directoryMemoryStore(root).save(r.memory);
    expect(directoryMemoryStore(root).load()[0]?.content.protected).toBe(true);
  });

  test("the belief is a readable markdown file, not an encoding", () => {
    // The reason for git at all: somebody can review what the organization thinks.
    const root = tempRoot();
    directoryMemoryStore(root).save(made(MemoryTier.Hat, "code_reviewer", "k", "Require a rollback plan."));
    const text = readFileSync(join(root, "library", "hat", "code_reviewer", "k.md"), "utf-8");
    expect(text).toContain("Require a rollback plan.");
    expect(text).toContain("tier: hat");
  });

  test("content and state are SEPARATE files, so counters do not churn the belief's history", () => {
    const root = tempRoot();
    directoryMemoryStore(root).save(made(MemoryTier.Hat, "code_reviewer", "k", "v"));
    expect(existsSync(join(root, "library", "hat", "code_reviewer", "k.md"))).toBe(true);
    expect(existsSync(join(root, "library", "hat", "code_reviewer", "k.state.json"))).toBe(true);
  });

  test("a corrupt state file loses the counters and keeps the belief", () => {
    // The alternative — skipping the file — would make the organization silently forget something
    // it still believes, which is the worse failure.
    const root = tempRoot();
    directoryMemoryStore(root).save(made(MemoryTier.Hat, "code_reviewer", "k", "still true"));
    writeFileSync(join(root, "library", "hat", "code_reviewer", "k.state.json"), "{not json", "utf-8");
    const back = directoryMemoryStore(root).load();
    expect(back.length).toBe(1);
    expect(back[0]?.content.value).toBe("still true");
  });

  test("a .git directory is never read as memory", () => {
    const root = tempRoot();
    mkdirSync(join(root, "library", ".git"), { recursive: true });
    writeFileSync(join(root, "library", ".git", "COMMIT_EDITMSG.md"), "---\ntier: hat\n---\nnot a memory", "utf-8");
    expect(directoryMemoryStore(root).load()).toEqual([]);
  });

  test("an empty store is no memories rather than an error", () => {
    expect(directoryMemoryStore(tempRoot()).load()).toEqual([]);
  });
});

describe("HISTORY: the agent's own repository", () => {
  test("a commit records the write, and the file is in git", () => {
    const root = tempRoot();
    expect(initMemoryRepo(root, join("agents", "agent-7")).ok).toBe(true);
    const store = directoryMemoryStore(root);
    store.save(made(MemoryTier.Agent, "agent-7", "pad-qa", "I under-estimate test effort."));
    const done = store.commit("remember: pad QA estimates", join("agents", "agent-7"));
    expect(done.ok).toBe(true);
    const log = spawnSync("git", ["log", "--oneline"], {
      cwd: join(root, "agents", "agent-7"), encoding: "utf-8", shell: false,
    });
    expect(log.stdout).toContain("remember: pad QA estimates");
  });

  test("committing where there is no repository REFUSES rather than losing the write", () => {
    const root = tempRoot();
    const store = directoryMemoryStore(root);
    store.save(made(MemoryTier.Agent, "agent-9", "k", "v"));
    const done = store.commit("m", join("agents", "agent-9"));
    expect(done.ok).toBe(false);
    expect(done.reason).toContain("not a git repository");
    // The memory is still there. A missing repository costs the history, never the belief.
    expect(directoryMemoryStore(root).load().length).toBe(1);
  });

  test("committing nothing is not a failure", () => {
    const root = tempRoot();
    initMemoryRepo(root, "library");
    const store = directoryMemoryStore(root);
    store.save(made(MemoryTier.Hat, "code_reviewer", "k", "v"));
    expect(store.commit("first", "library").ok).toBe(true);
    // A reinforcement that changed no bytes is the ordinary case, not an error.
    expect(store.commit("again", "library").ok).toBe(true);
  });

  test("init is idempotent", () => {
    const root = tempRoot();
    expect(initMemoryRepo(root, "library").ok).toBe(true);
    expect(initMemoryRepo(root, "library").ok).toBe(true);
  });

  test("a commit outside the root is refused", () => {
    const root = tempRoot();
    expect(directoryMemoryStore(root).commit("m", join("..", "..", "elsewhere")).ok).toBe(false);
  });
});
