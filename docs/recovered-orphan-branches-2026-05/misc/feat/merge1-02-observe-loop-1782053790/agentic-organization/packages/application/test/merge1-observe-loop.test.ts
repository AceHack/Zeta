import { deepEqual, equal, ok } from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  actionLabel,
  buildMenu,
  chooseNextAction,
  fold,
  observe,
  renderAction,
  replay,
  runLoop,
  simulate,
  worldKey,
  type BacklogItem,
  type MenuChooser,
  type NextAction,
  type World,
} from "../src/observe-simulate.ts";
import {
  applyObservation,
  execute,
  executeDoItem,
  fakeExecutor,
  fakeOperatorPort,
  foldObservations,
  type ActionObservation,
} from "../src/observe-do-item.ts";
import {
  createFolderEventSink,
  createMockEventSink,
  isCanonicalEventId,
  mintObserveEventIdHex,
  type CommitOutcome,
  type EventEnvelope,
  type EventSink,
} from "../src/observe-event-sink.ts";

const item = (id: string, ready: boolean, ambiguous: boolean, needsNewAction = false): BacklogItem => ({
  id,
  title: id,
  ready,
  ambiguous,
  needsNewAction,
});

const READY = item("B-ready", true, false);
const AMBIGUOUS = item("B-amb", false, true);
const NEEDS = item("B-x", false, false, true);

// ─── observe(): the pure controller priority order ────────────────────────────

test("observe: operator ferry outranks everything", () => {
  const world: World = { backlog: [READY], operator: { pendingMessage: true, pendingFerry: true } };
  equal(observe(world).kind, "preserve_ferry");
});

test("observe: operator message outranks offered work", () => {
  const world: World = { backlog: [READY], operator: { pendingMessage: true, pendingFerry: false } };
  equal(observe(world).kind, "respond_to_operator");
});

test("observe: ready work is the offered default", () => {
  equal(observe({ backlog: [READY] }).kind, "do_item");
});

test("observe: only ambiguous → decompose", () => {
  equal(observe({ backlog: [AMBIGUOUS] }).kind, "decompose");
});

test("observe: grammar can't express it → edit_grammar (not trapped)", () => {
  const action = observe({ backlog: [NEEDS] });
  equal(action.kind, "edit_grammar");
});

test("observe: empty backlog → explore (forward, not idle)", () => {
  equal(observe({ backlog: [] }).kind, "explore");
});

test("observe: a persisted free mode outranks offered work but not the operator", () => {
  equal(observe({ backlog: [READY], mode: "play" }).kind, "play");
  equal(observe({ backlog: [READY], mode: "play", operator: { pendingMessage: true, pendingFerry: false } }).kind, "respond_to_operator");
});

// ─── freedom-always-in-menu (MP-5) ────────────────────────────────────────────

test("freedom-always-in-menu: the four free modes are always present", () => {
  const menu = buildMenu({ backlog: [READY, AMBIGUOUS, NEEDS] });
  for (const free of ["explore", "play", "self_reflect", "free_time"]) {
    ok(menu.some((a) => a.kind === free), `menu must contain ${free}`);
  }
});

test("buildMenu: menu[0] === observe(world) (degrade-toward-correct)", () => {
  const world: World = { backlog: [READY], operator: { pendingMessage: true, pendingFerry: false } };
  equal(menuKey(buildMenu(world)[0]!), menuKey(observe(world)));
});

test("buildMenu: no duplicate of the lead action", () => {
  const world: World = { backlog: [READY] };
  const menu = buildMenu(world);
  const leadDoItems = menu.filter((a) => a.kind === "do_item" && a.item.id === READY.id);
  equal(leadDoItems.length, 1);
});

function menuKey(a: NextAction): string {
  return `${a.kind}:${"item" in a ? a.item?.id ?? "" : ""}`;
}

// ─── simulate(): per-kind transitions ─────────────────────────────────────────

test("simulate do_item: item leaves the backlog, mode → work", () => {
  const next = simulate({ backlog: [READY, AMBIGUOUS] }, { kind: "do_item", item: READY });
  deepEqual(next.backlog.map((i) => i.id), [AMBIGUOUS.id]);
  equal(next.mode, "work");
});

test("simulate decompose: ambiguous item → two ready children", () => {
  const next = simulate({ backlog: [AMBIGUOUS] }, { kind: "decompose", item: AMBIGUOUS });
  deepEqual(next.backlog.map((i) => i.id), [`${AMBIGUOUS.id}.1`, `${AMBIGUOUS.id}.2`]);
  ok(next.backlog.every((i) => i.ready && !i.ambiguous));
});

test("simulate edit_grammar: target becomes ready + expressible", () => {
  const next = simulate({ backlog: [NEEDS] }, { kind: "edit_grammar", item: NEEDS, reason: "extended" });
  const t = next.backlog[0]!;
  ok(t.ready && !t.ambiguous && !t.needsNewAction);
});

test("simulate free modes set the persisted mode", () => {
  equal(simulate({ backlog: [] }, { kind: "explore", reason: "" }).mode, "explore");
  equal(simulate({ backlog: [] }, { kind: "free_time", reason: "" }).mode, "free_time");
});

test("simulate operator actions clear only the signal they address", () => {
  const world: World = { backlog: [], operator: { pendingMessage: true, pendingFerry: true } };
  deepEqual(simulate(world, { kind: "preserve_ferry", reason: "" }).operator, { pendingMessage: true, pendingFerry: false });
  deepEqual(simulate(world, { kind: "respond_to_operator", reason: "" }).operator, { pendingMessage: false, pendingFerry: true });
});

// ─── fold / replay: the event-log monoid (MP-1 DST) ───────────────────────────

test("DST: fold(initial, actions) === actions.reduce(simulate)", () => {
  const w0: World = { backlog: [READY, AMBIGUOUS], operator: { pendingMessage: false, pendingFerry: false }, mode: "work" };
  const actions: NextAction[] = [{ kind: "do_item", item: READY }, { kind: "explore", reason: "" }];
  deepEqual(fold(w0, actions), actions.reduce(simulate, w0));
});

test("monoid law: fold(w0, [...a, ...b]) === fold(fold(w0, a), b)", () => {
  const w0: World = { backlog: [READY], operator: { pendingMessage: true, pendingFerry: true } };
  const a: NextAction[] = [{ kind: "preserve_ferry", reason: "" }, { kind: "explore", reason: "" }];
  const b: NextAction[] = [{ kind: "self_reflect", reason: "" }, { kind: "do_item", item: READY }];
  deepEqual(fold(w0, [...a, ...b]), fold(fold(w0, a), b));
});

test("fold identity: fold(w0, []) === w0", () => {
  const w0: World = { backlog: [READY] };
  deepEqual(fold(w0, []), w0);
});

test("replay: last trajectory entry === fold; length === events", () => {
  const w0: World = { backlog: [READY, AMBIGUOUS] };
  const events: NextAction[] = [{ kind: "do_item", item: READY }, { kind: "decompose", item: AMBIGUOUS }];
  const states = replay(w0, events);
  equal(states.length, events.length);
  deepEqual(states.at(-1), fold(w0, events));
});

// ─── cross-language golden vectors (MP-8) ─────────────────────────────────────

test("golden vectors: TS fold/replay reproduce the canonical conformance fixture", () => {
  const fixturePath = fileURLToPath(new URL("fixtures/observe-golden-vectors.json", import.meta.url));
  const vectors = JSON.parse(readFileSync(fixturePath, "utf-8")) as {
    initialWorld: World;
    events: NextAction[];
    expectedFinalState: World;
    expectedReplayStates: World[];
  };
  deepEqual(fold(vectors.initialWorld, vectors.events), vectors.expectedFinalState);
  deepEqual(replay(vectors.initialWorld, vectors.events), vectors.expectedReplayStates);
});

// ─── command-vs-observation split (the replay-cannot-re-run-work invariant) ───

test("foldObservations: a Succeeded observation removes the item (no executor)", () => {
  const observations: ActionObservation[] = [
    { kind: "ActionExecutionStarted", item: READY, tier: "fake", gated: false },
    { kind: "ActionExecutionSucceeded", item: READY },
  ];
  const folded = foldObservations({ backlog: [READY, AMBIGUOUS] }, observations);
  deepEqual(folded.backlog.map((i) => i.id), [AMBIGUOUS.id]);
});

test("foldObservations: a Failed observation leaves the item in place", () => {
  const observations: ActionObservation[] = [
    { kind: "ActionExecutionStarted", item: READY, tier: "fake", gated: false },
    { kind: "ActionExecutionFailed", item: READY, reason: "boom" },
  ];
  const folded = foldObservations({ backlog: [READY] }, observations);
  deepEqual(folded.backlog.map((i) => i.id), [READY.id]);
});

test("applyObservation Succeeded delegates to simulate(do_item)", () => {
  const viaObs = applyObservation({ backlog: [READY] }, { kind: "ActionExecutionSucceeded", item: READY });
  const viaSim = simulate({ backlog: [READY] }, { kind: "do_item", item: READY });
  deepEqual(viaObs, viaSim);
});

// ─── executeDoItem: append Started → run → append terminal ────────────────────

test("executeDoItem success: logs Started+Succeeded, item completes", async () => {
  const sink = createMockObservationSink();
  const result = await executeDoItem({ backlog: [READY] }, READY, sink.sink, fakeExecutor({ ok: true, stdout: "done", exitCode: 0 }), { spec: { script: "x" }, gated: false });
  ok(result.ok && result.completed);
  deepEqual(sink.appended.map((o) => o.kind), ["ActionExecutionStarted", "ActionExecutionSucceeded"]);
  deepEqual(result.world.backlog.map((i) => i.id), []);
});

test("executeDoItem work-failure is ok:true completed:false (item stays)", async () => {
  const sink = createMockObservationSink();
  const result = await executeDoItem({ backlog: [READY] }, READY, sink.sink, fakeExecutor({ ok: false, reason: "tests failed", exitCode: 1, stderr: "" }), { spec: { script: "x" }, gated: false });
  ok(result.ok && !result.completed);
  deepEqual(result.world.backlog.map((i) => i.id), [READY.id]);
});

test("executeDoItem append-first: if Started append fails, executor never runs", async () => {
  let ran = false;
  const executor = { tier: "fake" as const, run: () => { ran = true; return Promise.resolve({ ok: true as const, stdout: "", exitCode: 0 as const }); } };
  const failingSink = { append: () => Promise.resolve({ ok: false as const, reason: "down" }) };
  const result = await executeDoItem({ backlog: [READY] }, READY, failingSink, executor, { spec: { script: "x" }, gated: false });
  ok(!result.ok && result.feedback.kind === "append-failed");
  equal(ran, false);
});

test("executeDoItem terminal-append-failed: executor ran but terminal didn't land", async () => {
  let appends = 0;
  const sink = {
    append: () => {
      appends += 1;
      return Promise.resolve(appends === 1 ? { ok: true as const, eventId: "1" } : { ok: false as const, reason: "down" });
    },
  };
  const result = await executeDoItem({ backlog: [READY] }, READY, sink, fakeExecutor({ ok: true, stdout: "", exitCode: 0 }), { spec: { script: "x" }, gated: false });
  ok(!result.ok && result.feedback.kind === "terminal-append-failed");
});

test("executeDoItem converts an executor throw into a terminal Failed observation", async () => {
  const sink = createMockObservationSink();
  const executor = { tier: "fake" as const, run: () => Promise.reject(new Error("spawn EACCES")) };
  const result = await executeDoItem({ backlog: [READY] }, READY, sink.sink, executor, { spec: { script: "x" }, gated: false });
  ok(result.ok && !result.completed);
  deepEqual(sink.appended.map((o) => o.kind), ["ActionExecutionStarted", "ActionExecutionFailed"]);
});

function createMockObservationSink(): { sink: { append: (o: ActionObservation) => Promise<{ ok: true; eventId: string }> }; appended: ActionObservation[] } {
  const appended: ActionObservation[] = [];
  return {
    appended,
    sink: {
      append: (o: ActionObservation) => {
        appended.push(o);
        return Promise.resolve({ ok: true, eventId: String(appended.length) });
      },
    },
  };
}

// ─── execute(): the effect+append+simulate router ─────────────────────────────

// A plain append-only sink (no G-Set id dedup) — the right shape for the action /
// observation log the `execute` router writes to.
function appendingSink(): EventSink & { readonly appended: NextAction[] } {
  const appended: NextAction[] = [];
  return {
    appended,
    append: (e: NextAction) => {
      appended.push(e);
      return Promise.resolve({ ok: true as const, eventId: String(appended.length) });
    },
  };
}

test("execute zero-effect kind: appends then simulates", async () => {
  const sink = appendingSink();
  const result = await execute({ backlog: [] }, { kind: "explore", reason: "" }, sink);
  ok(result.ok);
  equal(result.world.mode, "explore");
  deepEqual(sink.appended.map((a) => a.kind), ["explore"]);
});

test("execute do_item routes through executeDoItem (observations logged, not the command)", async () => {
  const sink = appendingSink();
  const result = await execute({ backlog: [READY] }, { kind: "do_item", item: READY }, sink, fakeExecutor({ ok: true, stdout: "", exitCode: 0 }), { spec: { script: "x" }, gated: false });
  ok(result.ok);
  equal(result.eventId, "do-item-completed");
  deepEqual(result.world.backlog.map((i) => i.id), []);
  // the COMMAND (do_item) is not logged; the OBSERVATIONS are.
  deepEqual(sink.appended.map((a) => a.kind), ["ActionExecutionStarted", "ActionExecutionSucceeded"]);
});

test("execute do_item without an executor is not-yet-executable", async () => {
  const sink = appendingSink();
  const result = await execute({ backlog: [READY] }, { kind: "do_item", item: READY }, sink);
  ok(!result.ok && result.feedback.kind === "not-yet-executable");
});

test("execute preserve_ferry: effect first via operator port", async () => {
  const sink = appendingSink();
  const operator = fakeOperatorPort();
  const result = await execute({ backlog: [], operator: { pendingMessage: false, pendingFerry: true } }, { kind: "preserve_ferry", reason: "verbatim" }, sink, undefined, undefined, operator);
  ok(result.ok);
  deepEqual(operator.preserved, ["verbatim"]);
});

// ─── event sink: G-Set CRDT idempotency ───────────────────────────────────────

const envelope = (id: string, action: NextAction): EventEnvelope => ({ id, at: "2026-01-01T00:00:00.000Z", by: "otto", action });

test("mock sink: re-appending the same event id is an idempotent no-op (G-Set)", async () => {
  const sink = createMockEventSink();
  const e = envelope("zeta-1", { kind: "explore", reason: "" });
  await sink.append(e);
  await sink.append(e);
  equal(sink.events.length, 1);
});

test("mock sink: same id with different content is a collision (never silently accepted)", async () => {
  const sink = createMockEventSink();
  await sink.append(envelope("zeta-1", { kind: "explore", reason: "a" }));
  const outcome = await sink.append(envelope("zeta-1", { kind: "play", reason: "b" }));
  ok(!outcome.ok);
});

// ─── folder sink: ZetaId-keyed JSON, injected commit, MP-7 Result discipline ──

test("folder sink: writes a canonical id-named file and commits", async () => {
  const dir = mkTempDir();
  let committed: EventEnvelope | undefined;
  const sink = createFolderEventSink({
    eventDir: dir,
    by: "otto",
    mint: () => "a".repeat(32),
    now: () => 0,
    commit: (_p, env): CommitOutcome => { committed = env; return { ok: true }; },
  });
  const outcome = await sink.append({ kind: "explore", reason: "x" });
  ok(outcome.ok && outcome.eventId === "a".repeat(32));
  equal(committed?.action.kind, "explore");
});

test("folder sink: re-appending the same id with same content is idempotent ok", async () => {
  const dir = mkTempDir();
  const opts = { eventDir: dir, by: "otto", mint: () => "b".repeat(32), now: () => 0, commit: (): CommitOutcome => ({ ok: true }) };
  const sink = createFolderEventSink(opts);
  ok((await sink.append({ kind: "explore", reason: "x" })).ok);
  ok((await sink.append({ kind: "explore", reason: "x" })).ok);
});

test("folder sink: a non-canonical minted id is rejected (path-segment guard)", async () => {
  const dir = mkTempDir();
  const sink = createFolderEventSink({ eventDir: dir, by: "otto", mint: () => "../escape", commit: (): CommitOutcome => ({ ok: true }) });
  const outcome = await sink.append({ kind: "explore", reason: "x" });
  ok(!outcome.ok);
});

test("folder sink: a commit failure surfaces as ok:false (never throws)", async () => {
  const dir = mkTempDir();
  const sink = createFolderEventSink({ eventDir: dir, by: "otto", mint: () => "c".repeat(32), commit: (): CommitOutcome => ({ ok: false, reason: "push rejected" }) });
  const outcome = await sink.append({ kind: "explore", reason: "x" });
  ok(!outcome.ok && outcome.reason === "push rejected");
});

test("mintObserveEventIdHex produces canonical 32-hex ids", () => {
  ok(isCanonicalEventId(mintObserveEventIdHex()));
});

function mkTempDir(): string {
  // mkdtempSync atomically creates a unique, securely-permissioned dir — the
  // safe-temp pattern (no predictable name / TOCTOU window).
  return mkdtempSync(join(tmpdir(), "observe-sink-"));
}

// ─── runLoop + chooseNextAction: the closed loop degrades to the oracle ────────

test("chooseNextAction: an out-of-range index falls back to the oracle", async () => {
  const chooser: MenuChooser = { choose: () => Promise.resolve({ index: 999, fallback: false }) };
  const action = await chooseNextAction({ backlog: [READY] }, chooser);
  equal(action.kind, observe({ backlog: [READY] }).kind);
});

test("chooseNextAction: explicit fallback returns the oracle pick (model can't widen the menu)", async () => {
  const chooser: MenuChooser = { choose: () => Promise.resolve({ index: 0, fallback: true }) };
  const action = await chooseNextAction({ backlog: [], operator: { pendingMessage: true, pendingFerry: false } }, chooser);
  equal(action.kind, "respond_to_operator");
});

test("runLoop: a top-pick chooser drains a mixed backlog to steady state", async () => {
  const topPick: MenuChooser = { choose: () => Promise.resolve({ index: 0, fallback: false }) };
  const start: World = {
    operator: { pendingMessage: true, pendingFerry: true },
    backlog: [READY, AMBIGUOUS, NEEDS],
  };
  const loop = await runLoop(start, topPick, 30);
  ok(loop.steadyState);
  equal(loop.finalWorld.backlog.length, 0);
});

// ─── render/label helpers are total over the DU ───────────────────────────────

test("renderAction and actionLabel cover every NextAction kind", () => {
  const kinds: NextAction[] = [
    { kind: "preserve_ferry", reason: "r" },
    { kind: "respond_to_operator", reason: "r" },
    { kind: "do_item", item: READY },
    { kind: "decompose", item: AMBIGUOUS },
    { kind: "explore", reason: "r" },
    { kind: "play", reason: "r" },
    { kind: "self_reflect", reason: "r" },
    { kind: "free_time", reason: "r" },
    { kind: "edit_grammar", reason: "r" },
  ];
  for (const a of kinds) {
    ok(renderAction(a).length > 0);
    ok(actionLabel(a).length > 0);
  }
});

test("worldKey is stable for equal worlds and distinct for different modes", () => {
  const w: World = { backlog: [READY], operator: { pendingMessage: false, pendingFerry: false }, mode: "work" };
  equal(worldKey(w), worldKey({ ...w }));
  ok(worldKey(w) !== worldKey({ ...w, mode: "explore" }));
});
