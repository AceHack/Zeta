// full-ai-cluster/platform-controller/src/room.test.ts
//
// The Room: attribution, Z-set retraction (corrections not deletions), the
// operating loop (auto-act vs propose), the human-only authorization gate, and
// the COLLABORATION-MODEL.md GMod-crash worked example end to end.
import { describe, expect, test } from "bun:test";
import { human, persona, Room } from "./room.js";
const POLICY = {
    domains: [
        { name: "lifecycle", autonomy: "auto" },
        { name: "scaling", autonomy: "auto" },
        { name: "data", autonomy: "forbidden" },
    ],
    gatedClasses: ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"],
};
const otto = persona("otto");
const aaron = human("aaron");
const scaleInQuota = { domain: "scaling", summary: "bump mem 4→6Gi + restart" };
const scaleOverQuota = { domain: "scaling", gated: "budget", summary: "bump mem 4→8Gi (exceeds quota)" };
const deleteVolume = { domain: "data", gated: "non-reversible", summary: "delete the world volume" };
describe("attribution + glass halo", () => {
    test("every event records who proposed it", () => {
        const r = new Room("tenant-a/clan-server");
        r.post(aaron, "please add gm_flatgrass");
        const e = r.post(otto, "on it");
        expect(e.sig.proposedBy).toEqual(otto);
        expect(r.participants().map((p) => p.id).sort()).toEqual(["aaron", "otto"]);
    });
});
describe("Z-set retraction — corrections, not deletions", () => {
    test("a retracted event leaves the trace but drops out of the live view", () => {
        const r = new Room("tenant-a/clan-server");
        const wrong = r.post(otto, "restarting the WRONG server");
        expect(r.live().some((e) => e.id === wrong.id)).toBe(true);
        const ret = r.retract(otto, wrong.id, "wrong target");
        expect(ret.weight).toBe(-1);
        expect(r.live().some((e) => e.id === wrong.id)).toBe(false); // gone from live
        expect(r.trace().some((e) => e.id === wrong.id)).toBe(true); // still in the trace
        expect(r.trace().some((e) => e.id === ret.id)).toBe(true); // and so is the retraction
    });
    test("retracting an unknown event throws", () => {
        expect(() => new Room("x").retract(otto, "evt-999")).toThrow();
    });
});
describe("operating loop — auto vs propose vs forbidden", () => {
    test("auto: an in-quota scale acts immediately and records the action", () => {
        const r = new Room("tenant-a/clan-server");
        const ran = [];
        const out = r.operate(otto, scaleInQuota, POLICY, (a) => {
            ran.push(a.summary);
            return "scaled";
        });
        expect(out.kind).toBe("acted");
        expect(ran).toEqual(["bump mem 4→6Gi + restart"]);
        if (out.kind === "acted")
            expect(out.event.body).toMatchObject({ type: "action", result: "scaled" });
    });
    test("propose: a budget-gated scale emits an authorization-request and does NOT run", () => {
        const r = new Room("tenant-a/clan-server");
        let ran = false;
        const out = r.operate(otto, scaleOverQuota, POLICY, () => ((ran = true), "x"));
        expect(out.kind).toBe("proposed");
        expect(ran).toBe(false); // nothing happened without a human grant
        expect(r.pendingAuthorizations().length).toBe(1);
    });
    test("forbidden: a data-domain delete is refused with a reason, nothing appended", () => {
        const r = new Room("tenant-a/clan-server");
        const before = r.trace().length;
        const out = r.operate(otto, deleteVolume, POLICY);
        expect(out.kind).toBe("refused");
        expect(r.trace().length).toBe(before);
    });
});
describe("authorization gate — only a human authorizes (source ≠ authorization)", () => {
    test("a persona cannot grant", () => {
        const r = new Room("x");
        const out = r.operate(otto, scaleOverQuota, POLICY);
        if (out.kind !== "proposed")
            throw new Error("expected proposed");
        expect(() => r.grant(persona("lior"), out.request.id, true)).toThrow();
    });
    test("actOnGrant refuses until a human grants, then runs and records authorized-by", () => {
        const r = new Room("x");
        const out = r.operate(otto, scaleOverQuota, POLICY);
        if (out.kind !== "proposed")
            throw new Error("expected proposed");
        // before any grant: refused
        expect(r.actOnGrant(otto, out.request.id).kind).toBe("refused");
        // human grants → now it runs, and the action carries authorized-by = the human
        r.grant(aaron, out.request.id, true, "approved the spend");
        let ran = false;
        const done = r.actOnGrant(otto, out.request.id, () => ((ran = true), "scaled to 8Gi"));
        expect(done.kind).toBe("acted");
        expect(ran).toBe(true);
        if (done.kind === "acted") {
            expect(done.event.sig.authorizedBy).toEqual(aaron);
            expect(r.pendingAuthorizations().length).toBe(0);
        }
    });
    test("a denied grant keeps the action from running", () => {
        const r = new Room("x");
        const out = r.operate(otto, scaleOverQuota, POLICY);
        if (out.kind !== "proposed")
            throw new Error("expected proposed");
        r.grant(aaron, out.request.id, false, "too expensive this month");
        expect(r.actOnGrant(otto, out.request.id).kind).toBe("refused");
    });
});
describe("determinism — a Room replays identically (DST)", () => {
    test("event ids derive from sequence, not wall-clock", () => {
        const build = () => {
            const r = new Room("x");
            r.post(aaron, "hi");
            r.operate(otto, scaleInQuota, POLICY, () => "ok");
            return r.trace().map((e) => e.id);
        };
        expect(build()).toEqual(build());
        expect(build()).toEqual(["evt-0", "evt-1"]);
    });
});
describe("GMod-crash worked example (COLLABORATION-MODEL.md §6)", () => {
    test("OOM → persona enters → in-quota auto-fix, all attributed and live", () => {
        const r = new Room("acme/gmod-sandbox");
        r.stateChange(persona("system"), "Running");
        // server OOMs
        r.stateChange(persona("system"), "CrashLoopBackOff", "OOMKilled at 4Gi");
        // ops persona enters and proposes a plan, then acts (scaling within quota = auto)
        r.post(otto, "crash: OOM. Plan: bump mem 4→6 GB + restart.");
        const out = r.operate(otto, scaleInQuota, POLICY, () => "patched StatefulSet to 6Gi, restarted");
        expect(out.kind).toBe("acted");
        r.stateChange(otto, "Running", "recovered at 6Gi");
        expect(r.phase()).toBe("Running");
        // the whole exchange is on the glass-halo stream, attributed to system + otto
        expect(r.participants().map((p) => p.id).sort()).toEqual(["otto", "system"]);
    });
    test("OOM fix that exceeds quota → inline gated:budget approval, then recovery", () => {
        const r = new Room("acme/gmod-sandbox");
        r.stateChange(persona("system"), "CrashLoopBackOff", "OOMKilled at 6Gi");
        r.post(otto, "needs 8Gi — exceeds Acme's quota. Requesting approval.");
        const out = r.operate(otto, scaleOverQuota, POLICY); // budget-gated → propose
        expect(out.kind).toBe("proposed");
        if (out.kind !== "proposed")
            return;
        // human approves inline
        r.grant(aaron, out.request.id, true, "ok for this month");
        const done = r.actOnGrant(otto, out.request.id, () => "scaled to 8Gi");
        expect(done.kind).toBe("acted");
        r.stateChange(otto, "Running", "recovered at 8Gi");
        expect(r.phase()).toBe("Running");
        expect(r.pendingAuthorizations().length).toBe(0);
    });
});
