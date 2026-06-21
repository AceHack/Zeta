import { describe, expect, test } from "bun:test";
import { assertRetentionSerialMarkers, assertFirstSessionSerialMarkers, B0891_RETENTION_USB_SERIAL_MARKERS, createSpawnSyncQcow2RetentionExecutor, executeQcow2SnapshotRetentionPlan, INITIAL_INSTALL_SERIAL_MARKERS, RETENTION_ABSENT_TERMINAL_MARKERS, planQcow2SnapshotRetention, restartRetentionSerialMarkers, RETENTION_FAILURE_SERIAL_MARKERS, RETENTION_SERIAL_MARKERS, } from "./qemu-state";
function retentionPlan() {
    const result = planQcow2SnapshotRetention({
        isoPath: "/tmp/zeta.iso",
        diskPath: "/tmp/zeta.qcow2",
        serialLogPath: "/tmp/serial.log",
        snapshotName: "post-initial-format",
    });
    if ("error" in result)
        throw new Error(result.error.reason);
    return result.ok;
}
function successfulExecution(step, command) {
    return { step, command, exitCode: 0, stdout: `${step} ok`, stderr: "" };
}
function managedProcess(pid, stoppedPids) {
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
describe("B-0891 QEMU state-preservation planner", () => {
    test("plans qcow2 disk bootstrap, snapshot, restore, list, and restart commands", () => {
        const result = planQcow2SnapshotRetention({
            isoPath: "/tmp/zeta.iso",
            diskPath: "/tmp/zeta.qcow2",
            serialLogPath: "/tmp/serial.log",
            snapshotName: "post-initial-format",
            diskSizeGB: 32,
            kvmAvailable: true,
        });
        if ("error" in result)
            throw new Error(result.error.reason);
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
        if ("error" in result)
            throw new Error(result.error.reason);
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
        if ("error" in result)
            throw new Error(result.error.reason);
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
        if ("error" in result)
            throw new Error(result.error.reason);
        expect(result.ok.bootImagePath).toBe("/tmp/zflash-boot.img");
        expect(result.ok.restartFromIsoWithDisk.args).not.toContain("-cdrom");
        expect(result.ok.restartFromIsoWithDisk.args).not.toContain("/tmp/zeta.iso");
        expect(result.ok.restartFromIsoWithDisk.args).toContain("file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot");
        expect(result.ok.restartFromIsoWithDisk.args).toContain("qemu-xhci,id=xhci");
        expect(result.ok.restartFromIsoWithDisk.args).toContain("usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
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
        if ("error" in result)
            throw new Error(result.error.reason);
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
        if ("error" in result)
            throw new Error(result.error.reason);
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
        const result = assertRetentionSerialMarkers([
            "zeta-creds-restore: reading preserved ESP blob",
            "zeta-creds-restore: already-present, skipping credential rewrite",
        ].join("\n"));
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
            expect(result.error.missingMarkers).toEqual(["already-present"]);
        }
    });
    test("assertFirstSessionSerialMarkers passes when phase-3 transcript complete", () => {
        const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join("\n");
        const result = assertFirstSessionSerialMarkers(serial);
        expect("ok" in result).toBe(true);
    });
    test("executes the QEMU retention command sequence and asserts serial markers", () => {
        const observedSteps = [];
        const result = executeQcow2SnapshotRetentionPlan(retentionPlan(), {
            runCommand: (step, command) => {
                observedSteps.push(step);
                return successfulExecution(step, command);
            },
            runCommandUntilSerialMarkers: (step, command) => {
                observedSteps.push(step);
                return successfulExecution(step, command);
            },
            readSerialOutput: () => [
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
        const observedSteps = [];
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
        const observed = [];
        const managedObserved = [];
        const stoppedPids = [];
        const serialPaths = [];
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
        const managedObserved = [];
        const staleSerial = ["ZETA CLUSTER NODE INSTALL COMPLETE", "nixos@zeta-installer:~]$"].join("\n");
        const readsByManagedCount = new Map();
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
        const managedObserved = [];
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
        const managedObserved = [];
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
                expect(result.error.assertion.missingMarkers).toEqual(["already-present"]);
            }
        }
    });
});
