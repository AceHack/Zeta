import type { ChartInstallSpec, PackageDriver, ProcessRunner } from "../ports.ts";
import { commandSucceeded, runOptional, runOrExit } from "./spawn-process-runner.ts";

export function helmPackageDriver(runner: ProcessRunner): PackageDriver {
  return {
    releaseInstalled: (namespace, release) => commandSucceeded(runner, "helm", ["-n", namespace, "status", release]),
    addRepo: (alias, url) => runOptional(runner, "helm", ["repo", "add", alias, url]),
    updateRepo: (alias) => runOrExit(runner, "helm", ["repo", "update", alias], { stdio: "inherit" }),
    install: (spec: ChartInstallSpec) => {
      if (spec.repoAlias !== undefined && spec.repoUrl !== undefined) {
        runOptional(runner, "helm", ["repo", "add", spec.repoAlias, spec.repoUrl]);
        runOrExit(runner, "helm", ["repo", "update", spec.repoAlias], { stdio: "inherit" });
      }
      const args = ["install", spec.release, spec.chart, "--version", spec.version, "--namespace", spec.namespace];
      for (const valuesFile of spec.valuesFiles ?? []) {
        args.push("-f", valuesFile);
      }
      for (const setValue of spec.setValues) {
        args.push("--set", setValue);
      }
      if (spec.wait === true) args.push("--wait");
      runOrExit(runner, "helm", args, { stdio: "inherit" });
    },
  };
}
