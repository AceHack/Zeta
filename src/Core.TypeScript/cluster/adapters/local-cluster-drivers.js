import { runOrExit } from "./spawn-process-runner.js";
function runOptionsWithEnv(env, extra = {}) {
    return env === undefined ? extra : { ...extra, env };
}
export function kindLocalClusterDriver(runner, host) {
    const env = () => host.clusterDriverEnv();
    return {
        shape: "kind-in-docker",
        list: () => runner
            .run("kind", ["get", "clusters"], runOptionsWithEnv(env()))
            .stdout.split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        create: (spec) => {
            const args = ["create", "cluster", "--name", spec.name, "--config", spec.configPath];
            if (spec.waitForReady !== false) {
                args.push("--wait", `${String(spec.waitTimeoutSec ?? 180)}s`);
            }
            runOrExit(runner, "kind", args, runOptionsWithEnv(env(), { stdio: "inherit" }));
        },
        delete: (name) => runOrExit(runner, "kind", ["delete", "cluster", "--name", name], runOptionsWithEnv(env(), { stdio: "inherit" })),
        contextName: (clusterName) => `kind-${clusterName}`,
    };
}
export function k3dLocalClusterDriver(runner) {
    return {
        shape: "k3d-in-docker",
        list: () => runner
            .run("k3d", ["cluster", "list"])
            .stdout.split("\n")
            .map((line) => line.split(/\s+/)[0] ?? "")
            .filter((name) => name.length > 0 && name !== "NAME"),
        create: (spec) => runOrExit(runner, "k3d", ["cluster", "create", "--config", spec.configPath, "--wait=false"], { stdio: "inherit" }),
        delete: (name) => runOrExit(runner, "k3d", ["cluster", "delete", name], { stdio: "inherit" }),
        contextName: (clusterName) => `k3d-${clusterName}`,
        mergeCredentials: (clusterName) => runOrExit(runner, "k3d", ["kubeconfig", "merge", clusterName, "--kubeconfig-merge-default", "--kubeconfig-switch-context"], {
            stdio: "inherit",
        }),
        registryName: (clusterName) => `${clusterName}-registry`,
        deleteRegistry: (registryName) => {
            const listed = runner.run("k3d", ["registry", "list"]).stdout.split("\n");
            if (listed.some((line) => line.startsWith(`k3d-${registryName} `))) {
                runner.run("k3d", ["registry", "delete", registryName], { stdio: "inherit" });
            }
        },
    };
}
