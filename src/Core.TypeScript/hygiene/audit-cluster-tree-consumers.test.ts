/**
 * audit-cluster-tree-consumers.test.ts
 *
 * MUTATION SUITE — proves `audit-cluster-tree-consumers.ts` can go RED.
 *
 * The audit exists because a 2026-08-16 pass over the same question produced a
 * consumer list that was itself incomplete. A guard against drift that has
 * drift inside it is worse than no guard, so every failure mode below is
 * planted in a real git tree and observed failing. `control` runs the
 * unmutated fixture and asserts exit 0 — without it, an audit that failed
 * unconditionally would pass every other case here.
 *
 * Each case asserts BOTH the exit code AND the specific reason, because a
 * script can exit 1 for the wrong reason (bad argument, missing file) and
 * still look like a working check.
 *
 * Cases 2 and 3 are the two directions that matter:
 *   - a NEW file coupling to the stale tree must fail (re-divergence);
 *   - a rostered entry that no longer couples must fail (the roster must
 *     shrink as the migration lands, so it can never over-claim safety).
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const audit = join(here, "audit-cluster-tree-consumers.ts");
const realRoster = join(here, "cluster-tree-consumers.json");

/** Fixture cases build a ~4-file throwaway repo; each is one bun spawn, ~2 s. */
const TIMEOUT_MS = 30_000;

/**
 * The real-repo case content-scans every tracked file outside the excluded
 * prefixes — 15,711 of them — because narrowing the scan by file type would
 * create exactly the blind spot this audit exists to close. It carries its own
 * explicit cap per the discipline stated in `bunfig.toml`.
 *
 * The history is the useful part. It first shipped with the audit filtering
 * exclusions in JS rather than in git's pathspec: the whole suite ran 23 s and
 * flaked once at 41 s, blowing the 30 s cap. Raising this constant would have
 * "fixed" the flake and kept a 17 s check. The audit was made fast instead —
 * whole suite now 2.4 s — and the cap is left generous only as headroom for a
 * loaded runner, not as cover for a slow check.
 */
const REAL_REPO_TIMEOUT_MS = 90_000;

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

interface Fixture {
  /** repo-relative path -> file content */
  readonly files: Record<string, string>;
  /** roster `consumers` array */
  readonly consumers: readonly unknown[];
  /** optional roster field overrides, for the malformed-roster cases */
  readonly rosterOverrides?: Record<string, unknown>;
}

/** The fixture every case starts from: one rostered consumer, one excluded file. */
function baseFixture(): Fixture {
  return {
    files: {
      "flake.nix": 'modules = [ ./infra/nixos/hosts/control-plane/configuration.nix ];\n',
      "infra/k8s/applications/root-application.yaml": "path: infra/k8s/applications\n",
      "docs/research/2026-01-01-a-ferry-that-mentions-infra.md": "cites infra/k8s/applications\n",
      "README.md": "nothing to see here\n",
    },
    consumers: [{ path: "flake.nix", disposition: "blocking", note: "fixture" }],
  };
}

/** Build a throwaway git repo + roster from `fixture` and run the audit on it. */
function runOnFixture(fixture: Fixture): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "zeta-cluster-tree-"));
  try {
    for (const [relative, content] of Object.entries(fixture.files)) {
      const absolute = join(dir, relative);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, "utf-8");
    }
    for (const args of [
      ["init", "-q"],
      ["config", "user.email", "audit@zeta.local"],
      ["config", "user.name", "audit"],
      ["add", "-A"],
    ]) {
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      const step = spawnSync("git", ["-C", dir, ...args], { encoding: "utf-8" });
      if (step.status !== 0) throw new Error(`git ${args.join(" ")}: ${step.stderr}`);
    }

    const rosterPath = join(dir, "roster.json");
    writeFileSync(
      rosterPath,
      JSON.stringify({
        stalePatterns: ["infra/k8s", "infra/nixos"],
        survivingTree: "full-ai-cluster",
        excludedPrefixes: ["infra/", "docs/research/"],
        consumers: fixture.consumers,
        ...(fixture.rosterOverrides ?? {}),
      }),
      "utf-8",
    );

    const proc = Bun.spawnSync(["bun", audit, "--root", dir, "--roster", rosterPath], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: repoRoot,
    });
    return {
      exitCode: proc.exitCode,
      output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("audit-cluster-tree-consumers mutation suite", () => {
  test(
    "control: the unmutated fixture passes (so the red cases mean something)",
    () => {
      const { exitCode, output } = runOnFixture(baseFixture());
      expect(output).toContain("roster matches the tree.");
      expect(exitCode).toBe(0);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a NEW file couples to the stale tree (the re-divergence guard)",
    () => {
      const fixture = baseFixture();
      const { exitCode, output } = runOnFixture({
        ...fixture,
        files: {
          ...fixture.files,
          "src/new-consumer.ts": 'const path = "infra/k8s/applications/whatever";\n',
        },
      });
      expect(output).toContain("[unrostered-consumer] src/new-consumer.ts");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a rostered consumer no longer names the stale tree (roster over-claims)",
    () => {
      const fixture = baseFixture();
      const { exitCode, output } = runOnFixture({
        ...fixture,
        files: { ...fixture.files, "flake.nix": "modules = [ ./full-ai-cluster/nixos ];\n" },
      });
      expect(output).toContain("[stale-roster-entry] flake.nix");
      expect(output).toContain("the migration moved");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a rostered consumer no longer exists",
    () => {
      const fixture = baseFixture();
      const files = { ...fixture.files };
      delete files["flake.nix"];
      const { exitCode, output } = runOnFixture({ ...fixture, files });
      expect(output).toContain("[stale-roster-entry] flake.nix");
      expect(output).toContain("does not exist");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "GREEN for excluded prefixes — the stale tree itself and prose archives",
    () => {
      // Both fixture files under infra/ and docs/research/ name the stale tree.
      // Neither may be reported, or the audit would demand the tree roster
      // itself and every frozen ferry that ever mentioned it.
      const { exitCode, output } = runOnFixture(baseFixture());
      expect(output).not.toContain("root-application.yaml");
      expect(output).not.toContain("a-ferry-that-mentions-infra");
      expect(exitCode).toBe(0);
    },
    TIMEOUT_MS,
  );

  test(
    "REFUSES a glob roster path — a roster matching everything is the vacuity class",
    () => {
      const fixture = baseFixture();
      const { exitCode, output } = runOnFixture({
        ...fixture,
        consumers: [{ path: "*", disposition: "blocking" }],
      });
      expect(output).toContain("consumer paths are literal, not globs");
      expect(exitCode).toBe(2);
    },
    TIMEOUT_MS,
  );

  test(
    "REFUSES an unknown disposition — dispositions drive the deletion-ready count",
    () => {
      const fixture = baseFixture();
      const { exitCode, output } = runOnFixture({
        ...fixture,
        consumers: [{ path: "flake.nix", disposition: "probably-fine" }],
      });
      expect(output).toContain("expected one of blocking, derived, prose, self");
      expect(exitCode).toBe(2);
    },
    TIMEOUT_MS,
  );

  test(
    "the REAL repo roster matches the REAL tree",
    () => {
      const proc = Bun.spawnSync(["bun", audit, "--root", repoRoot, "--roster", realRoster], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: repoRoot,
      });
      const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
      expect(output).toContain("roster matches the tree.");
      expect(proc.exitCode).toBe(0);
    },
    REAL_REPO_TIMEOUT_MS,
  );
});
