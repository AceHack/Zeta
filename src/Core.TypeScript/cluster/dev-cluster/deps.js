import { containerHostAdapter, assertContainerHostReady, assertProcessToolReady } from "../adapters/container-host.js";
import { gitOpsAppCatalog } from "../adapters/gitops-app-catalog.js";
import { helmPackageDriver } from "../adapters/helm-package-driver.js";
import { kindLocalClusterDriver, k3dLocalClusterDriver } from "../adapters/local-cluster-drivers.js";
import { kubectlControlPlane } from "../adapters/kubectl-control-plane.js";
import { SpawnProcessRunner } from "../adapters/spawn-process-runner.js";
import { REPO_ROOT } from "./lib.js";
export function liveDevClusterPorts(options) {
    const runner = new SpawnProcessRunner();
    const containerHostKind = options.containerHostKind ?? resolveContainerHostKindFromEnv();
    const containerHost = containerHostAdapter(containerHostKind, runner);
    const controlPlane = kubectlControlPlane(runner);
    const localCluster = options.clusterShape === "kind-in-docker"
        ? kindLocalClusterDriver(runner, containerHost)
        : k3dLocalClusterDriver(runner);
    return {
        process: runner,
        containerHost,
        localCluster,
        controlPlane,
        packages: helmPackageDriver(runner),
        appCatalog: gitOpsAppCatalog(controlPlane),
    };
}
export function assertKindCiStackReady(ports) {
    assertContainerHostReady(ports.containerHost, REPO_ROOT);
    assertProcessToolReady(ports.process, "kind", REPO_ROOT);
    assertProcessToolReady(ports.process, "kubectl", REPO_ROOT);
    assertProcessToolReady(ports.process, "helm", REPO_ROOT);
}
export function assertK3dDevStackReady(ports) {
    assertContainerHostReady(ports.containerHost, REPO_ROOT);
    assertProcessToolReady(ports.process, "k3d", REPO_ROOT);
    assertProcessToolReady(ports.process, "kubectl", REPO_ROOT);
    assertProcessToolReady(ports.process, "helm", REPO_ROOT);
}
function resolveContainerHostKindFromEnv() {
    if (process.env.CONTAINER_RUNTIME !== undefined && process.env.CONTAINER_RUNTIME !== "") {
        console.error("ERROR: CONTAINER_RUNTIME is not supported; use ZETA_CONTAINER_RUNTIME");
        process.exit(1);
    }
    const raw = process.env.ZETA_CONTAINER_RUNTIME ?? "docker";
    if (raw === "docker" || raw === "podman")
        return raw;
    console.error(`ERROR: ZETA_CONTAINER_RUNTIME must be docker or podman (got: '${raw}')`);
    process.exit(1);
}
