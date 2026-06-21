import { describe, expect, test } from "bun:test";
import { isSafeNodeName, nfdLabelLines, parseNodeNames, renderSummary } from "./capture";
describe("parseNodeNames", () => {
    test("splits kubectl jsonpath node output", () => {
        expect(parseNodeNames("control-plane worker-gpu-01\nworker-gpu-02")).toEqual([
            "control-plane",
            "worker-gpu-01",
            "worker-gpu-02",
        ]);
    });
});
describe("isSafeNodeName", () => {
    test("accepts Kubernetes-style node names", () => {
        expect(isSafeNodeName("worker-gpu-01")).toBe(true);
        expect(isSafeNodeName("node-1.example")).toBe(true);
    });
    test("rejects names that could alter ssh or kubectl invocation shape", () => {
        expect(isSafeNodeName("-bad")).toBe(false);
        expect(isSafeNodeName("bad node")).toBe(false);
        expect(isSafeNodeName("bad/node")).toBe(false);
    });
});
describe("nfdLabelLines", () => {
    test("filters and sorts NFD labels", () => {
        expect(nfdLabelLines({
            "kubernetes.io/hostname": "worker-gpu-01",
            "feature.node.kubernetes.io/pci-10de.present": "true",
            "feature.node.kubernetes.io/cpu-cpuid.AVX512F": true,
        })).toEqual([
            "feature.node.kubernetes.io/cpu-cpuid.AVX512F=true",
            "feature.node.kubernetes.io/pci-10de.present=true",
        ]);
    });
});
describe("renderSummary", () => {
    test("renders the stable section shape from label lines", () => {
        const summary = renderSummary("worker-gpu-01", [
            "feature.node.kubernetes.io/cpu-cpuid.AVX512F=true",
            "feature.node.kubernetes.io/storage-nonrotationaldisk=true",
            "feature.node.kubernetes.io/pci-10de.present=true",
            "feature.node.kubernetes.io/network-sriov.capable=true",
        ], "2026-05-26T21:40:00Z");
        expect(summary).toContain("# worker-gpu-01");
        expect(summary).toContain("Captured: 2026-05-26T21:40:00Z");
        expect(summary).toContain("## CPU");
        expect(summary).toContain("feature.node.kubernetes.io/cpu-cpuid.AVX512F=true");
        expect(summary).toContain("## Memory + Storage");
        expect(summary).toContain("feature.node.kubernetes.io/storage-nonrotationaldisk=true");
        expect(summary).toContain("## PCI vendors present (top 10)");
        expect(summary).toContain("feature.node.kubernetes.io/pci-10de.present=true");
        expect(summary).toContain("## Network");
        expect(summary).toContain("feature.node.kubernetes.io/network-sriov.capable=true");
    });
});
