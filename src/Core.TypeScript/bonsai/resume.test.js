import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { binary, cbool, cint, lambda, param } from "./bonsai";
import { parseState, resume, serializeState, start } from "./resume";
const goldenPath = join(dirname(fileURLToPath(import.meta.url)), "resume-golden.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
function stepOk(r) {
    if (!r.ok)
        throw new Error(`expected Ok SagaStep, got Error ${JSON.stringify(r.error)}`);
    return r.value;
}
// Replay each golden trace; at EVERY suspension persist the state and resume from the
// re-parsed state — proving restore-not-replay (the continuation round-trips; prior
// activities are never re-invoked) AND the cross-language suspension/final contract.
for (const tr of golden.traces) {
    test(`resume golden: ${tr.name}`, () => {
        // fixture schema: exactly one expected state-byte string and one activity result per
        // suspension — assert up front so a malformed golden fails as a clear schema mismatch,
        // not a confusing undefined compare inside the loop
        expect(tr.expectedStateAtSuspension.length).toBe(tr.expectedSuspensions.length);
        expect(tr.activityResults.length).toBe(tr.expectedSuspensions.length);
        let step = stepOk(start(tr.program, tr.bindings));
        for (let i = 0; i < tr.expectedSuspensions.length; i++) {
            expect(step.kind).toBe("suspended");
            if (step.kind !== "suspended")
                return;
            expect(step.activity).toEqual(tr.expectedSuspensions[i]);
            // persist → re-parse → resume from the RESTORED state (not a replay from the top)
            const ser = serializeState(step.state);
            expect(ser.ok).toBe(true);
            if (!ser.ok)
                return;
            // STATE-BYTE LOCK: the persisted continuation must equal the canonical bytes the TS
            // reference authored — the exact wire every ferry replays (kont serializes top-last)
            expect(ser.value).toBe(tr.expectedStateAtSuspension[i]);
            const restored = parseState(ser.value);
            expect(restored.ok).toBe(true);
            if (!restored.ok)
                return;
            // canonical round-trip is byte-stable
            const reser = serializeState(restored.value);
            expect(reser.ok).toBe(true);
            if (reser.ok)
                expect(reser.value).toBe(ser.value);
            step = stepOk(resume(restored.value, tr.activityResults[i]));
        }
        expect(step.kind).toBe("done");
        if (step.kind !== "done")
            return;
        expect(step.value).toEqual(tr.expectedFinal);
    });
}
test("golden traces are loaded", () => {
    expect(golden.traces.length).toBeGreaterThan(0);
});
// ---- feedback-variant rejections ----
test("unbound param declines Unbound", () => {
    const r = start(param("missing"));
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("Unbound");
});
test("type mismatch declines TypeMismatch", () => {
    // add requires int operands; a bool operand is a type error
    const r = start(binary("add", cint(1), cbool(true)));
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("TypeMismatch");
});
test("lambda in eval position declines UnsupportedNode (slice-1)", () => {
    const r = start(lambda(["x"], cint(1)));
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("UnsupportedNode");
});
test("a param named like an Object.prototype member declines Unbound (own-property lookup)", () => {
    for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
        const r = start(param(name)); // default {} bindings — must NOT resolve an inherited member
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.error.kind).toBe("Unbound");
    }
});
test("arithmetic past the safe-int range declines NonSafeInt", () => {
    const r = start(binary("add", cint(Number.MAX_SAFE_INTEGER), cint(1)));
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("NonSafeInt");
});
test("a restored env preserves a __proto__ binding (no prototype-setter hole)", () => {
    // "__proto__" is a legal Bonsai param name; a saga that captures it must round-trip through
    // persist/restore and still resolve the binding (not invoke the legacy prototype setter)
    const bindings = Object.create(null);
    bindings["__proto__"] = { t: "int", v: 5 };
    const program = binary("add", { kind: "call", fn: "a", args: [] }, param("__proto__"));
    const s0 = stepOk(start(program, bindings));
    expect(s0.kind).toBe("suspended");
    if (s0.kind !== "suspended")
        return;
    const ser = serializeState(s0.state);
    expect(ser.ok).toBe(true);
    if (!ser.ok)
        return;
    const restored = parseState(ser.value);
    expect(restored.ok).toBe(true);
    if (!restored.ok)
        return;
    // resume from the RESTORED state: param("__proto__") must resolve to 5 → add(10,5)=15,
    // not decline Unbound (which it would if readEnv had used the prototype setter)
    const r = resume(restored.value, { t: "int", v: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) {
        expect(r.value.kind).toBe("done");
        if (r.value.kind === "done")
            expect(r.value.value).toEqual({ t: "int", v: 15 });
    }
});
// ---- state serialization round-trip ----
test("serializeState / parseState round-trip + resume-from-restored equals resume-from-original", () => {
    // a 2-activity saga: suspend at the first, persist, restore, and resume both ways
    const program = binary("add", { kind: "call", fn: "x", args: [] }, { kind: "call", fn: "y", args: [] });
    const s0 = stepOk(start(program));
    expect(s0.kind).toBe("suspended");
    if (s0.kind !== "suspended")
        return;
    const ser = serializeState(s0.state);
    expect(ser.ok).toBe(true);
    if (!ser.ok)
        return;
    const restored = parseState(ser.value);
    expect(restored.ok).toBe(true);
    if (!restored.ok)
        return;
    const fromOriginal = stepOk(resume(s0.state, { t: "int", v: 1 }));
    const fromRestored = stepOk(resume(restored.value, { t: "int", v: 1 }));
    expect(fromRestored).toEqual(fromOriginal);
});
test("parseState declines MalformedState on junk + on an unsupported version", () => {
    const a = parseState("not json");
    expect(a.ok).toBe(false);
    if (!a.ok)
        expect(a.error.kind).toBe("MalformedState");
    const b = parseState('{"v":2,"kont":[],"awaiting":{"fn":"a","args":[]}}');
    expect(b.ok).toBe(false);
    if (!b.ok)
        expect(b.error.kind).toBe("MalformedState");
});
test("parseState declines MalformedState on a tampered/unknown operator in a restored frame", () => {
    // a real suspension whose kont carries an evalRight 'add' frame: add(a(), b()) at activity a
    const program = binary("add", { kind: "call", fn: "a", args: [] }, { kind: "call", fn: "b", args: [] });
    const s0 = stepOk(start(program));
    expect(s0.kind).toBe("suspended");
    if (s0.kind !== "suspended")
        return;
    const ser = serializeState(s0.state);
    expect(ser.ok).toBe(true);
    if (!ser.ok)
        return;
    // tamper the persisted op to an unknown one — must be rejected at the parse boundary,
    // never cast through to applyBinOp (which would silently yield undefined)
    const tampered = ser.value.replace('"op":"add"', '"op":"xor"');
    expect(tampered).not.toBe(ser.value);
    const r = parseState(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("MalformedState");
});
test("parseState declines MalformedState on an unsafe integer in a restored state", () => {
    // a suspension carrying an int activity-arg: act(7) → awaiting {act, args:[{int,7}]}
    const program = { kind: "call", fn: "act", args: [cint(7)] };
    const s0 = stepOk(start(program));
    expect(s0.kind).toBe("suspended");
    if (s0.kind !== "suspended")
        return;
    const ser = serializeState(s0.state);
    expect(ser.ok).toBe(true);
    if (!ser.ok)
        return;
    // tamper the persisted int beyond 2^53-1 — JSON.parse rounds it to an integer, but the
    // safe-int wire contract must reject it rather than resume a corrupted value
    const tampered = ser.value.replace('"v":7', '"v":9007199254740993');
    expect(tampered).not.toBe(ser.value);
    const r = parseState(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok)
        expect(r.error.kind).toBe("MalformedState");
});
