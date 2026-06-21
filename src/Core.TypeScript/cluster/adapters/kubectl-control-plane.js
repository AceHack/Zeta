import { commandSucceeded, runOptional, runOrExit } from "./spawn-process-runner.js";
export function kubectlControlPlane(runner) {
    return {
        selectContext: (context) => runOrExit(runner, "kubectl", ["config", "use-context", context], { stdio: "inherit" }),
        waitForAllNodesReady: (timeoutSec) => runOrExit(runner, "kubectl", ["wait", "--for=condition=Ready", "nodes", "--all", `--timeout=${timeoutSec}s`], {
            stdio: "inherit",
        }),
        waitForApiReady: (maxAttempts, pollMs) => {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                if (commandSucceeded(runner, "kubectl", ["get", "--raw=/readyz"]))
                    return;
                Bun.sleepSync(pollMs);
            }
            runOrExit(runner, "kubectl", ["get", "--raw=/readyz"], { stdio: "inherit" });
        },
        applyRemoteManifest: (url, serverSideApply = false) => {
            const args = ["apply"];
            if (serverSideApply)
                args.push("--server-side");
            args.push("-f", url);
            runOrExit(runner, "kubectl", args, { stdio: "inherit" });
        },
        applyFileManifest: (path) => runOrExit(runner, "kubectl", ["apply", "-f", path], { stdio: "inherit" }),
        applyInlineManifest: (yaml) => runOrExit(runner, "kubectl", ["apply", "-f", "-"], { stdin: yaml, stdio: "inherit" }),
        ensureNamespace: (name) => runOptional(runner, "kubectl", ["create", "namespace", name]),
        waitForCrdEstablished: (crdName, timeoutSec, optional = false) => {
            const args = ["wait", "--for=condition=Established", `--timeout=${timeoutSec}s`, `crd/${crdName}`];
            if (optional) {
                runOptional(runner, "kubectl", args);
                return;
            }
            runOrExit(runner, "kubectl", args, { stdio: "inherit" });
        },
        clearContextIfCurrent: (context) => {
            const current = runner.run("kubectl", ["config", "current-context"]).stdout.trim();
            if (current === context) {
                runOptional(runner, "kubectl", ["config", "unset", "current-context"]);
            }
        },
    };
}
