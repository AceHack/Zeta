import type { ContainerHost, LocalClusterCreateSpec, LocalClusterDriver, ProcessRunner } from "../ports.ts";
import { runOrExit } from "./spawn-process-runner.ts";

export function kindLocalClusterDriver(process: ProcessRunner, host: ContainerHost): LocalClusterDriver {
  const envOptions = (): { env?: NodeJS.ProcessEnv } => {
    const env = host.clusterDriverEnv();
    return env === undefined ? {} : { env };
  };

  return {
    shape: "kind-in-docker",
    list: () =>
      process
        .run("kind", ["get", "clusters"], envOptions())
        .stdout.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    create: (spec: LocalClusterCreateSpec) => {
      const args = ["create", "cluster", "--name", spec.name, "--config", spec.configPath];
      if (spec.waitForReady !== false) {
        args.push("--wait", `${String(spec.waitTimeoutSec ?? 180)}s`);
      }
      runOrExit(process, "kind", args, { ...envOptions(), stdio: "inherit" });
    },
    delete: (name) =>
      runOrExit(process, "kind", ["delete", "cluster", "--name", name], { ...envOptions(), stdio: "inherit" }),
    contextName: (clusterName) => `kind-${clusterName}`,
  };
}

export function k3dLocalClusterDriver(process: ProcessRunner): LocalClusterDriver {
  return {
    shape: "k3d-in-docker",
    list: () =>
      process
        .run("k3d", ["cluster", "list"])
        .stdout.split("\n")
        .map((line) => line.split(/\s+/)[0] ?? "")
        .filter((name) => name.length > 0 && name !== "NAME"),
    create: (spec) =>
      runOrExit(process, "k3d", ["cluster", "create", "--config", spec.configPath, "--wait=false"], {
        stdio: "inherit",
      }),
    delete: (name) => runOrExit(process, "k3d", ["cluster", "delete", name], { stdio: "inherit" }),
    contextName: (clusterName) => `k3d-${clusterName}`,
    mergeCredentials: (clusterName) =>
      runOrExit(
        process,
        "k3d",
        ["kubeconfig", "merge", clusterName, "--kubeconfig-merge-default", "--kubeconfig-switch-context"],
        {
          stdio: "inherit",
        },
      ),
    registryName: (clusterName) => `${clusterName}-registry`,
    deleteRegistry: (registryName) => {
      const listed = process.run("k3d", ["registry", "list"]).stdout.split("\n");
      if (listed.some((line) => line.startsWith(`k3d-${registryName} `))) {
        process.run("k3d", ["registry", "delete", registryName], { stdio: "inherit" });
      }
    },
  };
}
