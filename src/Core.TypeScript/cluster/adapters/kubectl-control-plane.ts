import type { ClusterControlPlane, ProcessRunner } from "../ports.ts";
import { commandSucceeded, runOptional, runOrExit } from "./spawn-process-runner.ts";

export function kubectlControlPlane(process: ProcessRunner): ClusterControlPlane {
  return {
    selectContext: (context) => runOrExit(process, "kubectl", ["config", "use-context", context], { stdio: "inherit" }),
    waitForAllNodesReady: (timeoutSec) =>
      runOrExit(process, "kubectl", ["wait", "--for=condition=Ready", "nodes", "--all", `--timeout=${timeoutSec}s`], {
        stdio: "inherit",
      }),
    waitForApiReady: (maxAttempts, pollMs) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (commandSucceeded(process, "kubectl", ["get", "--raw=/readyz"])) return;
        Bun.sleepSync(pollMs);
      }
      runOrExit(process, "kubectl", ["get", "--raw=/readyz"], { stdio: "inherit" });
    },
    applyRemoteManifest: (url, serverSideApply = false) => {
      const args = ["apply"];
      if (serverSideApply) args.push("--server-side");
      args.push("-f", url);
      runOrExit(process, "kubectl", args, { stdio: "inherit" });
    },
    applyFileManifest: (path) => runOrExit(process, "kubectl", ["apply", "-f", path], { stdio: "inherit" }),
    applyInlineManifest: (yaml) =>
      runOrExit(process, "kubectl", ["apply", "-f", "-"], { stdin: yaml, stdio: "inherit" }),
    ensureNamespace: (name) => runOptional(process, "kubectl", ["create", "namespace", name]),
    waitForCrdEstablished: (crdName, timeoutSec, optional = false) => {
      const args = ["wait", "--for=condition=Established", `--timeout=${timeoutSec}s`, `crd/${crdName}`];
      if (optional) {
        runOptional(process, "kubectl", args);
        return;
      }
      runOrExit(process, "kubectl", args, { stdio: "inherit" });
    },
    clearContextIfCurrent: (context) => {
      const current = process.run("kubectl", ["config", "current-context"]).stdout.trim();
      if (current === context) {
        runOptional(process, "kubectl", ["config", "unset", "current-context"]);
      }
    },
  };
}
