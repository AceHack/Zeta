import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { runPathForkRuntime, runRetentionRuntime } from "./run";
const SCRIPT = join(import.meta.dir, "run.ts");
function run(...args) {
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
function successfulExecution(step, command) {
    return { step, command, exitCode: 0, stdout: `${step} ok`, stderr: "" };
}
describe("B-0891 test-harness dispatcher", () => {
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
        expect(parsed.results[0].qemuRetentionPlan.initialInstallFromIsoWithDisk.args).toContain(`file=${diskPath},if=virtio,format=qcow2`);
        expect(parsed.results[0].qemuRetentionPlan.createBaselineSnapshot.args).toEqual([
            "snapshot",
            "-c",
            "post-initial-format",
            diskPath,
        ]);
        expect(parsed.results[0].qemuRetentionPlan.restoreBaselineSnapshot.args).toContain(diskPath);
        expect(parsed.results[0].qemuRetentionPlan.restartFromIsoWithDisk.args).toContain(`file=${diskPath},if=virtio,format=qcow2`);
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
        const migrate = scenarioResult.pathForkPlan.forks.find((fork) => fork.forkId === "migrate-existing-creds");
        const fresh = scenarioResult.pathForkPlan.forks.find((fork) => fork.forkId === "fresh-cluster");
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
        expect(migrate?.qemuBootCommand?.args).toContain("file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot");
        expect(migrate?.qemuBootCommand?.args).toContain("usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
        expect(fresh?.missingRuntimeRequirements).toEqual([]);
        expect(fresh?.qemuBootCommand?.args).not.toContain("-cdrom");
        expect(fresh?.qemuBootCommand?.args).toContain("file=/tmp/zflash-boot-fresh.img,if=none,format=raw,readonly=on,id=zflashboot");
    });
    test("retention runtime executes through an injected QEMU executor when explicitly enabled", () => {
        const observedSteps = [];
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
                readSerialOutput: () => [
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
        }
        else {
            throw new Error("expected retention execution success");
        }
    });
    test("retention runtime can plan against an explicit zflash-prepared boot image", () => {
        const result = runRetentionRuntime("/tmp/zeta.iso", {
            bootImagePath: "/tmp/zflash-boot.img",
        });
        expect(result.status).toBe("failed");
        expect(result.qemuRetentionPlan?.bootImagePath).toBe("/tmp/zflash-boot.img");
        expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain("file=/tmp/zflash-boot.img,if=none,format=raw,readonly=on,id=zflashboot");
        expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain("qemu-xhci,id=xhci");
        expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).toContain("usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
        expect(result.qemuRetentionPlan?.restartFromIsoWithDisk.args).not.toContain("-cdrom");
        for (const marker of [
            "[B-0891-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
            "[B-0891-retention]   Step 6.95-picker will skip account re-entry",
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
                            "[B-0891-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
                            "[B-0891-retention]   Step 6.95-picker will skip account re-entry",
                        ].join("\n");
                    }
                    return [
                        "[B-0891-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal",
                    ].join("\n");
                },
            },
        });
        expect(result.status).toBe("passed");
        expect(result.pathForkExecution).toBeDefined();
        if (result.pathForkExecution && "ok" in result.pathForkExecution) {
            expect(result.pathForkExecution.ok.forkExecutions).toHaveLength(2);
        }
        else {
            throw new Error("expected path-fork execution success");
        }
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
        }
        else {
            throw new Error("expected retention execution failure");
        }
    });
});
