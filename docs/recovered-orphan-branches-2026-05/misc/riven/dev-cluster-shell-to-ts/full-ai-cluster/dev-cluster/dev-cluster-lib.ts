#!/usr/bin/env bun
// Shared helpers for dev-cluster bring-up/teardown scripts.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_CLUSTER_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(DEV_CLUSTER_DIR, "..", "..");

const GITHUB_REPO_URL =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;

export type ContainerRuntime = "docker" | "podman";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function run(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

export function runCapture(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
  return result.stdout;
}

export function runOptional(command: string, args: readonly string[]): boolean {
  const result = spawnSync(command, args, { stdio: "inherit" });
  return result.status === 0;
}

export function captureOptional(command: string, args: readonly string[]): string | null {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout;
}

export function commandSucceeded(command: string, args: readonly string[]): boolean {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0;
}

export function isDnsLabel(value: string): boolean {
  return /^[a-z\d]([-a-z\d]*[a-z\d])?$/.test(value);
}

export function isSafeGitRef(value: string): boolean {
  return (
    /^[A-Za-z\d._/-]+$/.test(value) &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    !value.includes("//")
  );
}

export function isGitHubRepoUrl(value: string): boolean {
  return GITHUB_REPO_URL.test(value);
}

export function assertSafeGitRef(gitRef: string): void {
  if (!isSafeGitRef(gitRef)) {
    fail(`ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${gitRef}')`);
  }
}

export function assertGitHubRepoUrl(gitRepoUrl: string): void {
  if (!isGitHubRepoUrl(gitRepoUrl)) {
    fail(`ERROR: git repo URL must be an https://github.com/<owner>/<repo> URL (got: '${gitRepoUrl}')`);
  }
}

export function assertDnsLabel(name: string, label: string): void {
  if (!isDnsLabel(name)) {
    fail(`ERROR: ${label} must be a DNS label (got: '${name}')`);
  }
}

export function assertFileExists(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`ERROR: ${label} not found: ${path}`);
  }
}

export function rejectLegacyContainerRuntimeEnv(): void {
  if (process.env.CONTAINER_RUNTIME !== undefined && process.env.CONTAINER_RUNTIME !== "") {
    fail("ERROR: CONTAINER_RUNTIME is not supported; use ZETA_CONTAINER_RUNTIME");
  }
}

export function containerRuntime(): ContainerRuntime {
  rejectLegacyContainerRuntimeEnv();
  const raw = process.env.ZETA_CONTAINER_RUNTIME ?? "docker";
  if (raw === "docker" || raw === "podman") return raw;
  fail(`ERROR: ZETA_CONTAINER_RUNTIME must be docker or podman (got: '${raw}')`);
}

export function kindRuntimeEnv(runtime: ContainerRuntime): NodeJS.ProcessEnv | undefined {
  if (runtime === "podman") return { KIND_EXPERIMENTAL_PROVIDER: "podman" };
  return undefined;
}

export function installHint(command: string): string {
  switch (command) {
    case "docker":
      return "  Docker Desktop or Colima (https://docs.docker.com/desktop/install/mac-install/)";
    case "podman":
      return "  Podman Desktop or: brew install podman && podman machine init && podman machine start";
    default:
      return `  bun "${join(REPO_ROOT, "tools/setup/install.sh")}"\n  # installs kind/k3d/kubectl/helm from the repo's .mise.toml`;
  }
}

export function assertCommandExists(commands: readonly string[], runtime?: ContainerRuntime): void {
  for (const cmd of commands) {
    const probe = cmd === "docker" || cmd === "podman" ? (runtime ?? cmd) : cmd;
    const result = spawnSync(probe, ["--version"], { encoding: "utf8" });
    if (result.status !== 0) {
      console.error(`ERROR: ${probe} not found. Install with:`);
      console.error(installHint(probe));
      process.exit(1);
    }
  }
}

export function parseK3dClusterName(configPath: string): string {
  const text = readFileSync(configPath, "utf8");
  let inMetadata = false;
  for (const line of text.split("\n")) {
    if (/^metadata:\s*$/.test(line)) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^[^\s]/.test(line)) break;
    if (inMetadata) {
      const match = line.match(/^\s+name:\s*(\S+)/);
      if (match) return match[1]!;
    }
  }
  fail(`ERROR: k3d config metadata.name not found: ${configPath}`);
}

export function parseK3dAgentCount(configPath: string): number {
  const text = readFileSync(configPath, "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*agents:\s*(\d+)\s*$/);
    if (match) return Number(match[1]);
  }
  return 0;
}

export function readFlagValue(argv: readonly string[], index: number, flag: string): string | null {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    console.error(`usage: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}
