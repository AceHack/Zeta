/**
 * root-tracks-main.test.ts - docs/ops/INSTALL-TIME-CONFIG.md row 22,
 * docs/DECISIONS/2026-10-01-the-cluster-tracks-main-while-the-os-is-pinned-to-the-iso-commit.md.
 *
 * The OS is pinned to the ISO commit; the cluster follows `main` HEAD. That is the design, not an
 * oversight, and it is recorded in an ADR. These tests make it a CHECKED statement: if the root or an
 * install-time Application stops tracking `main` (or starts tracking a SHA), this fails until the ADR
 * is amended - a silent change to the delivery model cannot ride in with an unrelated edit.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { LB_POOL_TEMPLATE } from "./lb-ipam-pool.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const ADR = "docs/DECISIONS/2026-10-01-the-cluster-tracks-main-while-the-os-is-pinned-to-the-iso-commit.md";
const REPO_URL = "https://github.com/Lucent-Financial-Group/Zeta";

const source = (rel: string) => (parseYaml(readFileSync(join(REPO_ROOT, rel), "utf8")) as Record<string, any>).spec.source as Record<string, any>;

describe("the cluster layer tracks main", () => {
  test("the app-of-apps root tracks `main` of the canonical repo", () => {
    const s = source("full-ai-cluster/k8s/bootstrap/root-application.yaml");
    expect(s.repoURL).toBe(REPO_URL);
    expect(s.targetRevision).toBe("main");
  });

  test("so do the install-time Applications the Nix modules render (they must resolve the same tree the root does)", () => {
    for (const t of ["full-ai-cluster/k8s/public-tls/argocd-application.yaml.in", LB_POOL_TEMPLATE]) {
      const s = parseYaml(readFileSync(join(REPO_ROOT, t), "utf8").replaceAll(/@ZETA_[A-Z_]+@/g, "x")) as Record<string, any>;
      expect(s.spec.source.repoURL).toBe(REPO_URL);
      expect(s.spec.source.targetRevision).toBe("main");
    }
  });

  test("no git-path Application pins a commit SHA: one delivery model, not two", () => {
    const apps = join(REPO_ROOT, "full-ai-cluster/k8s/applications");
    const bad: string[] = [];
    const walk = (dir: string): string[] => {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name === "Application.yaml" ? [join(dir, e.name)] : []));
    };
    for (const f of walk(apps)) {
      const s = (parseYaml(readFileSync(f, "utf8")) as Record<string, any>)?.spec?.source as Record<string, any> | undefined;
      if (s?.repoURL === REPO_URL && /^[0-9a-f]{40}$/i.test(String(s.targetRevision))) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

describe("the decision is written down, and the installer says it on every install", () => {
  test("the ADR exists and names its evidence", () => {
    // One read, no existence pre-check: a missing ADR is the failure, reported by the read itself.
    const text = readFileSync(join(REPO_ROOT, ADR), "utf8");
    for (const evidence of ["root-application.yaml", "2026-07-09-drift-and-heal", "repo-pin.ts", "lane-tree-source.ts"]) {
      expect(text).toContain(evidence);
    }
  });

  test("the completion banner states the two-tree asymmetry", () => {
    const install = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh"), "utf8");
    expect(install).toContain("TWO TREES, BY DESIGN");
    expect(install).toContain("follow github.com/Lucent-Financial-Group/Zeta 'main' HEAD");
  });
});
