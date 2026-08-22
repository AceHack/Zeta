import { describe, expect, test } from "bun:test";
import { planMultiVMRuntime, executeMultiVMRuntimePlan, type MultiVMRuntimeInput } from "./multi-vm";

function validInput(overrides: Partial<MultiVMRuntimeInput> = {}): MultiVMRuntimeInput {
  return {
    isoPath: "fixtures/zeta.iso",
    existingDiskPath: "run/existing.qcow2",
    joiningDiskPath: "run/joining.qcow2",
    existingSerialLogPath: "run/existing.serial.log",
    joiningSerialLogPath: "run/joining.serial.log",
    ...overrides,
  };
}

describe("081KSNY2Z0008QG0R0008PN7RQ multi-VM runtime planner", () => {
  test("rejects non-positive memory size", () => {
    const result = planMultiVMRuntime(validInput({ memoryMB: 0 }));

    expect(result).toEqual({
      error: {
        kind: "invalid-input",
        field: "memoryMB",
        reason: "memoryMB must be a positive integer",
      },
    });
  });

  test("rejects fractional cpu count", () => {
    const result = planMultiVMRuntime(validInput({ cpuCount: 1.5 }));

    expect(result).toEqual({
      error: {
        kind: "invalid-input",
        field: "cpuCount",
        reason: "cpuCount must be a positive integer",
      },
    });
  });

  test("accepts explicit positive sizing values", () => {
    const result = planMultiVMRuntime(validInput({ memoryMB: 4096, cpuCount: 4 }));

    expect(result).toHaveProperty("ok");
    if ("ok" in result) {
      const bootArgs = result.ok.vms[0]?.qemuBootCommand?.args ?? [];
      expect(bootArgs).toContain("4096");
      expect(bootArgs).toContain("4");
    }
  });

  test("executes multi-VM runtime plan through executor and verifies serial markers", () => {
    const planResult = planMultiVMRuntime(validInput({ bootImagePath: "run/boot.img" }));
    expect("ok" in planResult).toBe(true);
    if (!("ok" in planResult)) return;

    const mockLogs: Record<string, string> = {
      "run/existing.serial.log": "zeta-creds-restore: already-present\ncluster-ready",
      "run/joining.serial.log": "[081KSNY2Z0008QG0R0008PN7RQ-joining]     cluster join successful\n[081KSNY2Z0008QG0R0008PN7RQ-joining]     joining-node added to the cluster state",
    };

    const mockExecutor = {
      runCommand: (_step: string, _cmd: any) => ({
        step: "restore-baseline-snapshot" as const,
        commandLine: "qemu-img snapshot -a post-initial-format run/existing.qcow2",
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
      runCommandUntilSerialMarkers: (step: any, _cmd: any, _cond: any) => ({
        step,
        commandLine: "qemu-system-x86_64 ...",
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
      readSerialOutput: (logPath: string) => mockLogs[logPath] ?? "",
    };

    const execResult = executeMultiVMRuntimePlan(planResult.ok, mockExecutor as any);
    expect("ok" in execResult).toBe(true);
    if ("ok" in execResult) {
      expect(execResult.ok.vmExecutions.length).toBe(2);
      expect(execResult.ok.vmExecutions[0]?.vmName).toBe("cluster-existing");
      expect(execResult.ok.vmExecutions[1]?.vmName).toBe("joining-node");
    }
  });
});
