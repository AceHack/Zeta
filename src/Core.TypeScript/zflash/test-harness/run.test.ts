import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { exitCodeForResults, isPassing, runPathForkRuntime, runRetentionRuntime, type ScenarioResult } from "./run";
import type { Qcow2RetentionExecutionStep, QemuCommand, QemuCommandExecution } from "./qemu-state";
import { qemuUsbStorageDeviceArg } from "../../installer/qemu-usb-storage.ts";

const SCRIPT = join(import.meta.dir, "run.ts");

function run(...args: string[]): { readonly stdout: string; readonly stderr: string; readonly exitCode: number } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun is intentionally resolved from the active PATH; args are structured and never shell-expanded.
  const result = spawnSync("bun", [SCRIPT, ...args], {
    encoding: "utf-8",
  });
  return {
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    exitCode: result.status ?? 1,
  };
}

function successfulExecution(step: Qcow2RetentionExecutionStep, command: QemuCommand): QemuCommandExecution {
  return { step, command, exitCode: 0, stdout: `${step} ok`, stderr: "" };
}

function zflashUsbDeviceArg(): string {
  const usb = qemuUsbStorageDeviceArg("zflashboot");
  if (!usb.ok) throw new Error(usb.error);
  return usb.device;
}

describe("081KSNY2Z0008QG0R0008PN7RQ test-harness dispatcher", () => {
  test("dry-run can inspect scaffolded retention without claiming runtime success", () => {
    const result = run("--dry-run", "--scenario", "reformat-with-retention");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.mode).toBe("dry-run");
    expect(parsed.targets[0].id).toBe("reformat-with-retention");
    expect(parsed.targets[0].plan).toContain("auto-prepare zflash boot image");
  });

  test("runtime attempt for retention emits QEMU plan but fails closed", () => {
    const result = run("--scenario", "reformat-with-retention", "/tmp/nonexistent.iso");
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout);
    const diskPath = parsed.results[0].qemuRetentionPlan.diskPath;
    expect(diskPath.endsWith("nonexistent.iso.scenario3.qcow2")).toBe(true);
    expect(diskPath).not.toBe("/tmp/nonexistent.iso.scenario3.qcow2");
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.scaffolded).toBe(0);
    expect(parsed.results[0].status).toBe("failed");
    expect(parsed.results[0].message).toContain("fails closed");
    expect(parsed.results[0].message).toContain("ZFLASH_QEMU_RETENTION_EXECUTE=1");
    expect(parsed.results[0].qemuRetentionPlan.createDiskImage.args).toEqual([
      "create",
      "-f",
      "qcow2",
      diskPath,
      "20G",
    ]);
    expect(parsed.results[0].qemuRetentionPlan.initialInstallFromIsoWithDisk.args).toContain(
      `file=${diskPath},if=virtio,format=qcow2`,
    );
    expect(parsed.results[0].qemuRetentionPlan.createBaselineSnapshot.args).toEqual([
      "snapshot",
      "-c",
      "post-initial-format",
      diskPath,
    ]);
    expect(parsed.results[0].qemuRetentionPlan.restoreBaselineSnapshot.args).toContain(diskPath);
    expect(parsed.results[0].qemuRetentionPlan.restartFromIsoWithDisk.args).toContain(
      `file=${diskPath},if=virtio,format=qcow2`,
    );
    expect(parsed.results[0].qemuRetentionPlan.requiredSerialMarkers).toContain("already-present");
  });

  test("dry-run can inspect scaffolded path-fork without claiming runtime success", () => {
    const result = run("--dry-run", "--scenario", "reformat-from-scratch");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.mode).toBe("dry-run");
    expect(parsed.targets[0].id).toBe("reformat-from-scratch");
    expect(parsed.targets[0].plan).toContain("path-fork plan");
    expect(parsed.targets[0].plan).toContain("auto-prepare zflash boot image");
  });

  test("runtime attempt for path-fork emits migrate + fresh plans but fails closed", () => {
    const result = run("--scenario", "reformat-from-scratch", "/tmp/nonexistent.iso");
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout);
    const scenarioResult = parsed.results[0];
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.scaffolded).toBe(0);
    expect(scenarioResult.status).toBe("failed");
    expect(scenarioResult.message).toContain("fails closed");
    expect(scenarioResult.message).toContain("ZFLASH_QEMU_PATH_FORK_EXECUTE=1");
    expect(scenarioResult.message).toContain("zflash-prepared boot image");
    expect(scenarioResult.pathForkPlan.forks).toHaveLength(2);

    const migrate = scenarioResult.pathForkPlan.forks.find(
      (fork: { forkId: string }) => fork.forkId === "migrate-existing-creds",
    );
    const fresh = scenarioResult.pathForkPlan.forks.find((fork: { forkId: string }) => fork.forkId === "fresh-cluster");
    expect(migrate).toBeDefined();
    expect(fresh).toBeDefined();
    expect(migrate.missingRuntimeRequirements).toContain("zflash-prepared boot image containing /zeta-creds.enc");
    expect(migrate.qemuBootCommand).toBeUndefined();
    expect(migrate.requiredSerialMarkers.join(" ")).toContain("found pre-baked zeta-creds.enc");
    expect(fresh.requiredSerialMarkers.join(" ")).toContain("no pre-baked zeta-creds.enc");
    expect(fresh.forbiddenSerialMarkers.join(" ")).toContain("found pre-baked zeta-creds.enc");
    expect(fresh.missingRuntimeRequirements).toContain("zflash-prepared boot image without /zeta-creds.enc");
    expect(fresh.qemuBootCommand.args).toContain("-cdrom");
    expect(fresh.qemuBootCommand.args).toContain(resolve("/tmp/nonexistent.iso"));
  });

  test("path-fork runtime can plan against explicit zflash-prepared boot images", () => {
    const runDirectory = resolve("/tmp/zeta-path-fork-run");
    const result = runPathForkRuntime("/tmp/zeta.iso", {
      bootImagePath: "/tmp/zflash-boot.img",
      freshBootImagePath: "/tmp/zflash-boot-fresh.img",
      runDirectory,
    });

    expect(result.status).toBe("failed");
    expect(result.pathForkPlan?.bootImagePath).toBe("/tmp/zflash-boot.img");
    expect(result.pathForkPlan?.freshBootImagePath).toBe("/tmp/zflash-boot-fresh.img");
    expect(result.pathForkPlan?.startingDiskPath).toBe(join(runDirectory, "zeta.iso.scenario4.qcow2"));
    const migrate = result.pathForkPlan?.forks.find((fork) => fork.forkId === "migrate-existing-creds");
    const fresh = result.pathForkPlan?.forks.find((fork) => fork.forkId === "fresh-cluster");
    expect(migrate?.missingRuntimeRequirements).toEqual([]);
    expect(migrate?.qemuBootCommand?.args).toContain(
      "file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot",
    );
    expect(migrate?.qemuBootCommand?.args).toContain(zflashUsbDeviceArg());
    expect(fresh?.missingRuntimeRequirements).toEqual([]);
    expect(fresh?.qemuBootCommand?.args).not.toContain("-cdrom");
    expect(fresh?.qemuBootCommand?.args).toContain(
      "file=/tmp/zflash-boot-fresh.img,if=none,format=raw,readonly=on,id=zflashboot",
    );
  });

  test("retention runtime executes through an injected QEMU executor when explicitly enabled", () => {
    const observedSteps: Qcow2RetentionExecutionStep[] = [];
    const result = runRetentionRuntime("/tmp/zeta.iso", {
      execute: true,
      executor: {
        runCommand: (step, command) => {
          observedSteps.push(step);
          return successfulExecution(step, command);
        },
        runCommandUntilSerialMarkers: (step, command) => {
          observedSteps.push(step);
          return successfulExecution(step, command);
        },
        readSerialOutput: () =>
          [
            "zeta-creds-restore: reading preserved ESP blob",
            "zeta-creds-restore: already-present, skipping credential rewrite",
          ].join("\n"),
      },
    });

    expect(result.status).toBe("passed");
    expect(observedSteps).toEqual([
      "create-disk-image",
      "initial-install-from-iso-with-disk",
      "create-baseline-snapshot",
      "list-baseline-snapshots",
      "restore-baseline-snapshot",
      "restart-from-iso-with-disk",
    ]);
    expect(result.qemuRetentionExecution).toBeDefined();
    if (result.qemuRetentionExecution && "ok" in result.qemuRetentionExecution) {
      expect(result.qemuRetentionExecution.ok.serialAssertion.matchedMarkers).toContain("already-present");
    } else {
      throw new Error("expected retention execution success");
    }
  });

  test("retention runtime can plan against an explicit zflash-prepared boot image", () => {
    const result = runRetentionRuntime("/tmp/zeta.iso", {
      bootImagePath: "/tmp/zflash-boot.img",
    });

    expect(result.status).toBe("failed");
    expect(result.qemuRetentionPlan?.bootImagePath).toBe("/tmp/zflash-boot.img");
    expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain(
      "file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot",
    );
    expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain("qemu-xhci,id=xhci");
    expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain(zflashUsbDeviceArg());
    expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).not.toContain("-cdrom");
    for (const marker of [
      "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
      "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry",
    ]) {
      expect(result.qemuRetentionPlan?.requiredSerialMarkers).toContain(marker);
    }
  });

  test("retention runtime writes scenario artifacts under a writable run directory", () => {
    const runDirectory = resolve("/tmp/zeta-retention-run");
    const result = runRetentionRuntime("/nix/store/read-only/zeta.iso", {
      runDirectory,
    });

    expect(result.status).toBe("failed");
    expect(result.qemuRetentionPlan?.diskPath).toBe(join(runDirectory, "zeta.iso.scenario3.qcow2"));
    expect(result.qemuRetentionPlan?.serialLogPath).toBe(join(runDirectory, "zeta.iso.scenario3.serial.log"));
    expect(result.qemuRetentionPlan?.diskPath.startsWith(resolve("/nix/store/read-only"))).toBe(false);
  });

  test("path-fork runtime executes through an injected QEMU executor when explicitly enabled", () => {
    const result = runPathForkRuntime("/tmp/zeta.iso", {
      execute: true,
      bootImagePath: "/tmp/zflash-boot.img",
      freshBootImagePath: "/tmp/zflash-boot-fresh.img",
      executor: {
        runCommand: successfulExecution,
        runCommandUntilSerialMarkers: successfulExecution,
        readSerialOutput: (path) => {
          if (path.includes("migrate.serial.log")) {
            return [
              "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
              "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry",
            ].join("\n");
          }
          return [
            "[081KSNY2Z0008QG0R0008PN7RQ-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal",
          ].join("\n");
        },
      },
    });

    expect(result.status).toBe("passed");
    expect(result.pathForkExecution).toBeDefined();
    if (result.pathForkExecution && "ok" in result.pathForkExecution) {
      expect(result.pathForkExecution.ok.forkExecutions).toHaveLength(2);
    } else {
      throw new Error("expected path-fork execution success");
    }
  });

  // --- exit-code truth rule: only "passed" is green -----------------------
  // Regression guard for the false-green class: run.ts used to count only
  // "failed" + "scaffolded" as non-zero, so `--all` exited 0 while silently
  // omitting cluster-joining — scenario 5 of 5 — as "skipped".

  function scenarioResult(id: ScenarioResult["id"], status: ScenarioResult["status"]): ScenarioResult {
    return { id, status };
  }

  test("a skipped scenario is not a pass", () => {
    expect(isPassing(scenarioResult("cluster-joining", "skipped"))).toBe(false);
    expect(isPassing(scenarioResult("cluster-joining", "scaffolded"))).toBe(false);
    expect(isPassing(scenarioResult("cluster-joining", "failed"))).toBe(false);
    expect(isPassing(scenarioResult("cluster-joining", "passed"))).toBe(true);
  });

  test("exit code is 0 only when every executed scenario passed", () => {
    expect(exitCodeForResults([scenarioResult("initial-format", "passed")])).toBe(0);
    expect(
      exitCodeForResults([
        scenarioResult("initial-format", "passed"),
        scenarioResult("boot-cluster-up", "passed"),
        scenarioResult("reformat-with-retention", "passed"),
        scenarioResult("reformat-from-scratch", "passed"),
        scenarioResult("cluster-joining", "passed"),
      ]),
    ).toBe(0);
  });

  test("exit code is 1 when a scenario is skipped, even if all others passed", () => {
    expect(
      exitCodeForResults([
        scenarioResult("initial-format", "passed"),
        scenarioResult("boot-cluster-up", "passed"),
        scenarioResult("reformat-with-retention", "passed"),
        scenarioResult("reformat-from-scratch", "passed"),
        scenarioResult("cluster-joining", "skipped"),
      ]),
    ).toBe(1);
    expect(exitCodeForResults([scenarioResult("cluster-joining", "scaffolded")])).toBe(1);
    expect(exitCodeForResults([scenarioResult("initial-format", "failed")])).toBe(1);
  });

  test("--scenario cluster-joining exits non-zero and says out loud that it did not run", () => {
    const result = run("--scenario", "cluster-joining", "/tmp/nonexistent.iso");
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.results[0].id).toBe("cluster-joining");
    expect(parsed.results[0].status).toBe("skipped");
    expect(parsed.results[0].message).toContain("NOT RUN");
    expect(parsed.summary.skipped).toBe(1);
    expect(parsed.summary.nonPassing).toBe(1);
    expect(result.stderr).toContain("cluster-joining=skipped");
  });

  test("--dry-run still exits 0 — it claims only that the plan is well-formed", () => {
    const result = run("--dry-run");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.targets).toHaveLength(5);
  });

  test("retention runtime stays failed when QEMU output does not prove retention", () => {
    const result = runRetentionRuntime("/tmp/zeta.iso", {
      execute: true,
      executor: {
        runCommand: successfulExecution,
        runCommandUntilSerialMarkers: successfulExecution,
        readSerialOutput: () => "zeta-creds-restore: restored credentials",
      },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("serial output did not prove retention");
    expect(result.qemuRetentionExecution).toBeDefined();
    if (result.qemuRetentionExecution && "error" in result.qemuRetentionExecution) {
      expect(result.qemuRetentionExecution.error.kind).toBe("serial-marker-failed");
    } else {
      throw new Error("expected retention execution failure");
    }
  });
});
