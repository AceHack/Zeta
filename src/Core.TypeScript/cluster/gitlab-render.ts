/**
 * gitlab-render.ts -- the GitLab Application's chart, rendered with `helm template` exactly as ArgoCD would
 * (the Application's own chart, version, repo, namespace and values), for tests that must judge what the release
 * REALLY contains rather than the unrendered `{{ }}` text of its values.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseAllDocuments, parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readAppSource } from "./crd-provider-consumer-order.ts";
import type { Doc } from "./gitlab-exposure.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const GITLAB_APPLICATION_PATH = resolve(REPO_ROOT, "full-ai-cluster/k8s/applications/gitlab/Application.yaml");

/** The Application's `spec.source.helm.valuesObject`, unrendered. */
export function gitlabApplicationValues(): Record<string, unknown> {
  const app = parseYaml(readFileSync(GITLAB_APPLICATION_PATH, "utf8")) as { spec?: { source?: { helm?: { valuesObject?: Record<string, unknown> } } } };
  return app.spec?.source?.helm?.valuesObject ?? {};
}

let cached: { docs: Doc[] } | null = null;

/** `helm template` of the Application's release, parsed; rendered once per process. Throws when helm fails. */
export function renderGitlabRelease(): { docs: Doc[] } {
  if (cached !== null) return cached;
  const source = readAppSource(readFileSync(GITLAB_APPLICATION_PATH, "utf8"));
  const dir = mkdtempSync(join(tmpdir(), "gitlab-render-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(source.valuesObject ?? {}), "utf8");
    const result = Bun.spawnSync(
      [
        "helm", "template", source.releaseName ?? "gitlab", source.chart ?? "", "--repo", source.repoURL ?? "",
        "--version", source.version ?? "", "--namespace", source.namespace ?? "default", "--values", valuesFile,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) throw new Error(`helm template gitlab failed: ${result.stderr.toString()}`);
    cached = { docs: parseAllDocuments(result.stdout.toString()).map((d) => d.toJS({ maxAliasCount: -1 }) as Doc).filter(Boolean) };
    return cached;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
