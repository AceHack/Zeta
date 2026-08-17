import { describe, expect, test } from "bun:test";
import {
  buildQemuNetworkDeviceArgs,
  buildQemuSystemBootArgs,
  DEFAULT_QEMU_NETWORK_DEVICES,
  type QemuNetworkDevice,
  assertHostnameAutogenerationSerialMarkers,
  assertHostnameInjectionSerialMarkers,
  assertRetentionSerialMarkers,
  assertFirstSessionSerialMarkers,
  assertHappyPathFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  B0891_RETENTION_USB_SERIAL_MARKERS,
  HOSTNAME_AUTOGENERATION_SERIAL_MARKERS,
  HOSTNAME_INJECTION_SERIAL_MARKERS,
  createSpawnSyncQcow2RetentionExecutor,
  executeQcow2SnapshotRetentionPlan,
  INITIAL_INSTALL_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  planQcow2SnapshotRetention,
  restartRetentionSerialMarkers,
  RETENTION_FAILURE_SERIAL_MARKERS,
  RETENTION_SERIAL_MARKERS,
  type Qcow2SnapshotRetentionPlan,
  type Qcow2RetentionExecutionStep,
  type ManagedQemuCommandProcess,
  type QemuCommand,
  type QemuCommandExecution,
  type SpawnSyncQemuCommandOptions,
} from "./qemu-state";
import { qemuUsbStorageDeviceArg } from "../../installer/qemu-usb-storage.ts";

function retentionPlan(): Qcow2SnapshotRetentionPlan {
  const result = planQcow2SnapshotRetention({
    isoPath: "/tmp/zeta.iso",
    diskPath: "/tmp/zeta.qcow2",
    serialLogPath: "/tmp/serial.log",
    snapshotName: "post-initial-format",
  });
  if ("error" in result) throw new Error(result.error.reason);
  return result.ok;
}

function successfulExecution(step: Qcow2RetentionExecutionStep, command: QemuCommand): QemuCommandExecution {
  return { step, command, exitCode: 0, stdout: `${step} ok`, stderr: "" };
}

function managedProcess(pid: number, stoppedPids: number[]): ManagedQemuCommandProcess {
  let running = true;
  return {
    pid,
    isRunning: () => running,
    stop: () => {
      stoppedPids.push(pid);
      running = false;
    },
    stderr: () => "",
  };
}

describe("081KSNY2Z0008QG0R0008PN7RQ QEMU state-preservation planner", () => {
  test("plans qcow2 disk bootstrap, snapshot, restore, list, and restart commands", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
      diskSizeGB: 32,
      kvmAvailable: true,
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.diskSizeGB).toBe(32);
    expect(result.ok.createDiskImage).toEqual({
      bin: "qemu-img",
      args: ["create", "-f", "qcow2", "/tmp/zeta.qcow2", "32G"],
    });
    expect(result.ok.initialInstallFromIsoWithDisk.bin).toBe("qemu-system-x86_64");
    expect(result.ok.initialInstallFromIsoWithDisk.args).toContain("-enable-kvm");
    expect(result.ok.initialInstallFromIsoWithDisk.args).toContain("file=/tmp/zeta.qcow2,if=virtio,format=qcow2");
    expect(result.ok.createBaselineSnapshot).toEqual({
      bin: "qemu-img",
      args: ["snapshot", "-c", "post-initial-format", "/tmp/zeta.qcow2"],
    });
    expect(result.ok.restoreBaselineSnapshot).toEqual({
      bin: "qemu-img",
      args: ["snapshot", "-a", "post-initial-format", "/tmp/zeta.qcow2"],
    });
    expect(result.ok.listSnapshots.args).toEqual(["snapshot", "-l", "/tmp/zeta.qcow2"]);
    expect(result.ok.serialLogPath).toBe("/tmp/serial.log");
    expect(result.ok.restartFromIsoWithDisk.bin).toBe("qemu-system-x86_64");
    expect(result.ok.restartFromIsoWithDisk.args).toContain("-enable-kvm");
    expect(result.ok.restartFromIsoWithDisk.args).toContain("host");
    expect(result.ok.restartFromIsoWithDisk.args).toContain("file=/tmp/zeta.qcow2,if=virtio,format=qcow2");
    expect(result.ok.restartFromIsoWithDisk.args).toContain("file:/tmp/serial.log");
  });

  test("defaults the qcow2 bootstrap disk size", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.diskSizeGB).toBe(20);
    expect(result.ok.createDiskImage.args).toEqual(["create", "-f", "qcow2", "/tmp/zeta.qcow2", "20G"]);
  });

  test("falls back to qemu64 CPU when KVM is unavailable", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
      kvmAvailable: false,
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.restartFromIsoWithDisk.args).not.toContain("-enable-kvm");
    expect(result.ok.restartFromIsoWithDisk.args).toContain("qemu64");
  });

  test("can boot from a zflash-prepared raw USB image instead of a plain CD-ROM ISO", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      bootImagePath: "/tmp/zflash-boot.img",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.bootImagePath).toBe("/tmp/zflash-boot.img");
    expect(result.ok.restartFromIsoWithDisk.args).not.toContain("-cdrom");
    expect(result.ok.restartFromIsoWithDisk.args).not.toContain("/tmp/zeta.iso");
    expect(result.ok.restartFromIsoWithDisk.args).toContain(
      "file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot",
    );
    expect(result.ok.restartFromIsoWithDisk.args).toContain("qemu-xhci,id=xhci");
    const usb = qemuUsbStorageDeviceArg("zflashboot");
    if (!usb.ok) throw new Error(usb.error);
    expect(result.ok.restartFromIsoWithDisk.args).toContain(usb.device);
    expect(result.ok.restartFromIsoWithDisk.args).toContain("file=/tmp/zeta.qcow2,if=virtio,format=qcow2");
    for (const marker of B0891_RETENTION_USB_SERIAL_MARKERS) {
      expect(result.ok.requiredSerialMarkers).toContain(marker);
      expect(result.ok.restartStopCondition.successMarkers).toContain(marker);
    }
  });

  test("uses installed-OS restore markers when restart boots plain ISO without zflash image", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.requiredSerialMarkers).toEqual(restartRetentionSerialMarkers());
    expect(result.ok.restartStopCondition.successMarkers).toEqual(restartRetentionSerialMarkers());
  });

  test("carries retention serial markers for later runtime assertions", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
    });
    if ("error" in result) throw new Error(result.error.reason);

    expect(result.ok.initialInstallStopCondition.serialLogPath).toBe("/tmp/serial.log");
    expect(result.ok.initialInstallStopCondition.successMarkers).toEqual(INITIAL_INSTALL_SERIAL_MARKERS);
    expect(result.ok.initialInstallStopCondition.failureMarkers).toEqual(RETENTION_FAILURE_SERIAL_MARKERS);
    expect(result.ok.initialInstallStopCondition.terminalFailureMarkers).toEqual(RETENTION_ABSENT_TERMINAL_MARKERS);
    expect(result.ok.restartStopCondition.successMarkers).toEqual(RETENTION_SERIAL_MARKERS);
    expect(result.ok.restartStopCondition.terminalFailureMarkers).toEqual(RETENTION_ABSENT_TERMINAL_MARKERS);
  });

  test("returns Result-shaped feedback for invalid input", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("invalid-input");
      expect(result.error.field).toBe("isoPath");
    }
  });

  test("returns Result-shaped feedback for invalid disk size", () => {
    const result = planQcow2SnapshotRetention({
      isoPath: "/tmp/zeta.iso",
      diskPath: "/tmp/zeta.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
      diskSizeGB: 0,
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("invalid-input");
      expect(result.error.field).toBe("diskSizeGB");
    }
  });

  test("asserts retention serial markers from QEMU output", () => {
    const result = assertRetentionSerialMarkers(
      [
        "zeta-creds-restore: reading preserved ESP blob",
        "zeta-creds-restore: already-present, skipping credential rewrite",
      ].join("\n"),
    );

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.matchedMarkers).toContain("zeta-creds-restore:");
      expect(result.ok.matchedMarkers).toContain("already-present");
    }
  });

  test("returns missing marker feedback when restore did not skip", () => {
    const result = assertRetentionSerialMarkers("zeta-creds-restore: restoring credentials");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("missing-serial-markers");
      expect(result.error.missingMarkers).toContain("already-present");
      expect(result.error.missingMarkers).toContain("zeta-creds-restore: reading preserved ESP blob");
    }
  });

  test("assertFirstSessionSerialMarkers passes when phase-3 transcript complete", () => {
    const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join("\n");
    const result = assertFirstSessionSerialMarkers(serial);
    expect("ok" in result).toBe(true);
  });

  test("asserts explicit ESP hostname injection markers from QEMU output", () => {
    const serial = [
      "[iter-5.2] probing boot USB for injected hostname",
      "[iter-5.2]   found injected hostname: pikachu (source: /mnt/boot/zeta-hostname.txt)",
      "[iter-5.2]   wrote /mnt/etc/zeta/cluster-node-id",
      "[iter-5.2]   networking.hostName will be 'pikachu' on first boot",
      "[iter-5.2]   ssh access: ssh zeta@pikachu.local",
    ].join("\n");

    const result = assertHostnameInjectionSerialMarkers(serial);

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.matchedMarkers).toEqual(HOSTNAME_INJECTION_SERIAL_MARKERS);
    }
  });

  test("asserts on-node hostname autogeneration markers from QEMU output", () => {
    const serial = [
      "[iter-5.2] probing boot USB for injected hostname",
      "[iter-5.2]   no zeta-hostname.txt on USB ESP",
      "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ...",
      "[iter-5.2.2]   generated: node-a1b2c3",
      "[iter-5.2.2]   wrote /mnt/etc/zeta/cluster-node-id",
      "[iter-5.2.2]   networking.hostName will be 'node-a1b2c3' on first boot",
    ].join("\n");

    const result = assertHostnameAutogenerationSerialMarkers(serial);

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.matchedMarkers).toEqual(HOSTNAME_AUTOGENERATION_SERIAL_MARKERS);
    }
  });

  test("reports missing hostname injection markers when ESP hostname was not consumed", () => {
    const result = assertHostnameInjectionSerialMarkers("[iter-5.2]   no zeta-hostname.txt on USB ESP");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("missing-serial-markers");
      expect(result.error.missingMarkers).toEqual(HOSTNAME_INJECTION_SERIAL_MARKERS);
    }
  });

  test("assertHappyPathFirstSessionSerial checks accepted setup-gh local-only path", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
    ].join("\n");

    const result = assertHappyPathFirstSessionSerial(serial);

    expect("ok" in result).toBe(true);
  });

  test("assertSkipGhFirstSessionSerial checks accepted continue-later path", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=skip_credential vendor=gh",
      "  Continue later: run gh auth login when ready.",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=false",
    ].join("\n");

    const result = assertSkipGhFirstSessionSerial(serial);

    expect("ok" in result).toBe(true);
  });

  test("executes the QEMU retention command sequence and asserts serial markers", () => {
    const observedSteps: Qcow2RetentionExecutionStep[] = [];
    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), {
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
    });

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(observedSteps).toEqual([
        "create-disk-image",
        "initial-install-from-iso-with-disk",
        "create-baseline-snapshot",
        "list-baseline-snapshots",
        "restore-baseline-snapshot",
        "restart-from-iso-with-disk",
      ]);
      expect(result.ok.commandExecutions).toHaveLength(6);
      expect(result.ok.serialAssertion.matchedMarkers).toContain("already-present");
    }
  });

  test("fails closed when serial-gated QEMU steps lack a lifecycle executor", () => {
    const observedSteps: Qcow2RetentionExecutionStep[] = [];
    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), {
      runCommand: (step, command) => {
        observedSteps.push(step);
        return successfulExecution(step, command);
      },
      readSerialOutput: () => {
        throw new Error("serial should not be read when lifecycle executor is missing");
      },
    });

    expect(observedSteps).toEqual(["create-disk-image"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("command-failed");
      expect(result.error.commandExecutions).toHaveLength(1);
      if (result.error.kind === "command-failed") {
        expect(result.error.step).toBe("initial-install-from-iso-with-disk");
        expect(result.error.exitCode).toBe(null);
        expect(result.error.stderr).toContain("missing runCommandUntilSerialMarkers");
      }
    }
  });

  test("adapts planned QEMU commands to a timeout-bound process executor", () => {
    const observed: Array<{
      readonly command: QemuCommand;
      readonly options: SpawnSyncQemuCommandOptions;
    }> = [];
    const managedObserved: Array<{
      readonly command: QemuCommand;
      readonly options: SpawnSyncQemuCommandOptions;
    }> = [];
    const stoppedPids: number[] = [];
    const serialPaths: string[] = [];
    let serialReadCount = 0;
    const executor = createSpawnSyncQcow2RetentionExecutor({
      cwd: "/tmp/zeta-worktree",
      timeoutMs: 1234,
      pollIntervalMs: 1,
      spawnCommand: (command, options) => {
        observed.push({ command, options });
        return { exitCode: 0, stdout: `${command.bin} ok`, stderr: "" };
      },
      spawnManagedCommand: (command, options) => {
        managedObserved.push({ command, options });
        return managedProcess(4200 + managedObserved.length, stoppedPids);
      },
      readSerialOutput: (serialLogPath) => {
        serialPaths.push(serialLogPath);
        serialReadCount += 1;
        if (serialReadCount === 1) {
          return "";
        }
        if (managedObserved.length === 1) {
          return "ZETA CLUSTER NODE INSTALL COMPLETE";
        }
        if (serialReadCount === 3) {
          return "ZETA CLUSTER NODE INSTALL COMPLETE";
        }
        return [
          "ZETA CLUSTER NODE INSTALL COMPLETE",
          "zeta-creds-restore: reading preserved ESP blob",
          "zeta-creds-restore: already-present, skipping credential rewrite",
        ].join("\n");
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(observed.map((entry) => entry.command.bin)).toEqual(["qemu-img", "qemu-img", "qemu-img", "qemu-img"]);
      expect(managedObserved.map((entry) => entry.command.bin)).toEqual(["qemu-system-x86_64", "qemu-system-x86_64"]);
      expect(observed.every((entry) => entry.options.cwd === "/tmp/zeta-worktree")).toBe(true);
      expect(observed.every((entry) => entry.options.timeoutMs === 1234)).toBe(true);
      expect(managedObserved.every((entry) => entry.options.cwd === "/tmp/zeta-worktree")).toBe(true);
      expect(managedObserved.every((entry) => entry.options.timeoutMs === 1234)).toBe(true);
      expect(serialPaths).toEqual([
        "/tmp/serial.log",
        "/tmp/serial.log",
        "/tmp/serial.log",
        "/tmp/serial.log",
        "/tmp/serial.log",
      ]);
      expect(stoppedPids).toEqual([4201, 4202]);
      expect(result.ok.commandExecutions[1]?.serialStop?.matchedMarkers).toContain("ZETA CLUSTER NODE INSTALL COMPLETE");
      expect(result.ok.commandExecutions[5]?.serialStop?.matchedMarkers).toContain("already-present");
      expect(result.ok.serialAssertion.matchedMarkers).toContain("already-present");
    }
  });

  test("scans only new serial output for each lifecycle-managed QEMU phase", () => {
    const managedObserved: QemuCommand[] = [];
    const staleSerial = ["ZETA CLUSTER NODE INSTALL COMPLETE", "nixos@zeta-installer:~]$"].join("\n");
    const readsByManagedCount = new Map<number, number>();
    const executor = createSpawnSyncQcow2RetentionExecutor({
      pollIntervalMs: 1,
      spawnCommand: () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
      spawnManagedCommand: (command) => {
        managedObserved.push(command);
        return managedProcess(5300 + managedObserved.length, []);
      },
      readSerialOutput: () => {
        const managedCount = managedObserved.length;
        const nextRead = (readsByManagedCount.get(managedCount) ?? 0) + 1;
        readsByManagedCount.set(managedCount, nextRead);
        if (managedCount === 0) {
          return "";
        }
        if (managedCount === 1) {
          return staleSerial;
        }
        if (nextRead === 1) {
          return staleSerial;
        }
        return [
          staleSerial,
          "zeta-creds-restore: reading preserved ESP blob",
          "zeta-creds-restore: already-present, skipping credential rewrite",
        ].join("\n");
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("ok" in result).toBe(true);
    if ("ok" in result) {
      expect(result.ok.commandExecutions[5]?.serialStop?.matchedMarkers).toContain("already-present");
    }
  });

  test("waits for managed QEMU stop before the next qcow2 step", () => {
    let initialQemuRunning = true;
    let initialQemuStopIssued = false;
    let initialQemuRunningPollsAfterStop = 0;
    let snapshotSawStoppedQemu = false;
    const managedObserved: QemuCommand[] = [];
    const executor = createSpawnSyncQcow2RetentionExecutor({
      pollIntervalMs: 1,
      spawnCommand: (command) => {
        if (command.args[0] === "snapshot" && command.args[1] === "-c") {
          snapshotSawStoppedQemu = !initialQemuRunning;
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      },
      spawnManagedCommand: (command) => {
        managedObserved.push(command);
        if (managedObserved.length > 1) {
          return managedProcess(5400 + managedObserved.length, []);
        }
        return {
          pid: 5401,
          isRunning: () => {
            if (!initialQemuStopIssued) {
              return true;
            }
            initialQemuRunningPollsAfterStop += 1;
            initialQemuRunning = initialQemuRunningPollsAfterStop < 3;
            return initialQemuRunning;
          },
          stop: () => {
            initialQemuStopIssued = true;
          },
          stderr: () => "",
        };
      },
      readSerialOutput: () => {
        if (managedObserved.length === 0) {
          return "";
        }
        if (managedObserved.length === 1) {
          return "ZETA CLUSTER NODE INSTALL COMPLETE";
        }
        return [
          "ZETA CLUSTER NODE INSTALL COMPLETE",
          "zeta-creds-restore: reading preserved ESP blob",
          "zeta-creds-restore: already-present, skipping credential rewrite",
        ].join("\n");
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("ok" in result).toBe(true);
    expect(snapshotSawStoppedQemu).toBe(true);
    expect(initialQemuRunningPollsAfterStop).toBeGreaterThanOrEqual(3);
  });

  test("fails initial install when the installer prompt appears before post-install marker", () => {
    let readCount = 0;
    const executor = createSpawnSyncQcow2RetentionExecutor({
      pollIntervalMs: 1,
      spawnCommand: () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
      spawnManagedCommand: () => managedProcess(5201, []),
      readSerialOutput: () => {
        readCount += 1;
        return readCount === 1 ? "" : "nixos@zeta-installer:~]$";
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("command-failed");
      if (result.error.kind === "command-failed") {
        expect(result.error.step).toBe("initial-install-from-iso-with-disk");
        expect(result.error.stderr).toContain("terminal marker observed before required serial markers");
        expect(result.error.stderr).toContain("ZETA CLUSTER NODE INSTALL COMPLETE");
      }
    }
  });

  test("fails retained restart when the plain installer prompt appears before retention markers", () => {
    const managedObserved: QemuCommand[] = [];
    let serialReadCount = 0;
    const executor = createSpawnSyncQcow2RetentionExecutor({
      pollIntervalMs: 1,
      spawnCommand: () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
      spawnManagedCommand: (command) => {
        managedObserved.push(command);
        return managedProcess(5100 + managedObserved.length, []);
      },
      readSerialOutput: () => {
        serialReadCount += 1;
        if (serialReadCount === 1) {
          return "";
        }
        if (managedObserved.length === 1) {
          return "ZETA CLUSTER NODE INSTALL COMPLETE";
        }
        if (serialReadCount === 3) {
          return "ZETA CLUSTER NODE INSTALL COMPLETE";
        }
        return "nixos@zeta-installer:~]$";
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("command-failed");
      if (result.error.kind === "command-failed") {
        expect(result.error.step).toBe("restart-from-iso-with-disk");
        expect(result.error.stderr).toContain("terminal marker observed before required serial markers");
        expect(result.error.stderr).toContain("zeta-creds-restore:");
        expect(result.error.stderr).toContain("already-present");
      }
    }
  });

  test("fails a lifecycle-managed QEMU phase when a serial failure marker appears", () => {
    let readCount = 0;
    const executor = createSpawnSyncQcow2RetentionExecutor({
      pollIntervalMs: 1,
      spawnCommand: () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
      spawnManagedCommand: () => managedProcess(5001, []),
      readSerialOutput: () => {
        readCount += 1;
        return readCount === 1 ? "" : "panic: installer crashed";
      },
    });

    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), executor);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("command-failed");
      if (result.error.kind === "command-failed") {
        expect(result.error.step).toBe("initial-install-from-iso-with-disk");
        expect(result.error.stderr).toContain("failure marker observed");
      }
    }
  });

  test("stops before serial assertion when a QEMU command fails", () => {
    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), {
      runCommand: (step, command) => {
        if (step === "restore-baseline-snapshot") {
          return { step, command, exitCode: 1, stdout: "", stderr: "snapshot not found" };
        }
        return successfulExecution(step, command);
      },
      runCommandUntilSerialMarkers: successfulExecution,
      readSerialOutput: () => {
        throw new Error("serial should not be read after command failure");
      },
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("command-failed");
      expect(result.error.commandExecutions).toHaveLength(5);
      if (result.error.kind === "command-failed") {
        expect(result.error.step).toBe("restore-baseline-snapshot");
      }
    }
  });

  test("returns marker feedback after command execution when retention was not observed", () => {
    const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), {
      runCommand: successfulExecution,
      runCommandUntilSerialMarkers: successfulExecution,
      readSerialOutput: () => "zeta-creds-restore: restored credentials",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.kind).toBe("serial-marker-failed");
      expect(result.error.commandExecutions).toHaveLength(6);
      if (result.error.kind === "serial-marker-failed") {
        expect(result.error.assertion.missingMarkers).toContain("already-present");
        expect(result.error.assertion.missingMarkers).toContain(
          "zeta-creds-restore: reading preserved ESP blob",
        );
      }
    }
  });
});

const SEGMENT_BOOT_BASE = {
  diskPath: "/tmp/d.qcow2",
  serialLogPath: "/tmp/s.log",
  memoryMB: 2048,
  cpuCount: 2,
  kvmAvailable: false,
  bootMedia: { kind: "iso", path: "/tmp/i.iso" },
} as const;

describe("QEMU network devices (scenario 5 shared L2 segment)", () => {
  // THE REGRESSION GUARD for scenarios 1-4. They are hard-gated on push-to-main
  // and must not shift by one byte because scenario 5 gained a capability.
  test("omitting networkDevices reproduces the pre-existing SLIRP command line", () => {
    const args = buildQemuSystemBootArgs(SEGMENT_BOOT_BASE);
    const netdevIndex = args.indexOf("-netdev");
    expect(args[netdevIndex + 1]).toBe("user,id=net0");
    expect(args[netdevIndex + 2]).toBe("-device");
    expect(args[netdevIndex + 3]).toBe("virtio-net-pci,netdev=net0");
    expect(args.filter((a) => a === "-netdev")).toHaveLength(1);
  });

  test("explicitly passing the default devices equals omitting them", () => {
    const implicitArgs = buildQemuSystemBootArgs(SEGMENT_BOOT_BASE);
    const explicitArgs = buildQemuSystemBootArgs({
      ...SEGMENT_BOOT_BASE,
      networkDevices: DEFAULT_QEMU_NETWORK_DEVICES,
    });
    expect(explicitArgs).toEqual(implicitArgs);
  });

  test("a listen side and a connect side name the same TCP rendezvous", () => {
    const listen = buildQemuNetworkDeviceArgs([
      { id: "net0", backend: { kind: "user-nat" } },
      { id: "net1", backend: { kind: "l2-socket-listen", port: 21084 }, mac: "52:54:00:7a:f1:01" },
    ]);
    const connect = buildQemuNetworkDeviceArgs([
      { id: "net0", backend: { kind: "user-nat" } },
      {
        id: "net1",
        backend: { kind: "l2-socket-connect", host: "127.0.0.1", port: 21084 },
        mac: "52:54:00:7a:f1:02",
      },
    ]);
    expect("ok" in listen).toBe(true);
    expect("ok" in connect).toBe(true);
    if (!("ok" in listen) || !("ok" in connect)) {
      return;
    }
    expect(listen.ok).toContain("socket,id=net1,listen=:21084");
    expect(connect.ok).toContain("socket,id=net1,connect=127.0.0.1:21084");
  });

  // The silent-misroute guard. QEMU defaults every NIC to one constant MAC, so
  // a shared segment without explicit MACs is a duplicate-address collision
  // that still boots -- exactly the false-green shape this harness must refuse.
  test("a shared-segment device without an explicit mac is refused", () => {
    const result = buildQemuNetworkDeviceArgs([
      { id: "net1", backend: { kind: "l2-socket-listen", port: 21084 } },
    ]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("must declare an explicit mac");
    }
  });

  test("two devices sharing one mac are refused", () => {
    const result = buildQemuNetworkDeviceArgs([
      { id: "net1", backend: { kind: "l2-socket-listen", port: 21084 }, mac: "52:54:00:7a:f1:01" },
      { id: "net2", backend: { kind: "l2-multicast", group: "230.0.0.1", port: 21085 }, mac: "52:54:00:7A:F1:01" },
    ]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("more than one netdev");
    }
  });

  test("a multicast MAC is refused as a NIC source address", () => {
    const result = buildQemuNetworkDeviceArgs([
      { id: "net1", backend: { kind: "l2-socket-listen", port: 21084 }, mac: "53:54:00:7a:f1:01" },
    ]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("multicast bit");
    }
  });

  test("a unicast address is refused as a multicast group", () => {
    const result = buildQemuNetworkDeviceArgs([
      { id: "net1", backend: { kind: "l2-multicast", group: "10.0.0.1", port: 21085 }, mac: "52:54:00:7a:f1:03" },
    ]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("outside 224.0.0.0/4");
    }
  });

  test("duplicate netdev ids and out-of-range ports are refused", () => {
    const dupe = buildQemuNetworkDeviceArgs([
      { id: "net0", backend: { kind: "user-nat" } },
      { id: "net0", backend: { kind: "user-nat" } },
    ]);
    expect("error" in dupe).toBe(true);

    const badPort = buildQemuNetworkDeviceArgs([
      { id: "net1", backend: { kind: "l2-socket-listen", port: 70000 }, mac: "52:54:00:7a:f1:04" },
    ]);
    expect("error" in badPort).toBe(true);

    const empty = buildQemuNetworkDeviceArgs([]);
    expect("error" in empty).toBe(true);
  });

  test("a segment VM keeps its NAT NIC alongside the segment NIC", () => {
    const devices: readonly QemuNetworkDevice[] = [
      { id: "net0", backend: { kind: "user-nat" } },
      { id: "net1", backend: { kind: "l2-socket-listen", port: 21084 }, mac: "52:54:00:7a:f1:01" },
    ];
    const args = buildQemuSystemBootArgs({ ...SEGMENT_BOOT_BASE, networkDevices: devices });
    expect(args.filter((a) => a === "-netdev")).toHaveLength(2);
    expect(args).toContain("user,id=net0");
    expect(args).toContain("virtio-net-pci,netdev=net1,mac=52:54:00:7a:f1:01");
  });
});
