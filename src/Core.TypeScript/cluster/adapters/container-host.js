import { commandSucceeded } from "./spawn-process-runner.js";
export function containerHostAdapter(kind, runner) {
    return {
        kind,
        probe: () => commandSucceeded(runner, kind, ["--version"]),
        clusterDriverEnv: () => (kind === "podman" ? { KIND_EXPERIMENTAL_PROVIDER: "podman" } : undefined),
    };
}
export function installHintForTool(tool, repoRoot) {
    switch (tool) {
        case "docker":
            return "  Docker Desktop or Colima (https://docs.docker.com/desktop/install/mac-install/)";
        case "podman":
            return "  Podman Desktop or: brew install podman && podman machine init && podman machine start";
        default:
            return `  bun "${repoRoot}/tools/setup/install.sh"\n  # installs kind/k3d/kubectl/helm from the repo's .mise.toml`;
    }
}
export function assertContainerHostReady(host, repoRoot) {
    if (host.probe())
        return;
    console.error(`ERROR: ${host.kind} not found. Install with:`);
    console.error(installHintForTool(host.kind, repoRoot));
    process.exit(1);
}
function versionArgsForTool(tool) {
    switch (tool) {
        case "kubectl":
            return ["version", "--client=true"];
        case "helm":
            return ["version", "--short"];
        default:
            return ["--version"];
    }
}
export function assertProcessToolReady(runner, tool, repoRoot) {
    if (commandSucceeded(runner, tool, versionArgsForTool(tool)))
        return;
    console.error(`ERROR: ${tool} not found. Install with:`);
    console.error(installHintForTool(tool, repoRoot));
    process.exit(1);
}
