#!/usr/bin/env bun
/**
 * Contract for the zeta-bao-unseal image recipe.
 *
 * Otto 2026-09-09: one matrix entry in build-platform-images.yml, pin the
 * published image by digest, do not fork the OpenBao chart, do not use
 * zeta-ci-runtime / alpine:latest + apk add curl, do not commit a compiled
 * binary. extraContainers pin the published digest after GHCR answers
 * 200 anonymously. Missing share cache must wait, not crash-loop.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO = join(import.meta.dir, "..", "..", "..");
const DOCKERFILE = join(REPO, "full-ai-cluster", "openbao-unseal", "Dockerfile");
const WORKFLOW = join(REPO, ".github", "workflows", "build-platform-images.yml");
const APPLICATION = join(
  REPO,
  "full-ai-cluster",
  "k8s",
  "applications",
  "openbao",
  "Application.yaml",
);
const SIDECAR = join(REPO, "src", "Core.TypeScript", "cluster", "openbao-unseal-sidecar.ts");

describe("zeta-bao-unseal image recipe", () => {
  const dockerfile = readFileSync(DOCKERFILE, "utf8");
  const workflow = readFileSync(WORKFLOW, "utf8");
  const application = readFileSync(APPLICATION, "utf8");
  const sidecar = readFileSync(SIDECAR, "utf8");

  test("the workflow matrix names zeta-bao-unseal from the sidecar Dockerfile", () => {
    expect(workflow).toContain("image: zeta-bao-unseal");
    expect(workflow).toContain("dockerfile: full-ai-cluster/openbao-unseal/Dockerfile");
    expect(workflow).toContain('dockerfile="${DOCKERFILE:-$CONTEXT/Dockerfile}"');
    expect(workflow).toContain("full-ai-cluster/openbao-unseal/**");
  });

  test("ENTRYPOINT is the bun sidecar bundle, not a shell curl loop", () => {
    expect(dockerfile).toContain('ENTRYPOINT ["bun", "/app/openbao-unseal-sidecar.js"]');
    expect(dockerfile).toContain("bun build ./openbao-unseal-sidecar.ts --target bun");
    expect(dockerfile.includes("alpine:latest")).toBe(false);
    expect(dockerfile.includes("apk add")).toBe(false);
    expect(dockerfile.includes("zeta-ci-runtime")).toBe(false);
  });

  test("base image is oven/bun pinned by digest, matching the portal major", () => {
    expect(dockerfile).toContain(
      "oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0",
    );
  });

  test("Application.yaml pins extraContainers by digest with an optional share cache", () => {
    const pin =
      "ghcr.io/lucent-financial-group/zeta-bao-unseal@sha256:51f3008f68cdc3ca02debf7726522dbefbd7f7919b2b566655dfc5d54ccc0b82";
    expect(application).toContain("extraContainers:");
    expect(application).toContain(pin);
    expect(application).toContain("secretName: openbao-unseal-shares");
    expect(application).toContain("optional: true");
    expect(application).toContain("mountPath: /etc/openbao/unseal-shares");
    expect(application.includes("zeta-bao-unseal:latest")).toBe(false);
    expect(application.includes("zeta-ci-runtime")).toBe(false);
    expect(application.includes("alpine:latest")).toBe(false);
    expect(application.includes("apk add")).toBe(false);
    expect(application.includes("extraVolumes:")).toBe(false);
  });

  test("the compiled bundle is produced at image build, not committed", () => {
    expect(dockerfile).toContain("Do not commit");
    expect(dockerfile).toContain("the compiled JS");
    const committedJs = join(
      REPO,
      "full-ai-cluster",
      "openbao-unseal",
      "openbao-unseal-sidecar.js",
    );
    expect(existsSync(committedJs)).toBe(false);
  });

  test("bun build of the sidecar succeeds and keeps the wait-not-crash entrypoint", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-bao-unseal-"));
    try {
      const outfile = join(dir, "openbao-unseal-sidecar.js");
      const result = spawnSync(
        "bun",
        ["build", SIDECAR, "--target", "bun", "--outfile", outfile],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      const bundle = readFileSync(outfile, "utf8");
      expect(bundle).toContain("import.meta.main");
      expect(bundle).toContain("threshold must be >= 2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing share cache is a wait: fetcher returns empty, sidecar does not throw", () => {
    // Otto: a sidecar that CrashLoopBackOffs on an absent cache is
    // indistinguishable from a broken store.
    expect(sidecar).toContain("Returns `[]` rather than throwing when the mount is absent");
    expect(dockerfile).toContain("Missing share cache must WAIT, not crash-loop");
  });
});
