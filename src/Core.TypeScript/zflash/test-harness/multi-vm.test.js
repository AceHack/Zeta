import { describe, expect, test } from "bun:test";
import { planMultiVMRuntime } from "./multi-vm";
function validInput(overrides = {}) {
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
});
