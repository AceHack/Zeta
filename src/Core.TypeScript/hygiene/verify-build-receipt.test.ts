import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRosterPaths, loadCheckIds, loadRoster, parseChecksArg } from "./verify-build-receipt.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const CLI = join(HERE, "verify-build-receipt.ts");

const run = (args: readonly string[], cwd: string) =>
  spawnSync("bun", [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } });

const haveSshKeygen = spawnSync("ssh-keygen", ["-?"], { encoding: "utf8" }).stderr?.includes("usage") === true;

describe("roster and vocabulary loading — against the REAL committed files", () => {
  test("the committed check vocabulary is non-empty and every id is usable in a receipt", () => {
    const ids = loadCheckIds(join(HERE, "build-receipt-checks.json"));
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  test("every committed check row names the exact command a `pass` claims to have run", () => {
    // Guards the vocabulary against becoming a bare list of words: a check id whose
    // command nobody wrote down is one no peer can re-run, which makes corroboration
    // impossible and the receipt unfalsifiable.
    const parsed = JSON.parse(readFileSync(join(HERE, "build-receipt-checks.json"), "utf8")) as {
      checks: Record<string, { command?: string; means?: string }>;
    };
    for (const [id, row] of Object.entries(parsed.checks)) {
      expect(`${id}:${row.command ?? ""}`.length).toBeGreaterThan(id.length + 1);
      expect(`${id}:${row.means ?? ""}`.length).toBeGreaterThan(id.length + 1);
    }
  });

  test("the default roster resolves to real maintainer key files with parseable keys", () => {
    const paths = defaultRosterPaths(REPO_ROOT);
    expect(paths.length).toBeGreaterThan(0);
    const roster = loadRoster(paths);
    expect(roster.length).toBeGreaterThan(0);
    for (const e of roster) expect(e.fingerprint).toMatch(/^SHA256:/);
  });

  test("--checks refuses a result outside the closed set", () => {
    expect(() => parseChecksArg("ts-lint=probably")).toThrow(/not in pass\|fail\|skip/);
    expect(() => parseChecksArg("ts-lint")).toThrow(/not <id>=<result>/);
    expect(parseChecksArg("ts-lint=pass,bun-test=fail").length).toBe(2);
  });
});

describe.skipIf(!haveSshKeygen)("end-to-end in a real git repository", () => {
  /** A throwaway git repo with an ed25519 key and one committed file. */
  function scaffold(): { dir: string; keyPath: string; pubPath: string } {
    const dir = mkdtempSync(join(tmpdir(), "zeta-receipt-e2e-"));
    const g = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout;
    };
    g("init", "-q", "-b", "main");
    g("config", "user.email", "receipt-test@zeta.local");
    g("config", "user.name", "Receipt Test");
    writeFileSync(join(dir, "a.txt"), "content one\n");
    g("add", "a.txt");
    const keyPath = join(dir, "signing-key");
    const kg = spawnSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "e2e", "-f", keyPath], { encoding: "utf8" });
    if (kg.status !== 0) throw new Error(`ssh-keygen: ${kg.stderr}`);
    return { dir, keyPath, pubPath: `${keyPath}.pub` };
  }

  test("sign -> commit -> verify is a closed loop, and a changed tree breaks it", () => {
    const { dir, keyPath, pubPath } = scaffold();
    const g = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });

    // 1. SIGN the index tree. `git write-tree` is what `git commit` is about to record.
    const signed = run(["sign", "--checks", "ts-lint=pass,bun-test=pass", "--key", keyPath], dir);
    expect(signed.stderr).toBe("");
    expect(signed.status).toBe(0);
    const block = signed.stdout.trim();
    expect(block).toContain("Build-Receipt-Version: 1");
    expect(block).toContain("Build-Receipt-Checks: bun-test=pass;ts-lint=pass"); // canonically sorted

    // 2. COMMIT with the receipt in the message.
    expect(g("commit", "-q", "-m", `feat: a change\n\n${block}\n`).status).toBe(0);

    // 3. VERIFY with the signer's key as the roster.
    const ok = run(["verify", "HEAD", "--repo", dir, "--roster", pubPath], dir);
    expect(ok.stdout).toContain("VERIFIED");
    expect(ok.status).toBe(0);

    // 4. The SAME receipt on a DIFFERENT tree is refused. This is the property the
    //    whole format exists for: a receipt cannot drift from the code it claims.
    writeFileSync(join(dir, "a.txt"), "content two — snuck in after the receipt\n");
    expect(g("add", "a.txt").status).toBe(0);
    expect(g("commit", "-q", "-m", `feat: sneaky\n\n${block}\n`).status).toBe(0);
    const moved = run(["verify", "HEAD", "--repo", dir, "--roster", pubPath], dir);
    expect(moved.stdout).toContain("REFUSED   tree-mismatch");
    expect(moved.status).toBe(2);
  });

  test("a receipt signed by a key OUTSIDE the roster is refused as untrusted", () => {
    const { dir, keyPath } = scaffold();
    const g = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    const block = run(["sign", "--checks", "ts-lint=pass", "--key", keyPath], dir).stdout.trim();
    expect(g("commit", "-q", "-m", `feat: a change\n\n${block}\n`).status).toBe(0);
    // No --roster, and the temp repo has no maintainers/ directory, so the roster is empty.
    const r = run(["verify", "HEAD", "--repo", dir], dir);
    expect(r.stdout).toContain("REFUSED   untrusted-signer");
    expect(r.status).toBe(2);
  });

  test("sign refuses a check id that is not in the committed vocabulary", () => {
    const { dir, keyPath } = scaffold();
    const r = run(["sign", "--checks", "everything-is-fine=pass", "--key", keyPath], dir);
    expect(r.stderr).toContain("unknown check id(s) everything-is-fine");
    expect(r.status).toBe(1);
  });

  test("a commit with NO receipt passes by default and fails under --require-receipt", () => {
    const { dir } = scaffold();
    const g = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    expect(g("commit", "-q", "-m", "chore: no receipt here").status).toBe(0);
    const quiet = run(["verify", "HEAD", "--repo", dir], dir);
    expect(quiet.stdout).toContain("no build receipt");
    expect(quiet.status).toBe(0);
    const strict = run(["verify", "HEAD", "--repo", dir, "--require-receipt"], dir);
    expect(strict.status).toBe(2);
  });

  test("a receipt with an EDITED result is refused — the signature covers the results", () => {
    const { dir, keyPath, pubPath } = scaffold();
    const g = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    const honest = run(["sign", "--checks", "ts-lint=fail", "--key", keyPath], dir).stdout.trim();
    const laundered = honest.replace("ts-lint=fail", "ts-lint=pass");
    expect(laundered).not.toBe(honest);
    expect(g("commit", "-q", "-m", `fix: looks green\n\n${laundered}\n`).status).toBe(0);
    const r = run(["verify", "HEAD", "--repo", dir, "--roster", pubPath], dir);
    expect(r.stdout).toContain("REFUSED   bad-signature");
    expect(r.status).toBe(2);
  });
});
