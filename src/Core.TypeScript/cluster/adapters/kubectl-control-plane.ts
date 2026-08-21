import type { ClusterControlPlane, ProcessRunner } from "../ports.ts";
import { commandSucceeded, runOptional, runOrExit } from "./spawn-process-runner.ts";

export function kubectlControlPlane(runner: ProcessRunner): ClusterControlPlane {
  return {
    selectContext: (context) => runOrExit(runner, "kubectl", ["config", "use-context", context], { stdio: "inherit" }),
    waitForAllNodesReady: (timeoutSec) =>
      runOrExit(runner, "kubectl", ["wait", "--for=condition=Ready", "nodes", "--all", `--timeout=${timeoutSec}s`], {
        stdio: "inherit",
      }),
    waitForApiReady: (maxAttempts, pollMs) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (commandSucceeded(runner, "kubectl", ["get", "--raw=/readyz"])) return;
        Bun.sleepSync(pollMs);
      }
      runOrExit(runner, "kubectl", ["get", "--raw=/readyz"], { stdio: "inherit" });
    },
    applyRemoteManifest: (url, serverSideApply = false) => {
      const args = ["apply"];
      if (serverSideApply) args.push("--server-side");
      args.push("-f", url);
      runOrExit(runner, "kubectl", args, { stdio: "inherit" });
    },
    applyFileManifest: (path, serverSideApply = false) => {
      const args = ["apply"];
      if (serverSideApply) args.push("--server-side", "--force-conflicts");
      args.push("-f", path);
      runOrExit(runner, "kubectl", args, { stdio: "inherit" });
    },
    applyInlineManifest: (yaml) =>
      runOrExit(runner, "kubectl", ["apply", "-f", "-"], { stdin: yaml, stdio: "inherit" }),
    ensureNamespace: (name) => runOptional(runner, "kubectl", ["create", "namespace", name]),
    resourceExists: (resourceRef, namespace) => {
      const args = ["get", resourceRef];
      if (namespace !== null) args.push("-n", namespace);
      // No `stdio: inherit`: a NotFound here is an expected answer, not a
      // failure to report, and printing "Error from server" into a green
      // bring-up log is how a reader learns to ignore errors in that log.
      return commandSucceeded(runner, "kubectl", args);
    },
    waitForCrdEstablished: (crdName, timeoutSec, optional = false) => {
      const args = ["wait", "--for=condition=Established", `--timeout=${timeoutSec}s`, `crd/${crdName}`];
      if (optional) {
        runOptional(runner, "kubectl", args);
        return;
      }
      runOrExit(runner, "kubectl", args, { stdio: "inherit" });
    },
    mergePatch: (resourceRef, namespace, patchJson) => {
      const args = ["patch", resourceRef];
      if (namespace !== null) args.push("-n", namespace);
      args.push("--type=merge", "--patch", patchJson);
      runOrExit(runner, "kubectl", args, { stdio: "inherit" });
    },
    waitForResource: (resourceRef, namespace, forExpression, timeoutSec) => {
      const args = ["wait", resourceRef];
      if (namespace !== null) args.push("-n", namespace);
      args.push(`--for=${forExpression}`, `--timeout=${timeoutSec}s`);
      return runOptional(runner, "kubectl", args);
    },
    clearContextIfCurrent: (context) => {
      const current = runner.run("kubectl", ["config", "current-context"]).stdout.trim();
      if (current === context) {
        runOptional(runner, "kubectl", ["config", "unset", "current-context"]);
      }
    },
  };
}
