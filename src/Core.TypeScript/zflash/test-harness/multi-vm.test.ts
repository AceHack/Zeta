import { describe, expect, test } from "bun:test";
import {
  planMultiVMRuntime,
  executeMultiVMRuntimePlan,
  scenario5FirstbootRole,
  SCENARIO5_EXISTING_NODE_HOSTNAME,
  SCENARIO5_JOIN_SERVER_URL,
  type MultiVMRuntimeInput,
} from "./multi-vm";
import { planFirstbootConfFileContent } from "../firstboot-role";

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

describe("081KSNY2Z0008QG0R0008PN7RQ scenario 5 role provisioning", () => {
  test("the existing node founds the cluster, the joining node joins it", () => {
    expect(scenario5FirstbootRole("cluster-existing")).toEqual({
      kind: "first-control-plane",
      flakeHost: SCENARIO5_EXISTING_NODE_HOSTNAME,
    });
    expect(scenario5FirstbootRole("joining-node")).toEqual({
      kind: "joiner",
      flakeHost: "worker-template",
      serverUrl: SCENARIO5_JOIN_SERVER_URL,
      tokenEspPath: "/zeta-join-token",
    });
  });

  test("the joiner dials the name the founder is flashed to take", () => {
    // The failure this pins: zeta-install.sh generates a random node-<6hex>
    // hostname when no zeta-hostname.txt is on the ESP, so a joiner pointed
    // at a name the founder never took dials nothing.
    const founder = scenario5FirstbootRole("cluster-existing");
    expect(founder.kind).toBe("first-control-plane");
    expect(SCENARIO5_JOIN_SERVER_URL).toContain(`${SCENARIO5_EXISTING_NODE_HOSTNAME}.local`);
  });

  test("the joiner URL is mDNS-resolvable in shape (.local), not a bare label", () => {
    // nss-mdns answers for `.local` only; the shared socket segment has no
    // DHCP and no DNS, so a bare `https://control-plane:6443` would not
    // resolve there. UNVERIFIED end-to-end; this pins the shape only.
    expect(SCENARIO5_JOIN_SERVER_URL.startsWith("https://")).toBe(true);
    expect(SCENARIO5_JOIN_SERVER_URL.endsWith(".local:6443")).toBe(true);
  });

  test("both scenario-5 roles compose to a valid firstboot config", () => {
    for (const role of ["cluster-existing", "joining-node"] as const) {
      const planned = planFirstbootConfFileContent(scenario5FirstbootRole(role));
      expect(planned.ok).toBe(true);
    }
  });

  test("the plan carries each VM's role so a test can assert it", () => {
    const result = planMultiVMRuntime(validInput({ bootImagePath: "run/boot.img" }));
    expect("ok" in result).toBe(true);
    if (!("ok" in result)) return;
    const joining = result.ok.vms.find((vm) => vm.role === "joining-node");
    expect(joining?.firstbootRole.kind).toBe("joiner");
    const existing = result.ok.vms.find((vm) => vm.role === "cluster-existing");
    expect(existing?.firstbootRole.kind).toBe("first-control-plane");
  });

  test("a missing boot image names the role the flash must carry", () => {
    const result = planMultiVMRuntime(validInput());
    expect("ok" in result).toBe(true);
    if (!("ok" in result)) return;
    const joining = result.ok.vms.find((vm) => vm.role === "joining-node");
    expect(joining?.missingRuntimeRequirements.join(" ")).toContain("--role joiner");
  });
});
