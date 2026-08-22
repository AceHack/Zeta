/**
 * infra/k8s/tests/validate-applications.test.ts
 *
 * MUTATION SUITE — proves `validate-applications.ts` can go RED.
 *
 * A green check is worth nothing until someone has watched it fail. On
 * 2026-08-14 this repo found five separate checks that could not fail, and
 * the previous version of the validator under test was one of them: it
 * reported `PASS: valid YAML` on a manifest containing a tab-indented line
 * and an unterminated quote, and `44 passed, 0 failed` on a chart pinned to
 * version 999.999.999.
 *
 * So each case here takes the REAL manifest tree, copies it to a temp dir,
 * applies ONE mutation, runs the validator as a subprocess, and asserts
 * BOTH that the exit code is 1 AND that the specific expected reason is in
 * the output. The exit code alone is not enough — a script can exit 1 for
 * the wrong reason (an argument-parsing error, a missing file) and still
 * look like a working check.
 *
 * `control` runs the UNMUTATED copy and asserts exit 0. Without it, a
 * validator that failed unconditionally would pass every other case here.
 *
 * All cases run `--offline`: no network, deterministic, and comfortably
 * inside bun's effective 5000 ms per-test cap (see bunfig.toml).
 */

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const validator = join(here, "validate-applications.ts");
const realAppsDir = join(repoRoot, "infra", "k8s", "applications");

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

/** Copy the real tree, let `mutate` edit it, run the validator against the copy. */
function runWithMutation(mutate: (appsDir: string) => void): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "zeta-k8s-mutation-"));
  try {
    const appsDir = join(dir, "applications");
    cpSync(realAppsDir, appsDir, { recursive: true });
    mutate(appsDir);
    const proc = Bun.spawnSync(["bun", validator, "--offline", "--apps-dir", appsDir], {
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

function appManifest(appsDir: string, app: string): string {
  return join(appsDir, app, "Application.yaml");
}

function edit(path: string, fn: (text: string) => string): void {
  writeFileSync(path, fn(readFileSync(path, "utf-8")), "utf-8");
}

const TIMEOUT_MS = 20_000;

describe("validate-applications mutation suite", () => {
  test(
    "control: the unmutated tree passes (so red cases mean something)",
    () => {
      const { exitCode, output } = runWithMutation(() => {
        // No mutation: the control case.
      });
      expect(output).toContain("All checks passed.");
      expect(exitCode).toBe(0);
    },
    TIMEOUT_MS,
  );

  test(
    "RED on syntactically invalid YAML (the old hand-rolled parser said PASS)",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        writeFileSync(
          appManifest(appsDir, "orleans"),
          'apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: "unterminated\n\t\tbroken: [unclosed\n',
          "utf-8",
        );
      });
      expect(output).toContain("YAML parse failed");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED on a duplicate mapping key (previously 37 passed / 0 failed)",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "orleans"), (t) =>
          t.replace("  destination:\n", "  destination:\n    namespace: duplicate-key-injected\n"),
        );
      });
      expect(output).toContain("YAML parse failed");
      expect(output).toContain("orleans");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when destination.server points off-cluster",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "longhorn"), (t) =>
          t.replace("server: https://kubernetes.default.svc", "server: https://someone-elses-cluster.example.com"),
        );
      });
      expect(output).toContain("destination.server is NOT in-cluster");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a required field is deleted",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "cockroachdb"), (t) => t.replace(/^ {2}project: default\n/m, ""));
      });
      expect(output).toContain("missing required field .spec.project");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when the ArgoCD finalizer is dropped (orphans resources on delete)",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "gitlab"), (t) =>
          t.replace(/^ {2}finalizers:\n {4}- resources-finalizer\.argocd\.argoproj\.io\n/m, ""),
        );
      });
      expect(output).toContain("missing resources-finalizer.argocd.argoproj.io");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when CreateNamespace=true is dropped from syncOptions",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "argorollouts"), (t) => t.replace(/^ {6}- CreateNamespace=true\n/m, ""));
      });
      expect(output).toContain("missing CreateNamespace=true in syncOptions");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when root-application.yaml loses directory.include (would sync stray files)",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(join(appsDir, "root-application.yaml"), (t) => t.replace(/^ {6}include: .*\n/m, ""));
      });
      expect(output).toContain("directory.include is missing");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when root-application.yaml loses recurse=true (would find no Applications)",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(join(appsDir, "root-application.yaml"), (t) => t.replace("recurse: true", "recurse: false"));
      });
      expect(output).toContain("directory.recurse is not true");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when kind is not Application",
    () => {
      const { exitCode, output } = runWithMutation((appsDir) => {
        edit(appManifest(appsDir, "argoworkflows"), (t) => t.replace(/^kind: Application$/m, "kind: ApplicationSet"));
      });
      expect(output).toContain("wrong apiVersion");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "exit 2 (not 0) on mutually exclusive flags",
    () => {
      const proc = Bun.spawnSync(["bun", validator, "--offline", "--render"], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: repoRoot,
      });
      expect(proc.exitCode).toBe(2);
    },
    TIMEOUT_MS,
  );

  test(
    "exit non-zero (not 0) on an unknown flag",
    () => {
      // parseArgs strict:true. The old version used strict:false, so a typo'd
      // flag was silently ignored and the run went green having checked nothing
      // the caller asked for.
      const proc = Bun.spawnSync(["bun", validator, "--offlien"], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: repoRoot,
      });
      expect(proc.exitCode).not.toBe(0);
    },
    TIMEOUT_MS,
  );
});
