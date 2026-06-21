/**
 * bonsai.test.ts — TS reference (oracle #1) for the Bonsai-subset serializer
 * (081KT07NV0008QG0R003BE6MJ2 slice 1).
 *
 * `serialize`/`parse` return `Result<_, BonsaiFeedback>` (result over throw, matching
 * the F# oracle). Duties:
 *   1. **Canonical serialize is byte-exact** — `serialize(expr)` is `Ok canonical`
 *      for every shared golden vector (the cross-language parity lock).
 *   2. **`parse` round-trips** — `equals(parse(canonical), expr)` and
 *      `serialize(parse(canonical))` is `Ok canonical` (canonical is the fixed point).
 *   3. **Rejection contract** — bad input declines the **specific** `BonsaiFeedback`
 *      variant (the cross-oracle rejection-vector contract), and no exception ever
 *      crosses the boundary (even on `null`).
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { BONSAI_MAX_DEPTH, cint, equals, param, parse, parseAll, serialize, toProblemDetails, } from "./bonsai";
const golden = JSON.parse(readFileSync(pathJoin(import.meta.dir, "golden-vectors.json"), "utf8"));
// Unwrap an Ok, or fail the test with the feedback.
function expectOk(r) {
    if (!r.ok)
        throw new Error(`expected Ok, got Error ${JSON.stringify(r.error)}`);
    return r.value;
}
// The feedback variant of an Error result, or null when Ok.
function errKind(r) {
    return r.ok ? null : r.error.kind;
}
describe("Bonsai-subset — golden vectors (oracle #1 / parity lock)", () => {
    it("the fixture is non-empty and version 1", () => {
        expect(golden.version).toBe(1);
        expect(golden.cases.length).toBeGreaterThan(0);
    });
    for (const c of golden.cases) {
        it(`${c.name}: serialize(expr) is Ok byte-exact canonical`, () => {
            expect(expectOk(serialize(c.expr))).toBe(c.canonical);
        });
        it(`${c.name}: parse(canonical) structurally equals expr`, () => {
            expect(equals(expectOk(parse(c.canonical)), c.expr)).toBe(true);
        });
        it(`${c.name}: canonical is the serialize fixed point`, () => {
            expect(expectOk(serialize(expectOk(parse(c.canonical))))).toBe(c.canonical);
        });
    }
});
describe("Bonsai-subset — round-trip + structural laws", () => {
    it("serialize ∘ parse ∘ serialize == serialize (every case)", () => {
        for (const c of golden.cases) {
            const once = expectOk(serialize(c.expr));
            expect(expectOk(serialize(expectOk(parse(once))))).toBe(once);
        }
    });
    it("equals is reflexive (every case)", () => {
        for (const c of golden.cases) {
            expect(equals(c.expr, c.expr)).toBe(true);
        }
    });
    it("distinct cases are not equal (no false collisions)", () => {
        const exprs = golden.cases.map((c) => c.expr);
        for (let i = 0; i < exprs.length; i++) {
            for (let j = i + 1; j < exprs.length; j++) {
                if (expectOk(serialize(exprs[i])) !== expectOk(serialize(exprs[j]))) {
                    expect(equals(exprs[i], exprs[j])).toBe(false);
                }
            }
        }
    });
});
describe("Bonsai-subset — rejection contract (declines the specific variant)", () => {
    it("parse declines an unknown node kind with UnknownKind", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"bogus"}}'))).toBe("UnknownKind");
    });
    it("parse declines an unsupported version with UnsupportedVersion", () => {
        expect(errKind(parse('{"v":2,"expr":{"kind":"param","name":"x"}}'))).toBe("UnsupportedVersion");
    });
    it("parse declines an unknown binary operator with UnknownOp", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"binary","op":"div","left":{"kind":"param","name":"a"},"right":{"kind":"param","name":"b"}}}'))).toBe("UnknownOp");
    });
    it("parse declines an unknown const tag with UnknownConstTag", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"const","value":{"t":"bogus"}}}'))).toBe("UnknownConstTag");
    });
    it("parse declines a fractional int literal with ExpectedInt", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"const","value":{"t":"int","v":1.5}}}'))).toBe("ExpectedInt");
    });
    it("parse declines an int beyond the safe-integer range with NonSafeInt", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"const","value":{"t":"int","v":99999999999999999}}}'))).toBe("NonSafeInt");
    });
    it("parse declines a null const string value with ExpectedString", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"const","value":{"t":"str","v":null}}}'))).toBe("ExpectedString");
    });
    it("parse declines a non-boolean bool literal with ExpectedBool", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"const","value":{"t":"bool","v":1}}}'))).toBe("ExpectedBool");
    });
    it("parse declines non-array call args with MalformedJson", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"call","fn":"f","args":"nope"}}'))).toBe("MalformedJson");
    });
    it("parse declines a null expr with MalformedJson", () => {
        expect(errKind(parse('{"v":1,"expr":null}'))).toBe("MalformedJson");
    });
    it("parse declines malformed JSON with MalformedJson", () => {
        expect(errKind(parse("not json at all"))).toBe("MalformedJson");
    });
});
describe("Bonsai-subset — canonical-only (the serialize∘parse fixed point)", () => {
    it("declines an unknown extra field with NonCanonical", () => {
        expect(errKind(parse('{"v":1,"expr":{"kind":"param","name":"x","extra":0}}'))).toBe("NonCanonical");
    });
    it("declines non-canonical whitespace with NonCanonical", () => {
        expect(errKind(parse('{"v":1, "expr":{"kind":"param","name":"x"}}'))).toBe("NonCanonical");
    });
    it("declines non-canonical key order with NonCanonical", () => {
        expect(errKind(parse('{"expr":{"kind":"param","name":"x"},"v":1}'))).toBe("NonCanonical");
    });
});
describe("Bonsai-subset — total contract (no exception escapes, even on null)", () => {
    it("serialize declines an unsafe-integer constant with NonSafeInt (cint is total)", () => {
        expect(errKind(serialize(cint(2 ** 53)))).toBe("NonSafeInt"); // 2^53 is NOT safe (MAX is 2^53 - 1)
    });
    it("serialize declines a fractional constant with ExpectedInt", () => {
        expect(errKind(serialize(cint(1.5)))).toBe("ExpectedInt");
    });
    it("serialize accepts the safe-integer boundary (2^53 - 1)", () => {
        expect(expectOk(serialize(cint(2 ** 53 - 1)))).toBe('{"v":1,"expr":{"kind":"const","value":{"t":"int","v":9007199254740991}}}');
    });
    it("serialize declines a null string field with ExpectedString (no NRE)", () => {
        // A JS caller (no TS types) can pass null through param(); decline cleanly.
        expect(errKind(serialize(param(null)))).toBe("ExpectedString");
    });
    it("parse declines null input with MalformedJson (no throw)", () => {
        expect(errKind(parse(null))).toBe("MalformedJson");
    });
    it("serialize declines an invalid binary operator with UnknownOp (boundary symmetry with parse)", () => {
        const bad = { kind: "binary", op: "div", left: cint(1), right: cint(2) };
        expect(errKind(serialize(bad))).toBe("UnknownOp");
    });
    it("serialize declines a non-boolean bool constant with ExpectedBool (boundary symmetry with parse)", () => {
        const bad = { kind: "const", value: { t: "bool", v: 1 } };
        expect(errKind(serialize(bad))).toBe("ExpectedBool");
    });
});
describe("Bonsai-subset — nesting-depth contract (shared MaxDepth, bounded)", () => {
    const buildDeepChain = (n) => {
        let e = cint(1);
        for (let i = 0; i < n; i++)
            e = { kind: "binary", op: "add", left: e, right: cint(0) };
        return e;
    };
    it("a deep-but-valid expression round-trips (past JSON's typical default depth)", () => {
        const deep = buildDeepChain(100);
        expect(equals(expectOk(parse(expectOk(serialize(deep)))), deep)).toBe(true);
    });
    it("serialize declines an expression past the shared MaxDepth with TooDeep", () => {
        expect(errKind(serialize(buildDeepChain(BONSAI_MAX_DEPTH + 50)))).toBe("TooDeep");
    });
    it("parse declines a deeply-nested document with TooDeep during parsing (bounded recursion)", () => {
        // Build an over-MaxDepth JSON document by hand (can't via serialize — it
        // declines first); parse must decline TooDeep via the parseNode depth counter,
        // not recurse to a stack-overflow before the serialize guard.
        let node = '{"kind":"const","value":{"t":"int","v":1}}';
        for (let i = 0; i < BONSAI_MAX_DEPTH + 50; i++) {
            node = `{"kind":"binary","op":"add","left":${node},"right":{"kind":"const","value":{"t":"int","v":0}}}`;
        }
        expect(errKind(parse(`{"v":1,"expr":${node}}`))).toBe("TooDeep");
    });
});
describe("Bonsai-subset — accumulate-mode (parseAll + ProblemDetails)", () => {
    it("parseAll returns Ok(Expr) for every valid canonical golden vector", () => {
        for (const c of golden.cases) {
            const r = parseAll(c.canonical);
            expect(r.ok).toBe(true);
            if (r.ok)
                expect(equals(r.value, c.expr)).toBe(true);
        }
    });
    it("parseAll collects EVERY independent decline with its JSON-path (not just the first)", () => {
        // op="div" (UnknownOp @ $.expr.op) + left name=null (ExpectedString @ $.expr.left.name)
        // + right bool v=1 (ExpectedBool @ $.expr.right.value) — three independent errors.
        const doc = '{"v":1,"expr":{"kind":"binary","op":"div","left":{"kind":"param","name":null},"right":{"kind":"const","value":{"t":"bool","v":1}}}}';
        const r = parseAll(doc);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.error.map((e) => e.feedback.kind).sort()).toEqual(["ExpectedBool", "ExpectedString", "UnknownOp"]);
            expect(r.error.map((e) => e.path).sort()).toEqual(["$.expr.left.name", "$.expr.op", "$.expr.right.value"]);
        }
    });
    it("toProblemDetails groups the declines into an RFC-9457 errors map keyed by path", () => {
        const doc = '{"v":1,"expr":{"kind":"binary","op":"div","left":{"kind":"param","name":null},"right":{"kind":"const","value":{"t":"int","v":1.5}}}}';
        const r = parseAll(doc);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            const pd = toProblemDetails(r.error);
            expect(pd.title).toBe("Bonsai validation failed");
            expect(Object.keys(pd.errors).sort()).toEqual(["$.expr.left.name", "$.expr.op", "$.expr.right.value"]);
            expect(pd.errors["$.expr.op"]?.length).toBe(1);
        }
    });
    it("parseAll returns a single decline for fatal-structural input (malformed JSON)", () => {
        const r = parseAll("not json");
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.error).toHaveLength(1);
            expect(r.error[0].feedback.kind).toBe("MalformedJson");
        }
    });
    it("parseAll declines NonCanonical (single) for structurally-valid but non-canonical input", () => {
        const r = parseAll('{"v":1,"expr":{"kind":"param","name":"x","extra":0}}');
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.error).toHaveLength(1);
            expect(r.error[0].feedback.kind).toBe("NonCanonical");
        }
    });
});
