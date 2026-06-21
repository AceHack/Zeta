// full-ai-cluster/platform-controller/src/room.ts
//
// The Room — the shared, attributed, retraction-native collaboration stream
// around a Resource (COLLABORATION-MODEL.md §3). One ordered Event stream that
// humans and personas both write to. The doctrine, made operable:
//   • Append-only + attributed   — every Event carries an AgencySignature
//     (proposed-by = source, zero authority; authorized-by = a human, for gated).
//   • Corrections, not deletions  — undo is a Z-set RETRACTION (+1 then −1; both
//     persist in the trace). HC-2 retraction-native made visible.
//   • Glass halo                  — agent moves AND human authorizations share one
//     see-through surface; neither can hide a move.
//   • Deterministic               — Event ids derive from sequence, no wall-clock,
//     so a Room replays identically (manifesto §7 DST). Timestamps, if any, are
//     attached by the caller, never minted here.
//
// The operating loop (operate()) is the agent hook: trigger → decide(Policy) →
// auto-act | propose (authorization-request, wait) | forbidden.
import { decide } from "./policy.js";
export const persona = (id) => ({ id, kind: "persona" });
export const human = (id) => ({ id, kind: "human" });
export class Room {
    resource; // namespace/name of the Resource this Room is about
    events = [];
    seq = 0;
    constructor(resource) {
        this.resource = resource;
    }
    /** All events, in order, including retracted ones (the trace is never rewritten). */
    trace() {
        return this.events;
    }
    append(sig, body, weight = 1) {
        const ev = { id: `evt-${this.seq}`, seq: this.seq, weight, sig, body };
        this.seq++;
        this.events.push(ev);
        return ev;
    }
    // ── primitives ───────────────────────────────────────────────────────
    post(by, text) {
        return this.append({ proposedBy: by }, { type: "message", text });
    }
    stateChange(by, phase, detail) {
        return this.append({ proposedBy: by }, { type: "state-change", phase, ...(detail ? { detail } : {}) });
    }
    /** Z-set retraction: append a −1 that references the retracted event. Both persist. */
    retract(by, eventId, note) {
        if (!this.events.some((e) => e.id === eventId))
            throw new Error(`cannot retract unknown event ${eventId}`);
        return this.append({ proposedBy: by }, { type: "retraction", retracts: eventId, ...(note ? { note } : {}) }, -1);
    }
    // ── the operating loop (the agent hook) ──────────────────────────────
    /**
     * A persona attempts an Action under a Policy. Returns what happened:
     *  - auto      → the action Event is appended (acted)
     *  - propose   → an authorization-request Event is appended; caller waits for grant (proposed)
     *  - forbidden → nothing is appended; the refusal is returned (refused)
     * Source != authorization: proposing never confers authority — only grant() (by a human) does.
     */
    operate(by, action, policy, run) {
        const d = decide(policy, action);
        if (d.level === "forbidden")
            return { kind: "refused", decision: d };
        if (d.level === "propose") {
            const request = this.append({ proposedBy: by }, { type: "authorization-request", action, ...(d.gated ? { gated: d.gated } : {}) });
            return { kind: "proposed", request };
        }
        const result = run?.(action);
        const event = this.append({ proposedBy: by }, { type: "action", action, ...(result !== undefined ? { result } : {}) });
        return { kind: "acted", event };
    }
    /**
     * A human grants (or denies) a pending authorization-request. ONLY a human may
     * authorize a gated class (no-directives: authorization is human-attached).
     */
    grant(by, requestId, granted, note) {
        if (by.kind !== "human")
            throw new Error("only a human may authorize a gated action (source ≠ authorization)");
        const req = this.events.find((e) => e.id === requestId && e.body.type === "authorization-request");
        if (!req)
            throw new Error(`no authorization-request ${requestId}`);
        return this.append({ proposedBy: by, authorizedBy: by }, { type: "authorization-grant", requestId, granted, ...(note ? { note } : {}) });
    }
    /**
     * After a grant, the proposer performs the now-authorized action. Refuses if the
     * request was not granted — closing the loop: a proposed action runs only on a
     * human grant, and the resulting Event records authorized-by.
     */
    actOnGrant(by, requestId, run) {
        const req = this.events.find((e) => e.id === requestId);
        if (!req || req.body.type !== "authorization-request")
            throw new Error(`no authorization-request ${requestId}`);
        const grant = this.latestGrant(requestId);
        if (!grant || grant.body.type !== "authorization-grant" || !grant.body.granted) {
            return { kind: "refused", decision: { level: "forbidden", reason: `authorization ${requestId} not granted` } };
        }
        const action = req.body.action;
        const result = run?.(action);
        const event = this.append({ proposedBy: by, ...(grant.sig.authorizedBy !== undefined ? { authorizedBy: grant.sig.authorizedBy } : {}) }, { type: "action", action, ...(result !== undefined ? { result } : {}) });
        return { kind: "acted", event };
    }
    // ── projections (the live view; retractions net out) ─────────────────
    /** Events whose net Z-set weight is > 0 — i.e. not retracted. The trace itself is intact. */
    live() {
        const retracted = new Set();
        for (const e of this.events)
            if (e.body.type === "retraction")
                retracted.add(e.body.retracts);
        return this.events.filter((e) => e.weight === 1 && e.body.type !== "retraction" && !retracted.has(e.id));
    }
    /** The latest non-retracted state-change phase, or undefined. */
    phase() {
        const states = this.live().filter((e) => e.body.type === "state-change");
        const last = states[states.length - 1];
        return last && last.body.type === "state-change" ? last.body.phase : undefined;
    }
    latestGrant(requestId) {
        const grants = this.events.filter((e) => e.body.type === "authorization-grant" && e.body.requestId === requestId);
        return grants[grants.length - 1];
    }
    /** Authorization-requests with no (granted) decision yet — the "needs-a-human" set. */
    pendingAuthorizations() {
        const decided = new Set();
        for (const e of this.events)
            if (e.body.type === "authorization-grant")
                decided.add(e.body.requestId);
        return this.live().filter((e) => e.body.type === "authorization-request" && !decided.has(e.id));
    }
    /** Distinct participants who have appeared in the stream. */
    participants() {
        const seen = new Map();
        for (const e of this.events)
            seen.set(`${e.sig.proposedBy.kind}:${e.sig.proposedBy.id}`, e.sig.proposedBy);
        return [...seen.values()];
    }
}
