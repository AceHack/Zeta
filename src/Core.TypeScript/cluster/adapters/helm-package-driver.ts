import type { ChartInstallSpec, PackageDriver, ProcessRunner } from "../ports.ts";
import { commandSucceeded, runOptional, runOrExit } from "./spawn-process-runner.ts";

export function helmPackageDriver(process: ProcessRunner): PackageDriver {
  return {
    releaseInstalled: (namespace, release) => commandSucceeded(process, "helm", ["-n", namespace, "status", release]),
    addRepo: (alias, url) => runOptional(process, "helm", ["repo", "add", alias, url]),
    updateRepo: (alias) => runOrExit(process, "helm", ["repo", "update", alias], { stdio: "inherit" }),
    install: (spec: ChartInstallSpec) => {
      if (spec.repoAlias !== undefined && spec.repoUrl !== undefined) {
        runOptional(process, "helm", ["repo", "add", spec.repoAlias, spec.repoUrl]);
        runOrExit(process, "helm", ["repo", "update", spec.repoAlias], { stdio: "inherit" });
      }
      const args = ["install", spec.release, spec.chart, "--version", spec.version, "--namespace", spec.namespace];
      for (const setValue of spec.setValues) {
        args.push("--set", setValue);
      }
      if (spec.wait === true) args.push("--wait");
      runOrExit(process, "helm", args, { stdio: "inherit" });
    },
  };
}
