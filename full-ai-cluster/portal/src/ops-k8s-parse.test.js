// full-ai-cluster/portal/src/ops-k8s-parse.test.ts
import { describe, expect, test } from "bun:test";
import { configMergePatch, deployableToConfig, lifecyclePlan, parseEvents, parseLogs, parseMetrics, parsePods } from "./ops-k8s-parse.js";
const NOW = Date.parse("2026-06-09T12:10:00Z");
describe("parsePods", () => {
    const items = [
        { metadata: { name: "clan-0" }, spec: { nodeName: "w-1", containers: [{ image: "gmod:1" }] }, status: { phase: "Running", podIP: "10.42.0.20", startTime: "2026-06-09T11:10:00Z", containerStatuses: [{ ready: true, restartCount: 0 }] } },
        { metadata: { name: "clan-1" }, spec: { nodeName: "w-2", containers: [{ image: "gmod:1" }] }, status: { phase: "Running", podIP: "10.42.0.21", startTime: "2026-06-09T12:09:00Z", containerStatuses: [{ ready: false, restartCount: 7, state: { waiting: { reason: "CrashLoopBackOff" } } }] } },
    ];
    test("maps name/node/ip/image, sums restarts, derives ready", () => {
        const p = parsePods(items, NOW);
        expect(p[0]).toMatchObject({ name: "clan-0", node: "w-1", ip: "10.42.0.20", image: "gmod:1", ready: true, restarts: 0, phase: "Running" });
        expect(p[0].ageSeconds).toBe(3600); // 1h
    });
    test("surfaces a waiting reason (CrashLoopBackOff) as the phase + not ready", () => {
        const p = parsePods(items, NOW);
        expect(p[1]).toMatchObject({ phase: "CrashLoopBackOff", ready: false, restarts: 7 });
    });
});
describe("parseLogs", () => {
    test("strips RFC3339 timestamps and infers levels", () => {
        const text = ["2026-06-09T12:00:01.5Z SteamCMD: app fully installed", "2026-06-09T12:09:48Z OOM: container killed", "2026-06-09T12:09:49Z WARN addon slow", "plain line no ts"].join("\n");
        const l = parseLogs(text);
        expect(l[0]).toMatchObject({ ts: "12:00:01", level: "info" });
        expect(l[1]).toMatchObject({ ts: "12:09:48", level: "error" });
        expect(l[2].level).toBe("warn");
        expect(l[3]).toMatchObject({ ts: "", text: "plain line no ts", level: "info" });
    });
    test("honours tail", () => {
        expect(parseLogs("a\nb\nc\nd\ne", 2).map((x) => x.text)).toEqual(["d", "e"]);
    });
});
describe("parseEvents", () => {
    test("maps type/reason/message, sorts oldest→newest", () => {
        const e = parseEvents([
            { type: "Warning", reason: "BackOff", message: "back-off restarting", lastTimestamp: "2026-06-09T12:09:50Z" },
            { type: "Normal", reason: "Scheduled", message: "assigned", lastTimestamp: "2026-06-09T12:00:00Z" },
        ]);
        expect(e[0]).toMatchObject({ reason: "Scheduled", type: "Normal", ts: "12:00:00" });
        expect(e[1]).toMatchObject({ reason: "BackOff", type: "Warning" });
        expect(e[1]._sort).toBeUndefined(); // internal field stripped
    });
});
describe("deployableToConfig + patches", () => {
    test("Deployable spec → ResourceConfig with defaults", () => {
        const c = deployableToConfig({ metadata: { name: "x", namespace: "n" }, spec: { blueprint: "gmod", replicas: 1, expose: "lan", size: { cpu: "2", memory: "6Gi", storage: "20Gi" }, values: { MAP: "gm_flatgrass" } } });
        expect(c).toMatchObject({ replicas: 1, cpu: "2", memory: "6Gi", storage: "20Gi", expose: "lan" });
        expect(c.values.MAP).toBe("gm_flatgrass");
    });
    test("configMergePatch builds a minimal spec patch", () => {
        expect(configMergePatch({ replicas: 3, memory: "8Gi", values: { MAP: "gm_construct" } })).toEqual({ spec: { replicas: 3, size: { memory: "8Gi" }, values: { MAP: "gm_construct" } } });
    });
});
describe("lifecyclePlan", () => {
    test("stop/start/scale/restart/delete", () => {
        expect(lifecyclePlan("stop", 3)).toMatchObject({ kind: "scale", replicas: 0 });
        expect(lifecyclePlan("start", 0)).toMatchObject({ kind: "scale", replicas: 1 });
        expect(lifecyclePlan("scale", 1, 5)).toMatchObject({ kind: "scale", replicas: 5 });
        expect(lifecyclePlan("restart", 1).kind).toBe("restart");
        expect(lifecyclePlan("delete", 1).kind).toBe("delete");
    });
});
describe("parseMetrics", () => {
    test("sums container usage across pods, fills limits + a window", () => {
        const m = parseMetrics([{ containers: [{ usage: { cpu: "500m", memory: "1Gi" } }, { usage: { cpu: "250m", memory: "256Mi" } }] }], { cpuMilli: 2000, memMi: 4096 }, 20480);
        expect(m.cpuMilli).toBe(750);
        expect(m.memMi).toBe(1280);
        expect(m.cpuLimitMilli).toBe(2000);
        expect(m.series.length).toBe(30);
        expect(m.storageTotalMi).toBe(20480);
    });
});
