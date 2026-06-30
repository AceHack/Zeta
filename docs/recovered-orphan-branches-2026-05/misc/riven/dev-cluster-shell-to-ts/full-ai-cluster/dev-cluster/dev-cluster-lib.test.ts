import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isDnsLabel,
  isGitHubRepoUrl,
  isSafeGitRef,
  parseK3dAgentCount,
  parseK3dClusterName,
} from "./dev-cluster-lib.ts";

describe("dev-cluster-lib", () => {
  test("validates git refs and repo URLs", () => {
    expect(isSafeGitRef("main")).toBe(true);
    expect(isSafeGitRef("riven/dev-cluster-shell-to-ts")).toBe(true);
    expect(isSafeGitRef("bad ref")).toBe(false);
    expect(isGitHubRepoUrl("https://github.com/Lucent-Financial-Group/Zeta")).toBe(true);
    expect(isGitHubRepoUrl("https://example.com/nope")).toBe(false);
  });

  test("validates DNS labels", () => {
    expect(isDnsLabel("zeta-ci")).toBe(true);
    expect(isDnsLabel("-bad")).toBe(false);
  });

  test("parses k3d config metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-k3d-"));
    const configPath = join(dir, "k3d.yaml");
    writeFileSync(
      configPath,
      `apiVersion: k3d.io/v1alpha5
kind: Simple
metadata:
  name: zeta-local
servers: 1
agents: 2
`,
    );
    expect(parseK3dClusterName(configPath)).toBe("zeta-local");
    expect(parseK3dAgentCount(configPath)).toBe(2);
  });
});
