import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { getEphemeralShadowOutletDir, ensureEphemeralShadowOutlet } from "./ephemeral.ts";

const SCRIPT = join(import.meta.dir, "outlet.ts");
let TEST_DIR: string;

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync("bun", [SCRIPT, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ZETA_SHADOW_DIR: TEST_DIR },
  });
  return {
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
    exitCode: r.status ?? 1,
  };
}

function cleanTestDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe("shadow-outlet", () => {
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-test-"));
  });
  afterEach(cleanTestDir);

  test("write creates an entry and list returns it", () => {
    const w = run("write", "--agent", "otto", "--content", "exploring retraction paths");
    expect(w.exitCode).toBe(0);
    expect(w.stdout).toContain("agent=otto");

    const l = run("list", "--json");
    expect(l.exitCode).toBe(0);
    const entries = JSON.parse(l.stdout);
    expect(entries).toHaveLength(1);
    expect(entries[0].agent).toBe("otto");
    expect(entries[0].content).toBe("exploring retraction paths");
  });

  test("list --exclude hides the excluded agent (self-invisibility)", () => {
    run("write", "--agent", "otto", "--content", "my scratch");
    run("write", "--agent", "vera", "--content", "vera's scratch");

    const all = run("list", "--json");
    expect(JSON.parse(all.stdout)).toHaveLength(2);

    const consensus = run("list", "--exclude", "otto", "--json");
    const filtered = JSON.parse(consensus.stdout);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].agent).toBe("vera");
  });

  test("read retrieves a specific entry by id", () => {
    const w = run("write", "--agent", "otto", "--content", "test read", "--json");
    const entry = JSON.parse(w.stdout);

    const r = run("read", entry.id, "--json");
    expect(r.exitCode).toBe(0);
    const read = JSON.parse(r.stdout);
    expect(read.id).toBe(entry.id);
    expect(read.content).toBe("test read");
  });

  test("read --exclude hides own entries (self-invisibility)", () => {
    const w = run("write", "--agent", "otto", "--content", "shadow thought", "--json");
    const entry = JSON.parse(w.stdout);

    const blocked = run("read", entry.id, "--exclude", "otto");
    expect(blocked.exitCode).toBe(1);

    const allowed = run("read", entry.id, "--exclude", "vera", "--json");
    expect(allowed.exitCode).toBe(0);
    expect(JSON.parse(allowed.stdout).id).toBe(entry.id);
  });

  test("read returns error for missing id", () => {
    const r = run("read", "nonexistent");
    expect(r.exitCode).toBe(1);
  });

  test("clean removes all entries", () => {
    run("write", "--agent", "otto", "--content", "a");
    run("write", "--agent", "vera", "--content", "b");

    const c = run("clean", "--json");
    expect(c.exitCode).toBe(0);
    expect(JSON.parse(c.stdout).removed).toBe(2);

    const l = run("list", "--json");
    expect(JSON.parse(l.stdout)).toHaveLength(0);
  });

  test("clean --agent removes only that agent's entries", () => {
    run("write", "--agent", "otto", "--content", "a");
    run("write", "--agent", "vera", "--content", "b");

    const c = run("clean", "--agent", "otto", "--json");
    expect(JSON.parse(c.stdout).removed).toBe(1);

    const l = run("list", "--json");
    const remaining = JSON.parse(l.stdout);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].agent).toBe("vera");
  });

  test("write without --agent or --content fails", () => {
    const r = run("write", "--agent", "otto");
    expect(r.exitCode).toBe(1);
  });

  test("empty list produces empty array in json mode", () => {
    const l = run("list", "--json");
    expect(l.exitCode).toBe(0);
    expect(JSON.parse(l.stdout)).toHaveLength(0);
  });
});

describe("ephemeral library", () => {
  let savedDir: string | undefined;

  beforeEach(() => {
    savedDir = process.env.ZETA_SHADOW_DIR;
    const tmp = mkdtempSync(join(tmpdir(), "zeta-eph-test-"));
    rmSync(tmp, { recursive: true, force: true }); // start without the dir
    process.env.ZETA_SHADOW_DIR = tmp;
  });

  afterEach(() => {
    const dir = process.env.ZETA_SHADOW_DIR;
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    if (savedDir !== undefined) {
      process.env.ZETA_SHADOW_DIR = savedDir;
    } else {
      delete process.env.ZETA_SHADOW_DIR;
    }
  });

  test("getEphemeralShadowOutletDir returns ZETA_SHADOW_DIR when set", () => {
    const dir = getEphemeralShadowOutletDir();
    expect(dir).toBe(process.env.ZETA_SHADOW_DIR!);
  });

  test("ensureEphemeralShadowOutlet creates directory and returns path", () => {
    const dir = ensureEphemeralShadowOutlet();
    expect(existsSync(dir)).toBe(true);
    expect(dir).toBe(process.env.ZETA_SHADOW_DIR!);
  });

  test("ensureEphemeralShadowOutlet is idempotent — safe to call twice", () => {
    const first = ensureEphemeralShadowOutlet();
    const second = ensureEphemeralShadowOutlet();
    expect(first).toBe(second);
    expect(existsSync(first)).toBe(true);
  });

  test("ensureEphemeralShadowOutlet throws when path is a file not a directory", () => {
    const dir = process.env.ZETA_SHADOW_DIR!;
    // Create the parent so we can write a file at the target path
    const parent = join(dir, "..");
    if (!existsSync(parent)) mkdtempSync(parent); // ensure parent exists
    writeFileSync(dir, "not a directory");
    expect(() => ensureEphemeralShadowOutlet()).toThrow();
    rmSync(dir, { force: true });
  });
});
