/**
 * infra/k8s/tests/validate-bootstrap.test.ts
 *
 * MUTATION SUITE — proves `validate-bootstrap.ts` can go RED.
 *
 * A green check is worth nothing until someone has watched it fail, and this
 * repo has caught several checks that could not (see the header of
 * `validate-applications.test.ts`). So each case here copies the REAL `infra/`
 * tree to a temp dir, applies ONE mutation, runs the validator as a
 * subprocess, and asserts BOTH exit code 1 AND the specific expected reason in
 * the output. Exit code alone is not enough: a script can exit 1 for the wrong
 * reason — a missing file, a bad argument — and still look like a check.
 *
 * `control` runs the UNMUTATED copy and asserts exit 0. Without it, a
 * validator that failed unconditionally would pass every other case here.
 *
 * The load-bearing case is "RED on the retired kustomize Kustomization": it
 * restores `infra/k8s/bootstrap/argocd-install.yaml` to its pre-2026-08-18
 * content verbatim. That content was MEASURED on real K3S v1.31.4+k3s1 to
 * leave `Addon kube-system/argocd-install` with an empty checksum and
 * `ApplyManifestFailed: the server could not find the requested resource`
 * retried every ~15s, with zero ArgoCD pods and no argoproj.io CRDs — so
 * nothing under infra/k8s/applications/ ever deployed. If that case ever goes
 * green, the guard is gone and the cluster silently stops bootstrapping again.
 *
 * No network: every case is structural and runs offline.
 */

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const validator = join(here, "validate-bootstrap.ts");
const realInfraDir = join(repoRoot, "infra");

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

/** Copy the real infra/ tree, let `mutate` edit it, run the validator on the copy. */
function runWithMutation(mutate: (infraDir: string) => void): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "zeta-k8s-bootstrap-mutation-"));
  try {
    const infraDir = join(dir, "infra");
    cpSync(realInfraDir, infraDir, { recursive: true });
    mutate(infraDir);
    const proc = Bun.spawnSync(["bun", validator, "--infra-dir", infraDir], {
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

function bootstrapFile(infraDir: string, name: string): string {
  return join(infraDir, "k8s", "bootstrap", name);
}

function k3sServerModule(infraDir: string): string {
  return join(infraDir, "nixos", "modules", "k3s-server.nix");
}

function edit(path: string, fn: (text: string) => string): void {
  writeFileSync(path, fn(readFileSync(path, "utf-8")), "utf-8");
}

/**
 * `infra/k8s/bootstrap/argocd-install.yaml` exactly as it stood on `main`
 * before 2026-08-18 (comments trimmed; the object is byte-faithful). This is
 * the shape that left the cluster inert.
 */
const RETIRED_KUSTOMIZATION = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: argocd

resources:
  - https://raw.githubusercontent.com/argoproj/argo-cd/v2.13.2/manifests/install.yaml

patches: []
`;

const TIMEOUT_MS = 20_000;

describe("validate-bootstrap mutation suite", () => {
  test(
    "control: the unmutated infra/ tree passes (so red cases mean something)",
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
    "RED on the retired kustomize Kustomization (the bug that left ArgoCD uninstalled)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        writeFileSync(bootstrapFile(infraDir, "argocd-install.yaml"), RETIRED_KUSTOMIZATION, "utf-8");
      });
      expect(output).toContain("BUILD-TIME kustomize input");
      expect(output).toContain("kustomize.config.k8s.io/v1beta1");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a declared manifest source no longer exists (rename/delete drift)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        unlinkSync(bootstrapFile(infraDir, "initial-orleans.yaml"));
      });
      expect(output).toContain("which does not exist");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a bootstrap manifest is not declared in services.k3s.manifests (inert file)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(k3sServerModule(infraDir), (text) =>
          text
            .split("\n")
            .filter((line) => !line.includes("initial-orleans.source"))
            .join("\n"),
        );
      });
      expect(output).toContain("NOT declared in services.k3s.manifests");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED on syntactically invalid YAML in a bootstrap manifest",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(bootstrapFile(infraDir, "argocd-namespace.yaml"), (text) => `${text}\n\tname: "unterminated\n`);
      });
      expect(output).toContain("YAML parse failed");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED on a duplicate mapping key (last-write-wins the API server would reject)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(bootstrapFile(infraDir, "argocd-namespace.yaml"), (text) =>
          text.replace(/^kind: Namespace$/m, "kind: Namespace\nkind: Namespace"),
        );
      });
      expect(output).toContain("YAML parse failed");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a bootstrap document has no kind",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(bootstrapFile(infraDir, "argocd-namespace.yaml"), (text) =>
          text.replace(/^kind: Namespace$/m, "notKind: Namespace"),
        );
      });
      expect(output).toContain("not a Kubernetes object");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when a bootstrap document has no metadata.name",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(bootstrapFile(infraDir, "argocd-namespace.yaml"), (text) =>
          text.replace(/^ {2}name: argocd$/m, "  nameZ: argocd"),
        );
      });
      expect(output).toContain("has no metadata.name");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED on an unpinned HelmChart (same commit, different cluster on a different day)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(bootstrapFile(infraDir, "argocd-install.yaml"), (text) => text.replace(/^ {2}version: .*$/m, ""));
      });
      expect(output).toContain("has no spec.version");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );

  test(
    "RED when the manifests roster is emptied entirely (nothing bootstraps)",
    () => {
      const { exitCode, output } = runWithMutation((infraDir) => {
        edit(k3sServerModule(infraDir), (text) =>
          text.replace(/manifests = \{[\s\S]*?\n {4}\};/, "manifests = {\n    };"),
        );
      });
      expect(output).toContain("declares no");
      expect(exitCode).toBe(1);
    },
    TIMEOUT_MS,
  );
});
