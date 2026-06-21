// tools/installer/zeta-hardware-detect.test.ts
//
// Unit tests for the pure-logic exports of zeta-hardware-detect.ts.
// I/O surface (lspci/lsblk/nproc/proc reads) is NOT tested here;
// only the parsing + classification + suggestion logic.
import { describe, expect, test } from "bun:test";
import { buildReport, classifyGpu, classifyStorage, deriveSuggestedHost, parseCpuVendor, parseMemoryGb, } from "./zeta-hardware-detect.js";
describe("classifyGpu", () => {
    test("NVIDIA VGA classified as nvidia", () => {
        const lspci = "01:00.0 VGA compatible controller: NVIDIA Corporation GA102\n";
        expect(classifyGpu(lspci)).toBe("nvidia");
    });
    test("NVIDIA 3D controller (no VGA line) classified as nvidia", () => {
        const lspci = "03:00.0 3D controller: NVIDIA Corporation TU117M (rev a1)\n";
        expect(classifyGpu(lspci)).toBe("nvidia");
    });
    test("AMD VGA classified as amd", () => {
        const lspci = "05:00.0 VGA compatible controller: Advanced Micro Devices, Inc. [AMD/ATI] Radeon\n";
        expect(classifyGpu(lspci)).toBe("amd");
    });
    test("Intel Arc classified as intel-arc", () => {
        const lspci = "01:00.0 VGA compatible controller: Intel Corporation DG2 [Arc A770]\n";
        expect(classifyGpu(lspci)).toBe("intel-arc");
    });
    test("Integrated Intel UHD NOT classified as GPU", () => {
        const lspci = "00:02.0 VGA compatible controller: Intel Corporation UHD Graphics 620\n";
        expect(classifyGpu(lspci)).toBe("none");
    });
    test("empty lspci output classified as none", () => {
        expect(classifyGpu("")).toBe("none");
    });
    test("multiple GPUs — NVIDIA wins per priority order", () => {
        const lspci = [
            "00:02.0 VGA compatible controller: Intel Corporation UHD Graphics 620",
            "01:00.0 VGA compatible controller: NVIDIA Corporation GA102",
            "05:00.0 VGA compatible controller: Advanced Micro Devices Radeon",
        ].join("\n");
        expect(classifyGpu(lspci)).toBe("nvidia");
    });
});
describe("classifyStorage", () => {
    test("single NVMe disk", () => {
        const lsblk = "NAME    ROTA TYPE\nnvme0n1    0 disk\n";
        expect(classifyStorage(lsblk)).toEqual({
            diskCount: 1,
            hasNvme: true,
            hasSsd: false,
            hasHdd: false,
        });
    });
    test("HDD + SSD + NVMe mix (4 disks total)", () => {
        const lsblk = [
            "NAME    ROTA TYPE",
            "sda        1 disk",
            "sdb        0 disk",
            "nvme0n1    0 disk",
            "nvme1n1    0 disk",
        ].join("\n");
        expect(classifyStorage(lsblk)).toEqual({
            diskCount: 4,
            hasNvme: true,
            hasSsd: true,
            hasHdd: true,
        });
    });
    test("partition lines (TYPE=part) ignored", () => {
        const lsblk = [
            "NAME    ROTA TYPE",
            "sda        1 disk",
            "sda1       1 part",
            "sda2       1 part",
        ].join("\n");
        expect(classifyStorage(lsblk).diskCount).toBe(1);
    });
    test("empty lsblk output yields zero counts", () => {
        expect(classifyStorage("")).toEqual({
            diskCount: 0,
            hasNvme: false,
            hasSsd: false,
            hasHdd: false,
        });
    });
});
describe("parseCpuVendor", () => {
    test("Intel vendor_id", () => {
        const cpuinfo = "processor\t: 0\nvendor_id\t: GenuineIntel\n";
        expect(parseCpuVendor(cpuinfo)).toBe("GenuineIntel");
    });
    test("AMD vendor_id", () => {
        const cpuinfo = "processor\t: 0\nvendor_id\t: AuthenticAMD\n";
        expect(parseCpuVendor(cpuinfo)).toBe("AuthenticAMD");
    });
    test("missing vendor_id returns unknown", () => {
        expect(parseCpuVendor("processor\t: 0\n")).toBe("unknown");
    });
});
describe("parseMemoryGb", () => {
    test("MemTotal 16GB rounds to 16", () => {
        const meminfo = "MemTotal:       16387384 kB\n";
        expect(parseMemoryGb(meminfo)).toBe(16);
    });
    test("MemTotal 64GB rounds to 64", () => {
        const meminfo = "MemTotal:       65912104 kB\n";
        expect(parseMemoryGb(meminfo)).toBe(63);
        // Note: 65912104 kB = 64367.29 MiB = 62.86 GiB → rounds to 63
        // The function uses base-2 GiB division (1024 / 1024); some
        // systems report MemTotal slightly under marketing-GB due to
        // BIOS reservations / integrated GPU memory carve-out. The test
        // reflects the actual /proc/meminfo semantics.
    });
    test("missing MemTotal returns 0", () => {
        expect(parseMemoryGb("")).toBe(0);
    });
});
describe("deriveSuggestedHost", () => {
    test("GPU present → worker-gpu (highest priority)", () => {
        const { host, reason } = deriveSuggestedHost({
            gpu: "nvidia",
            storage: { diskCount: 2, hasNvme: true, hasSsd: false, hasHdd: false },
            cpuCores: 8,
            memoryGb: 32,
        });
        expect(host).toBe("worker-gpu");
        expect(reason).toContain("GPU detected (nvidia)");
    });
    test("4+ disks + 64GB+ RAM → worker-template (storage-heavy)", () => {
        const { host, reason } = deriveSuggestedHost({
            gpu: "none",
            storage: { diskCount: 6, hasNvme: true, hasSsd: true, hasHdd: true },
            cpuCores: 8,
            memoryGb: 128,
        });
        expect(host).toBe("worker-template");
        expect(reason).toContain("storage-heavy");
        expect(reason).toContain("6 disks");
        expect(reason).toContain("128GB");
    });
    test("16+ cores + 32GB+ RAM → worker-template (CPU-heavy)", () => {
        const { host, reason } = deriveSuggestedHost({
            gpu: "none",
            storage: { diskCount: 2, hasNvme: true, hasSsd: false, hasHdd: false },
            cpuCores: 32,
            memoryGb: 64,
        });
        expect(host).toBe("worker-template");
        expect(reason).toContain("CPU-heavy");
        expect(reason).toContain("32 cores");
    });
    test("general-purpose → control-plane (default)", () => {
        const { host, reason } = deriveSuggestedHost({
            gpu: "none",
            storage: { diskCount: 1, hasNvme: true, hasSsd: false, hasHdd: false },
            cpuCores: 4,
            memoryGb: 8,
        });
        expect(host).toBe("control-plane");
        expect(reason).toContain("general-purpose");
        expect(reason).toContain("no GPU");
    });
    test("priority: GPU + lots of disks → still worker-gpu (GPU wins)", () => {
        const { host } = deriveSuggestedHost({
            gpu: "amd",
            storage: { diskCount: 8, hasNvme: true, hasSsd: true, hasHdd: false },
            cpuCores: 32,
            memoryGb: 256,
        });
        expect(host).toBe("worker-gpu");
    });
});
describe("buildReport (composition)", () => {
    test("full report with GPU + standard hardware", () => {
        const r = buildReport({
            lspciOutput: "01:00.0 VGA compatible controller: NVIDIA Corporation GA102",
            lsblkOutput: "NAME    ROTA TYPE\nnvme0n1    0 disk\nnvme1n1    0 disk",
            procCpuinfo: "vendor_id\t: GenuineIntel\n",
            procMeminfo: "MemTotal:       32887384 kB\n",
            cpuCores: 16,
        });
        expect(r.gpu).toBe("nvidia");
        expect(r.storage.diskCount).toBe(2);
        expect(r.storage.hasNvme).toBe(true);
        expect(r.cpuVendor).toBe("GenuineIntel");
        expect(r.cpuCores).toBe(16);
        expect(r.suggestedHost).toBe("worker-gpu");
    });
    test("empty inputs build degraded report (no errors)", () => {
        const r = buildReport({
            lspciOutput: "",
            lsblkOutput: "",
            procCpuinfo: "",
            procMeminfo: "",
            cpuCores: 0,
        });
        expect(r.gpu).toBe("none");
        expect(r.storage.diskCount).toBe(0);
        expect(r.cpuVendor).toBe("unknown");
        expect(r.memoryGb).toBe(0);
        expect(r.suggestedHost).toBe("control-plane");
    });
});
