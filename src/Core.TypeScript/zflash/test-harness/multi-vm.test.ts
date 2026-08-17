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

describe("scenario 5 shared L2 segment planning", () => {
  test("the two VMs are planned onto one segment, not two SLIRP islands", () => {
    const result = planMultiVMRuntime(validInput({ bootImagePath: "run/boot.img" }));
    expect("ok" in result).toBe(true);
    if (!("ok" in result)) {
      return;
    }
    const existing = result.ok.vms.find((v) => v.role === "cluster-existing");
    const joining = result.ok.vms.find((v) => v.role === "joining-node");
    const existingArgs = existing?.qemuBootCommand?.args ?? [];
    const joiningArgs = joining?.qemuBootCommand?.args ?? [];

    const listen = existingArgs.find((a) => a.startsWith("socket,id=net1,listen="));
    const connect = joiningArgs.find((a) => a.startsWith("socket,id=net1,connect="));
    expect(listen).toBeDefined();
    expect(connect).toBeDefined();
    // Same rendezvous port on both sides, or they are not on one segment.
    const port = listen?.split(":").pop();
    expect(connect?.endsWith(`:${String(port)}`)).toBe(true);
  });

  test("the two nodes present different MACs on the shared segment", () => {
    const result = planMultiVMRuntime(validInput({ bootImagePath: "run/boot.img" }));
    expect("ok" in result).toBe(true);
    if (!("ok" in result)) {
      return;
    }
    const macOf = (role: string): string | undefined =>
      result.ok.vms
        .find((v) => v.role === role)
        ?.qemuBootCommand?.args.find((a) => a.startsWith("virtio-net-pci,netdev=net1,mac="));
    const existingMac = macOf("cluster-existing");
    const joiningMac = macOf("joining-node");
    expect(existingMac).toBeDefined();
    expect(joiningMac).toBeDefined();
    expect(existingMac).not.toBe(joiningMac);
  });

  test("each VM keeps its outbound NAT NIC alongside the segment NIC", () => {
    const result = planMultiVMRuntime(validInput({ bootImagePath: "run/boot.img" }));
    expect("ok" in result).toBe(true);
    if (!("ok" in result)) {
      return;
    }
    for (const vm of result.ok.vms) {
      const args = vm.qemuBootCommand?.args ?? [];
      expect(args).toContain("user,id=net0");
      expect(args.filter((a) => a === "-netdev")).toHaveLength(2);
    }
  });
});
