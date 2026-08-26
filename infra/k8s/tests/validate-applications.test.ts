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
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/**
 * A fully VALID ArgoCD Application with a `directory` source and no Helm source.
 * Used by the zero-charts case below, which needs a tree where the ONLY thing
 * wrong is that there is nothing to render.
 */
const DIRECTORY_SOURCE_APP = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: onlydir
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/Lucent-Financial-Group/Zeta
    targetRevision: main
    path: manifests/onlydir
  destination:
    server: https://kubernetes.default.svc
    namespace: onlydir
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
`;

/** The matching App-of-Apps root, so Test 6 has a valid file to read. */
const ROOT_APP = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: zeta-root
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/Lucent-Financial-Group/Zeta
    targetRevision: main
    path: applications
    directory:
      recurse: true
      include: '{**/Application.yaml}'
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
`;

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

  // ── COVERAGE VACUITY (Test 0 + Test 9), added 2026-08-26 ───────────────────
  //
  // Every case above mutates a manifest and asserts the validator notices. These
  // two mutate the validator's INPUT SET instead — the failure mode where the
  // tool works perfectly and is simply pointed at less than it claims. Both were
  // MEASURED as silent-green on the tree at 89c8a23c40 before the fix.

  test(
    "RED when an Application sits in a file this validator cannot discover",
    () => {
      // MEASURED BEFORE THE FIX: renaming orleans/Application.yaml to
      // orleans/orleans-app.yaml dropped the file out of ALL eight tests. The
      // validator printed `Results: 32 passed, 0 failed` / `All checks passed.`
      // and exited 0, with the string "orleans" appearing ZERO times in the
      // output. Coverage silently fell by one whole Application and nothing said so.
      const { exitCode, output } = runWithMutation((appsDir) => {
        const from = appManifest(appsDir, "orleans");
        writeFileSync(join(appsDir, "orleans", "orleans-app.yaml"), readFileSync(from, "utf-8"), "utf-8");
        rmSync(from);
      });
      expect(output).toContain("contains an ArgoCD Application but NO check in this file reads it");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED under --render when the tree yields zero Helm sources to render",
    () => {
      // MEASURED BEFORE THE FIX: an apps-dir whose Applications are all
      // `directory` sources leaves `charts` empty, so Test 7 and Test 8 iterate
      // zero times. `helm template` was never invoked, kubeconform was never
      // invoked, and the validator reported `All checks passed.` / exit 0 — a
      // render lane that rendered nothing, indistinguishable from one that
      // rendered everything cleanly.
      //
      // NOTE this case does NOT need helm or kubeconform on PATH: with zero
      // charts there is nothing to render either way, and Test 9's refusal is
      // what must fire. If the tools ARE absent the validator fails earlier and
      // for a different stated reason, so the assertion below names the reason
      // rather than trusting the exit code.
      // A SYNTHETIC tree, not a mutation of the real one, and that choice is the
      // point. The first version of this case edited the seven real manifests to
      // strip their Helm sources; the edit broke YAML indentation in four of
      // them, so the run exited 1 with FIVE failures and the case passed whether
      // or not Test 9 existed — a falsifier satisfied by an earlier guard, which
      // is the defect this whole suite is here to prevent. Verified by stubbing
      // Test 9's refusal to a pass: the rewritten case below goes red, the
      // mutation-based version did not.
      const dir = mkdtempSync(join(tmpdir(), "zeta-k8s-nocharts-"));
      try {
        const appsDir = join(dir, "applications");
        mkdirSync(join(appsDir, "onlydir"), { recursive: true });
        writeFileSync(join(appsDir, "onlydir", "Application.yaml"), DIRECTORY_SOURCE_APP, "utf-8");
        writeFileSync(join(appsDir, "root-application.yaml"), ROOT_APP, "utf-8");
        const proc = Bun.spawnSync(["bun", validator, "--apps-dir", appsDir, "--render"], {
          stdout: "pipe",
          stderr: "pipe",
          cwd: repoRoot,
        });
        const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
        // Test 9's refusal must fire, and NOTHING ELSE may be failing for an
        // unrelated reason — otherwise this case would pass on somebody else's
        // red and prove nothing about Test 9. That intent is the original
        // author's and is preserved here; what changed is how it is enforced.
        //
        // IT WAS `toContain("Results: 8 passed, 1 failed")`, WHICH COULD NOT
        // PASS IN CI. `test (TS hermetic)` installs Bun and nothing else —
        // helm and kubeconform are provisioned in the separate `helm-validate`
        // job — so the validator's own tool-missing guard in
        // validate-applications.ts (the `else if (toolMissing("helm") ||
        // toolMissing("kubeconform"))` branch) emits a SECOND failure and the
        // real output is `Results: 8 passed, 2 failed`.
        //
        // MEASURED both ways on 2026-08-26: with helm+kubeconform on PATH,
        // `8 passed, 1 failed`; with them removed from PATH, `8 passed, 2
        // failed`. The CI annotation on b4b7b21a37 shows the latter. Note the
        // extra failure is printed under Test 7's heading — Test 8's guard
        // errors before printing its own — so the log misattributes it; Test 7
        // itself iterates over zero charts here and contributes nothing.
        //
        // The defect is that a COUNT couples this case to every sibling's
        // outcome AND to the toolchain of whichever tier runs it. An assertion
        // that can never hold does not read as a bug — it reads as a flake,
        // forever, to anyone who just hits rerun.
        //
        // So the failure SET is asserted instead of its cardinality: Test 9's
        // refusal must be present, and every other reported failure must be
        // the one known, declared, environment-dependent one. An unrelated red
        // still fails this case, which is what the count was protecting.
        expect(output).toContain("Test 7 and Test 8 validated nothing");

        const failures = (output.split("\nFailures:\n")[1] ?? "")
          .split("\n")
          .filter((l) => l.startsWith("  - "))
          .map((l) => l.slice(4));
        expect(failures.some((f) => f.includes("Test 7 and Test 8 validated nothing"))).toBe(true);
        const unrelated = failures.filter(
          (f) =>
            !f.includes("Test 7 and Test 8 validated nothing") &&
            // The one permitted extra, named rather than counted: this tier has
            // no helm/kubeconform, and the validator says so out loud instead
            // of going quietly green.
            !f.includes("helm and/or kubeconform is not on PATH"),
        );
        expect(unrelated).toEqual([]);
        expect(proc.exitCode).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );
});
