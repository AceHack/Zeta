/**
 * resume.ts — TS reference (oracle #1) for the **resume engine** (081KT07NV0008QG0R003BE6MJ2 slice), the
 * self-evolving-saga kernel that the serialized Bonsai expression-tree feeds. Where
 * `bonsai.ts` is the *serializer* (the deferred computation's shape), this is the *evaluator*
 * that runs that shape with **restore-not-replay** durable execution.
 *
 * The model is a small-step **CEK machine** (Control / Environment / Kontinuation). The
 * Bonsai-subset `Expr` is the program; **`call` nodes are activities** — the suspension points
 * (the saga's awaits). Evaluation runs the pure parts inline (`const`/`param`/`binary`/`cond`)
 * until it needs an activity result, then **suspends**: the machine hands back a fully
 * **serializable `SagaState`** — the remaining continuation (the `kont` stack) plus the pending
 * activity call. `resume(state, result)` **restores** that continuation and feeds the activity
 * result back as the call's value; it does **not** replay from the top, so prior activities are
 * never re-invoked (the distinguishing property vs Temporal-style replay-with-memoization).
 *
 * The continuation IS the closure: a `kont` frame captures exactly the environment + sub-expr
 * it still needs ("serialize closure + expr-tree" per the slice). The whole `SagaState`
 * round-trips through `serializeState`/`parseState` so a saga can be persisted at a suspension
 * and resumed later (or, once the F#/C#/Rust oracles ferry this, on another machine).
 *
 * Slice-1 scope: `const`/`param`/`binary`/`cond`/`call` (activity). `lambda` application is
 * deferred (slice-2) — a `lambda` in evaluation position declines `UnsupportedNode`.
 */

import type { BinOp, ConstValue, Expr, Result } from "./bonsai";
import { serialize, parse } from "./bonsai";

/** The resume-state serialization version (the `v` field of the persisted wrapper). */
export const RESUME_VERSION = 1;

/** An environment: parameter name → bound value (the saga's captured bindings). */
export type Env = Readonly<Record<string, ConstValue>>;

/** The typed reasons the evaluator declines — the shared cross-oracle payload contract. */
export type ResumeFeedback =
  | { readonly kind: "Unbound"; readonly name: string }
  | { readonly kind: "TypeMismatch"; readonly where: string; readonly expected: string }
  | { readonly kind: "UnsupportedNode"; readonly nodeKind: string }
  // an int operation/value left the shared JS-safe-integer wire domain (the Bonsai contract)
  | { readonly kind: "NonSafeInt"; readonly value: number }
  | { readonly kind: "MalformedState"; readonly message: string };

/**
 * A defunctionalized continuation frame — one pending operation waiting on a sub-result, with
 * exactly the environment + expression it still needs (the serialized closure). The `kont`
 * stack of these IS the suspended computation.
 */
export type Frame =
  // computed the left operand; next evaluate the right (in `env`), then apply `op`
  | { readonly k: "evalRight"; readonly op: BinOp; readonly right: Expr; readonly env: Env }
  // computed both operands; apply `op` to (`left`, the returning value)
  | { readonly k: "applyOp"; readonly op: BinOp; readonly left: ConstValue }
  // computed the test; pick `then`/`els` (in `env`) by its truthiness
  | { readonly k: "branch"; readonly then: Expr; readonly els: Expr; readonly env: Env }
  // evaluating an activity's args left-to-right: `done` are computed, `pending` remain
  | { readonly k: "evalArgs"; readonly fn: string; readonly pending: readonly Expr[]; readonly done: readonly ConstValue[]; readonly env: Env };

/** The persisted, resumable state of a suspended saga: the continuation + the pending activity. */
export interface SagaState {
  /** The continuation (work stack), outermost first; resume restores this. */
  readonly kont: readonly Frame[];
  /** The activity the saga is awaiting — its result feeds back as the `call`'s value. */
  readonly awaiting: { readonly fn: string; readonly args: readonly ConstValue[] };
}

/** The outcome of a step: either the saga finished, or it suspended awaiting an activity. */
export type SagaStep =
  | { readonly kind: "done"; readonly value: ConstValue }
  | { readonly kind: "suspended"; readonly state: SagaState; readonly activity: { readonly fn: string; readonly args: readonly ConstValue[] } };

const ok = <T>(value: T): Result<T, ResumeFeedback> => ({ ok: true, value });
const err = (error: ResumeFeedback): Result<never, ResumeFeedback> => ({ ok: false, error });

// ---- pure operators (the saga's inline semantics) -------------------------

function asInt(v: ConstValue, where: string): number {
  if (v.t !== "int") throw new ResumeFail({ kind: "TypeMismatch", where, expected: "int" });
  return v.v;
}

function asBool(v: ConstValue, where: string): boolean {
  if (v.t !== "bool") throw new ResumeFail({ kind: "TypeMismatch", where, expected: "bool" });
  return v.v;
}

function constEq(a: ConstValue, b: ConstValue): boolean {
  if (a.t !== b.t) return false;
  if (a.t === "null") return true;
  return (a as { v: unknown }).v === (b as { v: unknown }).v;
}

/** Build an `int` ConstValue, declining if the (possibly arithmetic) result left the shared
 * JS-safe-integer wire domain — so an overflowing add/sub/mul can't become a final value or
 * activity arg that `serializeState` emits but `parseState` rejects (the Bonsai safe-int contract). */
function intResult(v: number): ConstValue {
  if (!Number.isSafeInteger(v)) throw new ResumeFail({ kind: "NonSafeInt", value: v });
  return { t: "int", v };
}

/** Apply a binary operator to two evaluated operands (the inline, pure step). */
function applyBinOp(op: BinOp, left: ConstValue, right: ConstValue): ConstValue {
  switch (op) {
    case "add":
      return intResult(asInt(left, "add.left") + asInt(right, "add.right"));
    case "sub":
      return intResult(asInt(left, "sub.left") - asInt(right, "sub.right"));
    case "mul":
      return intResult(asInt(left, "mul.left") * asInt(right, "mul.right"));
    case "eq":
      return { t: "bool", v: constEq(left, right) };
    case "lt":
      return { t: "bool", v: asInt(left, "lt.left") < asInt(right, "lt.right") };
    case "and":
      return { t: "bool", v: asBool(left, "and.left") && asBool(right, "and.right") };
    case "or":
      return { t: "bool", v: asBool(left, "or.left") || asBool(right, "or.right") };
  }
}

/** Internal typed signal — the inline helpers throw this; the machine catches it at the
 * boundary and returns `Error` (the wire contract stays `Result`). */
class ResumeFail extends Error {
  readonly feedback: ResumeFeedback;
  constructor(feedback: ResumeFeedback) {
    super(feedback.kind);
    this.name = "ResumeFail";
    this.feedback = feedback;
  }
}

// ---- the CEK machine ------------------------------------------------------

type Control = { readonly mode: "eval"; readonly expr: Expr; readonly env: Env } | { readonly mode: "ret"; readonly value: ConstValue };

/** Drive the machine from `control` with continuation `kont` until it finishes or suspends. */
function run(control: Control, kont: readonly Frame[]): SagaStep {
  let ctrl = control;
  let stack: readonly Frame[] = kont;

  for (;;) {
    if (ctrl.mode === "eval") {
      const e = ctrl.expr;
      const env = ctrl.env;
      switch (e.kind) {
        case "const":
          ctrl = { mode: "ret", value: e.value };
          break;
        case "param": {
          // own-property check: a name like "toString"/"constructor" must NOT resolve to an
          // inherited Object.prototype member — an unbound param declines Unbound, always
          if (!Object.prototype.hasOwnProperty.call(env, e.name)) throw new ResumeFail({ kind: "Unbound", name: e.name });
          ctrl = { mode: "ret", value: env[e.name]! };
          break;
        }
        case "binary":
          stack = [...stack, { k: "evalRight", op: e.op, right: e.right, env }];
          ctrl = { mode: "eval", expr: e.left, env };
          break;
        case "cond":
          stack = [...stack, { k: "branch", then: e.then, els: e.else, env }];
          ctrl = { mode: "eval", expr: e.test, env };
          break;
        case "call":
          if (e.args.length === 0) {
            return { kind: "suspended", state: { kont: stack, awaiting: { fn: e.fn, args: [] } }, activity: { fn: e.fn, args: [] } };
          }
          stack = [...stack, { k: "evalArgs", fn: e.fn, pending: e.args.slice(1), done: [], env }];
          ctrl = { mode: "eval", expr: e.args[0]!, env };
          break;
        case "lambda":
          throw new ResumeFail({ kind: "UnsupportedNode", nodeKind: "lambda" });
      }
    } else {
      // returning a value to the continuation
      if (stack.length === 0) return { kind: "done", value: ctrl.value };
      const top = stack[stack.length - 1]!;
      const rest = stack.slice(0, -1);
      const value = ctrl.value;
      switch (top.k) {
        case "evalRight":
          stack = [...rest, { k: "applyOp", op: top.op, left: value }];
          ctrl = { mode: "eval", expr: top.right, env: top.env };
          break;
        case "applyOp":
          stack = rest;
          ctrl = { mode: "ret", value: applyBinOp(top.op, top.left, value) };
          break;
        case "branch": {
          const t = asBool(value, "cond.test");
          stack = rest;
          ctrl = { mode: "eval", expr: t ? top.then : top.els, env: top.env };
          break;
        }
        case "evalArgs": {
          const done = [...top.done, value];
          if (top.pending.length === 0) {
            // all args computed → this activity call suspends; `rest` is the continuation
            return { kind: "suspended", state: { kont: rest, awaiting: { fn: top.fn, args: done } }, activity: { fn: top.fn, args: done } };
          }
          stack = [...rest, { k: "evalArgs", fn: top.fn, pending: top.pending.slice(1), done, env: top.env }];
          ctrl = { mode: "eval", expr: top.pending[0]!, env: top.env };
          break;
        }
      }
    }
  }
}

function trap(thunk: () => SagaStep): Result<SagaStep, ResumeFeedback> {
  try {
    return ok(thunk());
  } catch (ex) {
    if (ex instanceof ResumeFail) return err(ex.feedback);
    throw ex;
  }
}

/** Start a saga: evaluate `program` (with optional initial `bindings`) until it finishes or
 * suspends at its first activity. */
export function start(program: Expr, bindings: Env = {}): Result<SagaStep, ResumeFeedback> {
  return trap(() => run({ mode: "eval", expr: program, env: bindings }, []));
}

/** Resume a suspended saga: feed `activityResult` back as the awaited `call`'s value and
 * continue the restored continuation (no replay — prior activities are not re-invoked). */
export function resume(state: SagaState, activityResult: ConstValue): Result<SagaStep, ResumeFeedback> {
  return trap(() => run({ mode: "ret", value: activityResult }, state.kont));
}

// ---- state serialization (persist a suspension; round-trips) --------------

function emitConstValue(c: ConstValue): string {
  switch (c.t) {
    case "int":
      // symmetric with parseState (and Bonsai): never emit an int parseState would reject —
      // so an unsafe int injected via a resume() activity-result declines rather than producing
      // un-parseable durable bytes
      if (!Number.isSafeInteger(c.v)) throw new ResumeFail({ kind: "NonSafeInt", value: c.v });
      return `{"t":"int","v":${c.v}}`;
    case "str":
      return `{"t":"str","v":${JSON.stringify(c.v)}}`;
    case "bool":
      return `{"t":"bool","v":${c.v ? "true" : "false"}}`;
    case "null":
      return `{"t":"null"}`;
  }
}

function emitEnv(env: Env): string {
  // canonical: keys sorted, each value in the `{t,v}` shape
  const keys = Object.keys(env).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${emitConstValue(env[k]!)}`);
  return `{${parts.join(",")}}`;
}

function emitFrame(f: Frame): string {
  switch (f.k) {
    case "evalRight": {
      const r = serialize(f.right);
      if (!r.ok) throw new ResumeFail({ kind: "MalformedState", message: `evalRight.right: ${r.error.kind}` });
      return `{"k":"evalRight","op":${JSON.stringify(f.op)},"right":${r.value},"env":${emitEnv(f.env)}}`;
    }
    case "applyOp":
      return `{"k":"applyOp","op":${JSON.stringify(f.op)},"left":${emitConstValue(f.left)}}`;
    case "branch": {
      const t = serialize(f.then);
      const e = serialize(f.els);
      if (!t.ok) throw new ResumeFail({ kind: "MalformedState", message: `branch.then: ${t.error.kind}` });
      if (!e.ok) throw new ResumeFail({ kind: "MalformedState", message: `branch.els: ${e.error.kind}` });
      return `{"k":"branch","then":${t.value},"els":${e.value},"env":${emitEnv(f.env)}}`;
    }
    case "evalArgs": {
      const pend = f.pending.map((p) => {
        const r = serialize(p);
        if (!r.ok) throw new ResumeFail({ kind: "MalformedState", message: `evalArgs.pending: ${r.error.kind}` });
        return r.value;
      });
      return `{"k":"evalArgs","fn":${JSON.stringify(f.fn)},"pending":[${pend.join(",")}],"done":[${f.done.map(emitConstValue).join(",")}],"env":${emitEnv(f.env)}}`;
    }
  }
}

/** Serialize a suspended `SagaState` to a canonical string for persistence. */
export function serializeState(state: SagaState): Result<string, ResumeFeedback> {
  try {
    const kont = state.kont.map(emitFrame).join(",");
    const args = state.awaiting.args.map(emitConstValue).join(",");
    return ok(`{"v":${RESUME_VERSION},"kont":[${kont}],"awaiting":{"fn":${JSON.stringify(state.awaiting.fn)},"args":[${args}]}}`);
  } catch (ex) {
    if (ex instanceof ResumeFail) return err(ex.feedback);
    throw ex;
  }
}

// ---- state parsing (restore a persisted suspension) -----------------------

function bad(message: string): never {
  throw new ResumeFail({ kind: "MalformedState", message });
}

/** The valid binary operators, for validating ops restored from a persisted state. */
const BIN_OPS: ReadonlySet<string> = new Set<BinOp>(["add", "sub", "mul", "eq", "lt", "and", "or"]);

/** Validate a restored operator against the known `BinOp` tags. A tampered / future-version
 * state carrying an unknown op (e.g. "xor") declines `MalformedState` here, rather than
 * casting through to `applyBinOp` (whose exhaustive switch would otherwise yield `undefined`). */
function readBinOp(v: unknown, where: string): BinOp {
  if (typeof v !== "string" || !BIN_OPS.has(v)) bad(`${where} unknown operator`);
  return v as BinOp;
}

function readConstValue(n: unknown, where: string): ConstValue {
  if (typeof n !== "object" || n === null) bad(`${where} is not an object`);
  const o = n as Record<string, unknown>;
  switch (o.t) {
    case "int":
      // match the Bonsai ConstValue wire contract: JS-safe integers only. A restored /
      // tampered / cross-oracle int outside 2^53-1 (which JSON.parse silently rounds to an
      // integer) declines MalformedState rather than resuming a corrupted numeric value.
      if (typeof o.v !== "number" || !Number.isSafeInteger(o.v)) bad(`${where} int value`);
      return { t: "int", v: o.v as number };
    case "str":
      if (typeof o.v !== "string") bad(`${where} str value`);
      return { t: "str", v: o.v as string };
    case "bool":
      if (typeof o.v !== "boolean") bad(`${where} bool value`);
      return { t: "bool", v: o.v as boolean };
    case "null":
      return { t: "null" };
    default:
      bad(`${where} unknown const tag`);
  }
}

function readEnv(n: unknown, where: string): Env {
  if (typeof n !== "object" || n === null || Array.isArray(n)) bad(`${where} is not an object`);
  const o = n as Record<string, unknown>;
  // null-prototype: assigning a binding named "__proto__" (a legal Bonsai param name) must
  // create an own property, not invoke the legacy prototype setter — so a restored env
  // preserves every binding (and the own-property param lookup then finds it).
  const out: Record<string, ConstValue> = Object.create(null) as Record<string, ConstValue>;
  for (const k of Object.keys(o)) out[k] = readConstValue(o[k], `${where}.${k}`);
  return out;
}

function readExpr(n: unknown, where: string): Expr {
  // a frame's embedded Expr was emitted via bonsai serialize → re-parse via bonsai
  const r = parse(JSON.stringify(n));
  if (!r.ok) bad(`${where} expr: ${r.error.kind}`);
  return r.value;
}

function readFrame(n: unknown): Frame {
  if (typeof n !== "object" || n === null) bad("frame is not an object");
  const o = n as Record<string, unknown>;
  switch (o.k) {
    case "evalRight":
      return { k: "evalRight", op: readBinOp(o.op, "evalRight.op"), right: readExpr(o.right, "evalRight.right"), env: readEnv(o.env, "evalRight.env") };
    case "applyOp":
      return { k: "applyOp", op: readBinOp(o.op, "applyOp.op"), left: readConstValue(o.left, "applyOp.left") };
    case "branch":
      return { k: "branch", then: readExpr(o.then, "branch.then"), els: readExpr(o.els, "branch.els"), env: readEnv(o.env, "branch.env") };
    case "evalArgs": {
      if (!Array.isArray(o.pending)) bad("evalArgs.pending is not an array");
      if (!Array.isArray(o.done)) bad("evalArgs.done is not an array");
      return {
        k: "evalArgs",
        fn: typeof o.fn === "string" ? o.fn : bad("evalArgs.fn"),
        pending: (o.pending as unknown[]).map((p, i) => readExpr(p, `evalArgs.pending[${i}]`)),
        done: (o.done as unknown[]).map((d, i) => readConstValue(d, `evalArgs.done[${i}]`)),
        env: readEnv(o.env, "evalArgs.env"),
      };
    }
    default:
      bad(`unknown frame kind`);
  }
}

/** Parse a persisted state string back to a `SagaState` (the inverse of `serializeState`). */
export function parseState(s: string): Result<SagaState, ResumeFeedback> {
  let doc: unknown;
  try {
    doc = JSON.parse(s);
  } catch (ex) {
    return err({ kind: "MalformedState", message: ex instanceof Error ? ex.message : String(ex) });
  }
  try {
    if (typeof doc !== "object" || doc === null) bad("state is not an object");
    const o = doc as Record<string, unknown>;
    if (o.v !== RESUME_VERSION) bad(`unsupported state version ${String(o.v)}`);
    if (!Array.isArray(o.kont)) bad("kont is not an array");
    const aw = o.awaiting;
    if (typeof aw !== "object" || aw === null) bad("awaiting is not an object");
    const awo = aw as Record<string, unknown>;
    if (typeof awo.fn !== "string") bad("awaiting.fn");
    if (!Array.isArray(awo.args)) bad("awaiting.args is not an array");
    return ok({
      kont: (o.kont as unknown[]).map(readFrame),
      awaiting: { fn: awo.fn, args: (awo.args as unknown[]).map((a, i) => readConstValue(a, `awaiting.args[${i}]`)) },
    });
  } catch (ex) {
    if (ex instanceof ResumeFail) return err(ex.feedback);
    throw ex;
  }
}
