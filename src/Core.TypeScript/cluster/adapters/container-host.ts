import type { ContainerHost, ContainerHostKind, ProcessRunner } from "../ports.ts";
import { commandSucceeded } from "./spawn-process-runner.ts";

export function containerHostAdapter(kind: ContainerHostKind, process: ProcessRunner): ContainerHost {
  return {
    kind,
    probe: () => commandSucceeded(process, kind, ["--version"]),
    clusterDriverEnv: () => (kind === "podman" ? { KIND_EXPERIMENTAL_PROVIDER: "podman" } : undefined),
  };
}

export function installHintForTool(tool: string, repoRoot: string): string {
  switch (tool) {
    case "docker":
      return "  Docker Desktop or Colima (https://docs.docker.com/desktop/install/mac-install/)";
    case "podman":
      return "  Podman Desktop or: brew install podman && podman machine init && podman machine start";
    default:
      return `  bun "${repoRoot}/tools/setup/install.sh"\n  # installs kind/k3d/kubectl/helm from the repo's .mise.toml`;
  }
}

export function assertContainerHostReady(host: ContainerHost, repoRoot: string): void {
  if (host.probe()) return;
  console.error(`ERROR: ${host.kind} not found. Install with:`);
  console.error(installHintForTool(host.kind, repoRoot));
  process.exit(1);
}

export function assertProcessToolReady(process: ProcessRunner, tool: string, repoRoot: string): void {
  if (commandSucceeded(process, tool, ["--version"])) return;
  console.error(`ERROR: ${tool} not found. Install with:`);
  console.error(installHintForTool(tool, repoRoot));
  process.exit(1);
}
