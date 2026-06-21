// full-ai-cluster/platform-controller/src/signals.test.ts
//
// Trigger detection + the signal→remediation classification, and the full
// detect→decide→Room path: an OOM signal driving the operating loop, both the
// in-quota (auto) and over-quota (gated:budget → propose) branches.
import { describe, expect, test } from "bun:test";
import { decide } from "./policy.js";
import { persona, Room } from "./room.js";
import { podSignal, pvcSignal, remediate } from "./signals.js";
const POLICY = {
    domains: [
        { name: "lifecycle", autonomy: "auto" },
        { name: "scaling", autonomy: "auto" },
        { name: "config", autonomy: "auto" },
        { name: "data", autonomy: "forbidden" },
    ],
    gatedClasses: ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"],
};
describe("podSignal classification", () => {
    test("detects OOMKilled from lastState", () => {
        const s = podSignal({ status: { containerStatuses: [{ restartCount: 3, lastState: { terminated: { reason: "OOMKilled", exitCode: 137 } } }] } });
        expect(s.kind).toBe("oom");
    });
    test("detects CrashLoopBackOff", () => {
        expect(podSignal({ status: { containerStatuses: [{ state: { waiting: { reason: "CrashLoopBackOff" } } }] } }).kind).toBe("crashloop");
    });
    test("detects ImagePullBackOff", () => {
        expect(podSignal({ status: { containerStatuses: [{ state: { waiting: { reason: "ImagePullBackOff" } } }] } }).kind).toBe("image-pull-error");
    });
    test("Ready=False but no container fault → unready", () => {
        expect(podSignal({ status: { conditions: [{ type: "Ready", status: "False", reason: "ContainersNotReady" }] } }).kind).toBe("unready");
    });
    test("a running, ready pod is healthy", () => {
        expect(podSignal({ status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }], containerStatuses: [{ ready: true }] } }).kind).toBe("healthy");
    });
    test("OOM takes priority over a crashloop waiting state on the same container", () => {
        const s = podSignal({ status: { containerStatuses: [{ restartCount: 5, state: { waiting: { reason: "CrashLoopBackOff" } }, lastState: { terminated: { reason: "OOMKilled" } } }] } });
        expect(s.kind).toBe("oom");
    });
});
describe("pvcSignal", () => {
    test("Pending PVC produces a signal; Bound produces none", () => {
        expect(pvcSignal({ status: { phase: "Pending" } })?.kind).toBe("pvc-pending");
        expect(pvcSignal({ status: { phase: "Bound" } })).toBeUndefined();
    });
});
describe("remediate — the gating flips on quota, not on the fix", () => {
    test("in-quota OOM fix is plain scaling (auto under default Policy)", () => {
        const rem = remediate({ kind: "oom", detail: "x" }, { withinQuota: true });
        expect(rem.action.domain).toBe("scaling");
        expect(rem.action.gated).toBeUndefined();
        expect(decide(POLICY, rem.action).level).toBe("auto");
    });
    test("over-quota OOM fix is budget-gated (→ propose, needs a human)", () => {
        const rem = remediate({ kind: "oom", detail: "x" }, { withinQuota: false });
        expect(rem.action.gated).toBe("budget");
        expect(decide(POLICY, rem.action).level).toBe("propose");
    });
    test("a healthy signal yields no remediation", () => {
        expect(remediate({ kind: "healthy", detail: "Running" })).toBeUndefined();
    });
});
describe("detect → decide → Room (end to end)", () => {
    const otto = persona("otto");
    test("in-quota OOM: signal drives an auto remediation posted to the Room", () => {
        const pod = { status: { containerStatuses: [{ restartCount: 2, lastState: { terminated: { reason: "OOMKilled" } } }] } };
        const sig = podSignal(pod);
        const rem = remediate(sig, { withinQuota: true });
        const r = new Room("acme/gmod-sandbox");
        r.stateChange(persona("system"), "CrashLoopBackOff", sig.detail);
        r.post(otto, rem.plan);
        const out = r.operate(otto, rem.action, POLICY, () => "scaled + restarted");
        expect(out.kind).toBe("acted");
        r.stateChange(otto, "Running", "recovered");
        expect(r.phase()).toBe("Running");
    });
    test("over-quota OOM: signal drives a proposal that waits for a human grant", () => {
        const sig = podSignal({ status: { containerStatuses: [{ lastState: { terminated: { reason: "OOMKilled" } } }] } });
        const rem = remediate(sig, { withinQuota: false });
        const r = new Room("acme/gmod-sandbox");
        const out = r.operate(otto, rem.action, POLICY);
        expect(out.kind).toBe("proposed");
        expect(r.pendingAuthorizations().length).toBe(1);
    });
});
