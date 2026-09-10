/**
 * serve-org.ts — the same view as `observe-org`, over HTTP, for a browser.
 *
 *   bun serve-org.ts --store <dir> [--port 4319]
 *
 * ── ONE FOLD, TWO RENDERERS ─────────────────────────────────────────────────
 * `/api/view` returns `viewOf(...)` — the *identical* function the terminal view calls. The page
 * holds no state and computes nothing: every number on screen came off one fold of the event log.
 * Two renderers over one fold cannot disagree; two renderers over two queries eventually do, and
 * then nobody can say which one is lying.
 *
 * ── READ ONLY, BY CONSTRUCTION ──────────────────────────────────────────────
 * There is no POST, no PUT, no DELETE, and no path that writes. A dashboard that can change what it
 * observes is not a dashboard. This also means it is safe to point at a live run: the worst it can
 * do is read a half-written log, which the fold handles because it is order-independent.
 *
 * Bound to LOOPBACK unless `--host` says otherwise: an organization's internal state is not
 * something to put on a network by default.
 */

import { stringCompare } from "../collation/collation.ts";
import { roomJson, workRoutes } from "./serve-work";
import { loadRooms } from "./room-store";
import { directoryMemoryStore } from "./memory-store";
import { MemoryPhase, weightOf } from "./memory";
import { foldOrganization } from "./org-fold";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  activityViews,
  agentViews,
  changeViews,
  documentViews,
  portalSummary,
  spendForWork,
  answeredNotApplied,
} from "./portal-view";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

import { readEvents, readRuns } from "./org-store";
import { renderHat, viewOf, type OrgView } from "./observe-org";
import { appendAction, queueProblems, readActions } from "./action-queue";
import { acceptAction } from "./human-action";
import type { AgentRoster } from "./agent-roster";
import { outboxProblems, readBlockers } from "./blocker-outbox";
import { advance, formatCursor, parseCursor, seedPosition, sseFrame, type StreamPosition } from "./event-stream";
import type { OrgEvent } from "./org-event";
import type { HumanCheckpoint } from "./quality-gate";

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

/**
 * The reading, taken at the LOG'S own latest instant.
 *
 * Not `Date.now()`: a wall-clock reading of a finished log ages every booked block past its end and
 * reports work as missed that was never late — the answer would change with when you opened the
 * page. Local time steers local questions only.
 */
export function currentView(
  store: string,
  queueDir?: string,
  rosterPath?: string,
  checkpoints: readonly HumanCheckpoint[] = [],
  outboxDir?: string,
  requestUrls: Readonly<Record<string, string>> = {},
): OrgView {
  const events = readEvents(store);
  const atMs = events.length === 0 ? Date.now() : Math.max(...events.map((e) => e.atMs));
  return viewOf(events, readRuns(store).length, atMs, {
    ...(rosterPath === undefined ? {} : { roster: loadRoster(rosterPath) }),
    ...(queueDir === undefined ? {} : { actions: readActions(queueDir), actionProblems: queueProblems(queueDir) }),
    checkpoints,
    requestUrls,
    ...(outboxDir === undefined
      ? {}
      : { raisedBlockers: readBlockers(outboxDir), blockerProblems: outboxProblems(outboxDir) }),
  });
}

/**
 * Everything the delivery portal shows, from ONE fold of the log.
 *
 * Assembled here rather than in the page because the joins are facts about the organization, not
 * about a layout: which gate is holding which document, what a hat is doing, what a request cost.
 * A client that joined these itself would be re-deriving the organization in JavaScript, and the
 * two derivations would disagree the first time either changed.
 *
 * `spend` is carried WITH its denominators — see `meter.ts`. A page may render `costUsd` only when
 * it is present, and must say what `priced`/`calls` leave out. That contract is the reason a
 * dollar figure on this portal means something.
 */
export function portalPayload(
  store: string,
  queueDir?: string,
  rosterPath?: string,
  checkpoints: readonly HumanCheckpoint[] = [],
  outboxDir?: string,
  requestUrls: Readonly<Record<string, string>> = {},
  operator?: string,
  memoryDir?: string,
): unknown {
  const events = readEvents(store);
  const view = currentView(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls);
  const folded = foldOrganization(events);
  const chartResult = buildOrgChart(SEED_HATS);
  if (!chartResult.ok) return { ok: false, reason: chartResult.reason };
  const chart = chartResult.chart;

  // What is actually held for a person, as (work, gate) pairs — the join every "needs you" flag
  // on this payload is derived from. One source, so the counts on the tiles, the badge on a
  // document and the state of an agent can never disagree with each other.
  const held = view.work
    .filter((w) => w.awaitingHumanAt !== undefined)
    .map((w) => ({ workId: w.workId, gate: String(w.awaitingHumanAt) }));

  const requests = view.requests.map((request) => {
    const ids = [...request.workIds];
    return {
      ...request,
      documents: documentViews(chart, folded, ids, held),
      changes: changeViews(folded, ids),
      spend: spendForWork(folded, ids),
      held: held.filter((h) => ids.includes(h.workId)),
    };
  });

  // ── THE LOG'S OWN CLOCK, NOT THE READER'S ─────────────────────────────────
  // A browser computing "4m ago" as `Date.now() - atMs` is reading a wall clock against times the
  // organization agreed on — the mixing `local-time-never-enters-the-shared-fold` forbids. On a
  // fixture run whose events start at 0 it rendered "20705d ago", which is how the defect was
  // noticed; on a real run it would have been quietly wrong instead of absurdly wrong.
  //
  // So the payload carries the latest time the LOG holds, and every relative time on the page is
  // measured against that. The page then says how long before the end of the run something
  // happened, which is true whoever is reading it and whenever.
  const atMs = events.length === 0 ? 0 : Math.max(...events.map((e) => e.atMs));

  // ── WHO WOULD BE SIGNING ──────────────────────────────────────────────────
  // `byHuman` is required on every action and exists so a decision can be traced to somebody who
  // can be asked about it afterwards. A page that invented "the operator" would satisfy the field
  // and defeat its purpose, so an unconfigured server reports NO operator and the UI refuses to
  // submit rather than signing on behalf of nobody.
  const queued = queueDir === undefined ? [] : readActions(queueDir);

  return {
    atMs,
    operator,
    /** Answers already queued that the organisation has not run since. */
    answered: answeredNotApplied(queued, folded.gateEvaluations),
    /** Whether this server can accept an answer at all — it needs `--actions`. */
    canAnswer: queueDir !== undefined,
    summary: portalSummary(folded, held, view.refusedRequests.length),
    requests,
    refused: view.refusedRequests,
    work: view.work,
    agents: agentViews(chart, folded, held),
    activity: activityViews(chart, events, 60),
    approvals: view.approvals,
    blockers: view.awaitingPeople,
    checkpoints,
    requestUrls,
    /** Which sources this install has seen. Derived, so a new adapter needs no change here. */
    sources: [...new Set(view.requests.map((r) => r.source))],
    // ── WHERE EVERYBODY IS ─────────────────────────────────────────────────
    // From the log's most recent census. Absent when no life tick has run — which is a real state
    // and is shown as one, rather than as an organisation in which everybody happens to be asleep.
    presence: folded.presence,
    // ── WHO IS MEETING, AND WHY ────────────────────────────────────────────
    // Newest first, because a meeting is a response to a condition and the recent ones are the
    // conditions that still hold. A meeting with no `reason` was booked as part of walking an item
    // rather than in answer to anything, and the page is left to say so rather than being handed a
    // filler cause that would make every meeting look caused.
    meetings: [...folded.meetings]
      .sort((a, b) => b.startMs - a.startMs)
      .slice(0, 40),
    // ── WHAT IS ON EVERYONE'S CALENDAR ─────────────────────────────────────
    // Including FREE TIME, which is the half that makes this worth showing: an organisation whose
    // calendar contains only work is one that never does anything else, and a page that showed
    // only work blocks would report exactly that whatever the agents were doing.
    calendar: [...folded.calendar.blocks]
      .sort((a, b) => (a.startMs === b.startMs ? stringCompare(a.hatId, b.hatId) : a.startMs - b.startMs))
      .slice(-400)
      .map((b) => ({
        blockId: b.blockId,
        hatId: b.hatId,
        blockType: b.blockType,
        startMs: b.startMs,
        endMs: b.endMs,
        state: b.state,
        ...(b.workItemId === undefined ? {} : { subject: b.workItemId }),
        ...(b.meetingId === undefined ? {} : { meetingId: b.meetingId }),
      })),
    // ── WHAT THE ORGANIZATION KNOWS ────────────────────────────────────────
    // Read from the STORE, not the fold: the store is what an agent will actually be handed, and a
    // page that showed the log's version would show what was learned rather than what is known.
    // The two differ exactly when something has been forgotten, which is the interesting case.
    memory: memoryDir === undefined ? undefined : memoryView(memoryDir, atMs),
  };
}

/**
 * What the organization currently knows, and what it has forgotten.
 *
 * Weight is computed at READ TIME rather than stored, so the page shows what would actually surface
 * to an agent right now — a cached weight would be the value at the last maintenance pass, and the
 * gap between those two is exactly what a reader is trying to see.
 */
export function memoryView(memoryDir: string, nowMs: number): unknown {
  const store = directoryMemoryStore(memoryDir);
  const all = store.load();
  const live = all.filter((m) => m.state.phase !== MemoryPhase.Archived);
  const rows = live
    .map((m) => ({
      memoryId: m.content.memoryId,
      tier: m.content.tier,
      scope: m.content.scope,
      key: m.content.key,
      value: m.content.value,
      writtenBy: m.content.writtenBy,
      protectedMemory: m.content.protected,
      phase: m.state.phase,
      confidence: m.state.confidence,
      reinforcementCount: m.state.reinforcementCount,
      injected: m.state.utility.injectedCount,
      cited: m.state.utility.citedCount,
      weight: weightOf(m, { nowMs }),
      atMs: m.content.writtenAtMs,
    }))
    .sort((a, b) => b.weight - a.weight);
  return {
    root: memoryDir,
    live: rows.length,
    forgotten: all.length - live.length,
    // NOT a subset the page can ignore. A stale memory is still in the store and still counted in
    // `live`, but recall does not surface it by default — so a summary that said only "191 live"
    // would report a memory the organisation cannot actually reach as one it can.
    stale: live.filter((m) => m.state.phase === MemoryPhase.Stale).length,
    byTier: Object.fromEntries(
      ["org", "department", "hat", "agent", "work"].map((t) => [t, rows.filter((r) => r.tier === t).length]),
    ),
    rows: rows.slice(0, 200),
  };
}

/**
 * Read a document the organization produced, IF it is under a declared root.
 *
 * ── WHY AN ALLOWLIST AND NOT A PATH CHECK ────────────────────────────────────
 * The refs in the log come from producers, and a producer is a command somebody configured — so a
 * ref is only as trustworthy as whoever wired the run. A dashboard that resolved an arbitrary ref
 * would be a file-read endpoint on localhost with the path supplied by the thing being observed.
 * So: nothing is readable unless an operator named a root with `--docs`, and a resolved path that
 * escapes every root is refused rather than clipped into one.
 *
 * `resolve` first, THEN compare — comparing the raw string would pass `docs/../../etc/passwd`, which
 * starts with the root and does not stay in it.
 */
export function readArtifact(ref: string, roots: readonly string[]): { ok: true; text: string } | { ok: false; reason: string } {
  if (roots.length === 0) {
    return { ok: false, reason: "no --docs root was declared, so this server reads no files" };
  }
  const full = resolve(ref);
  const inside = roots.some((root) => {
    const at = resolve(root);
    return full === at || full.startsWith(at + sep);
  });
  if (!inside) return { ok: false, reason: `'${ref}' is not under any --docs root` };
  try {
    const text = readFileSync(full, "utf-8");
    // A whole repository could be cited. The page wants a document, not a database dump.
    return { ok: true, text: text.length > 200_000 ? `${text.slice(0, 200_000)}\n…[truncated]` : text };
  } catch (err) {
    // CLASSIFY, NEVER ECHO. `js/stack-trace-exposure`: this `reason` is
    // JSON-serialised straight into an HTTP response, and a raw `err.message`
    // from `readFileSync` carries the absolute path it tried — which tells a
    // caller the server's filesystem layout, including roots it was refused.
    //
    // The classification below is the answer the CALLER actually needs (does
    // this exist, may I read it, or is it not a file), and it is stable across
    // platforms in a way an OS error string is not. The underlying error is not
    // swallowed — it is simply not the thing sent to a stranger.
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    const reason =
      code === "ENOENT" ? "no such artifact"
      : code === "EACCES" || code === "EPERM" ? "not readable"
      : code === "EISDIR" ? "that ref is a directory, not an artifact"
      : "could not be read";
    return { ok: false, reason };
  }
}

/** The declared roster, or an empty one. A missing file is "nobody provisioned", not a crash. */
export function loadRoster(path: string): AgentRoster {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    const agents = (parsed as { agents?: unknown }).agents;
    return Array.isArray(agents) ? ({ agents } as AgentRoster) : { agents: [] };
  } catch {
    return { agents: [] };
  }
}

/**
 * THE PAGE.
 *
 * One string, no build step, no dependency — the same reason the queue is a directory. A
 * dashboard that needs a toolchain to render is one that stops rendering the day the toolchain
 * moves, and the thing it reports on is a long-running process nobody wants to restart.
 *
 * It is deliberately NOT a report on the register. The first version was: event counts, fold
 * statistics, port fidelity, and hat ids straight out of the chart. Every one of those is the
 * right thing to look at when you are debugging the machinery and the wrong thing when you are
 * running the company, and a person who opens this is doing the second. So the order here is the
 * order somebody actually asks in: does anything need me, who is doing what, where is the work,
 * what has been decided.
 *
 * NO TEMPLATE LITERALS AND NO BACKTICKS INSIDE. The whole page is one, so either would end it
 * early and silently — the server would still start and serve a truncated document. Asserted at
 * build time by the test that parses this script.
 */
const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Organization</title>
<style>
  /* ── PALETTE ───────────────────────────────────────────────────────────────
     A console somebody runs a company from, so: one calm ground, one decisive
     accent, and colour reserved for STATE. Every hue below means something —
     nothing here is decoration, because on a page whose job is "what needs me",
     a colour that means nothing is a colour competing with the ones that do. */
  :root{
    --paper:#f6f8f7; --card:#ffffff; --ink:#16211f; --muted:#5f6b68; --hair:#dde3e1;
    --accent:#0f6e63; --accent-soft:#e2f0ed;
    --ok:#2f7d4f; --ok-soft:#e4f1e8;
    --warn:#8f6205; --warn-soft:#faf0da;
    --bad:#a8322a; --bad-soft:#fbe8e6;
    --human:#5f4a9b; --human-soft:#eeeaf7;
    --shadow:0 1px 2px rgba(16,33,31,.05), 0 4px 14px rgba(16,33,31,.045);
  }
  @media (prefers-color-scheme: dark){
    :root{
      --paper:#0e1413; --card:#161e1c; --ink:#e7edeb; --muted:#8c9995; --hair:#26312e;
      --accent:#48c3ac; --accent-soft:#14322d;
      --ok:#56ac78; --ok-soft:#152a1e;
      --warn:#c99b3c; --warn-soft:#2e2513;
      --bad:#dd7a70; --bad-soft:#331b19;
      --human:#a893e0; --human-soft:#221c33;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 4px 14px rgba(0,0,0,.3);
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em}
  .wrap{max-width:1180px;margin:0 auto;padding:0 22px 90px}
  h2{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
     font-weight:650;margin:38px 0 12px}
  h2 .n{color:var(--ink);font-weight:700}
  .sub{color:var(--muted);font-size:13.5px;margin:-6px 0 14px}

  /* ── MASTHEAD ────────────────────────────────────────────────────────────── */
  header{position:sticky;top:0;z-index:20;background:var(--paper);
    border-bottom:1px solid var(--hair);padding:16px 0 12px;margin-bottom:4px}
  .masthead{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
  h1{font-size:21px;margin:0;letter-spacing:-.015em;font-weight:680}
  .pulse{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);
    margin-left:auto}
  .dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}
  .state{display:flex;gap:22px;flex-wrap:wrap;margin-top:9px;font-size:13.5px;color:var(--muted)}
  .state b{color:var(--ink);font-weight:660;font-variant-numeric:tabular-nums}
  .state .flag{color:var(--bad);font-weight:660}
  .nav{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
  .nav a{font-size:12.5px;color:var(--muted);text-decoration:none;padding:4px 10px;
    border:1px solid var(--hair);border-radius:99px;background:var(--card)}
  .nav a:hover{color:var(--accent);border-color:var(--accent)}
  .pausebtn{font:inherit;font-size:12.5px;padding:4px 12px;border-radius:99px;cursor:pointer;
    border:1px solid var(--hair);background:var(--card);color:var(--ink)}
  .pausebtn:hover{border-color:var(--accent);color:var(--accent)}

  /* ── THE READER'S OWN QUEUE ──────────────────────────────────────────────── */
  .askwrap{margin-top:24px}
  .ask{background:var(--card);border:1px solid var(--hair);border-left:4px solid var(--warn);
    border-radius:9px;padding:18px 20px;margin-bottom:12px;box-shadow:var(--shadow)}
  .ask.blocker{border-left-color:var(--bad)}
  .ask .who{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--warn);
    font-weight:650;margin-bottom:8px}
  .ask.blocker .who{color:var(--bad)}
  .ask .q{font-size:18px;line-height:1.35;font-weight:600;letter-spacing:-.01em;margin-bottom:6px}
  .ask .ctx{color:var(--muted);font-size:13.5px;margin-bottom:14px}
  .ask .ctx b{color:var(--ink);font-weight:600}
  .actions{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
  .actions input{flex:1;min-width:230px;background:var(--paper);color:var(--ink);
    border:1px solid var(--hair);border-radius:7px;padding:9px 12px;font:inherit;font-size:13.5px}
  .actions input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:transparent}
  button.go{font:inherit;font-size:13.5px;font-weight:620;padding:9px 18px;border:0;
    border-radius:7px;cursor:pointer;background:var(--accent);color:#fff}
  button.no{background:transparent;color:var(--bad);border:1px solid var(--bad)}
  button.go:disabled{opacity:.45;cursor:default}
  button.go:hover:not(:disabled){filter:brightness(1.08)}
  .note{font-size:12.5px;margin-top:9px;min-height:16px}
  .note.bad{color:var(--bad)} .note.ok{color:var(--ok)}

  /* ── DEPARTMENTS ─────────────────────────────────────────────────────────── */
  .depts{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:11px}
  .dept{background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:14px 16px;
    cursor:pointer}
  .dept.idle{background:transparent;border-style:dashed}
  .dept:hover{border-color:var(--accent)}
  .dept .nm{font-weight:640;font-size:14.5px;letter-spacing:-.005em;margin-bottom:2px}
  .dept .hd{color:var(--muted);font-size:12.5px;margin-bottom:10px}
  .dept .row{display:flex;gap:16px;font-size:12.5px;color:var(--muted);
    font-variant-numeric:tabular-nums}
  .dept .row b{color:var(--ink);font-weight:660}
  .dept.idle .row b{color:var(--muted)}
  .people{margin-top:12px;border-top:1px solid var(--hair);padding-top:10px}
  .person{display:flex;align-items:baseline;gap:8px;font-size:13px;padding:3px 0}
  .person .pn{font-weight:580}
  .person .lv{color:var(--muted);font-size:11.5px}
  .person .rt{margin-left:auto;color:var(--muted);font-size:12px;
    font-variant-numeric:tabular-nums}
  .person .busy{color:var(--accent)}

  /* ── WORK ────────────────────────────────────────────────────────────────── */
  .item{background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:16px 18px;
    margin-bottom:11px;box-shadow:var(--shadow)}
  .item .top{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:5px}
  .item .ttl{font-size:16px;font-weight:620;letter-spacing:-.01em;flex:1;min-width:210px}
  .chip{font-size:11px;letter-spacing:.05em;text-transform:uppercase;font-weight:650;
    padding:3px 9px;border-radius:99px;background:var(--accent-soft);color:var(--accent)}
  .chip.done{background:var(--ok-soft);color:var(--ok)}
  .chip.wait{background:var(--warn-soft);color:var(--warn)}
  .chip.quiet{background:transparent;color:var(--muted);border:1px solid var(--hair)}
  .item .meta{color:var(--muted);font-size:13px;margin-bottom:13px}
  .item .meta b{color:var(--ink);font-weight:600}

  /* the stage rail — the answer to "what was approved" */
  .rail{display:flex;gap:3px;margin-bottom:9px}
  .seg{flex:1;height:8px;border-radius:2px;background:var(--hair);position:relative}
  .seg.passed{background:var(--ok)}
  .seg.human{background:var(--human)}
  .seg.rejected{background:var(--bad)}
  .seg.waiting{background:var(--warn)}
  .seg.next{background:var(--accent);opacity:.45}
  .railfoot{display:flex;justify-content:space-between;align-items:center;gap:12px;
    font-size:12.5px;color:var(--muted)}
  .railfoot b{color:var(--ink);font-weight:640;font-variant-numeric:tabular-nums}
  .toggle{background:none;border:0;color:var(--accent);font:inherit;font-size:12.5px;
    cursor:pointer;padding:0;text-decoration:underline;text-underline-offset:3px}
  .stages{margin-top:12px;border-top:1px solid var(--hair)}
  .stage{display:flex;align-items:baseline;gap:10px;padding:7px 0;
    border-bottom:1px solid var(--hair);font-size:13px}
  .stage:last-child{border-bottom:0}
  .pip{width:8px;height:8px;border-radius:50%;background:var(--hair);flex:none;
    transform:translateY(-1px)}
  .pip.passed{background:var(--ok)} .pip.human{background:var(--human)}
  .pip.rejected{background:var(--bad)} .pip.waiting{background:var(--warn)}
  .pip.next{background:var(--accent)}
  .stage .sn{font-weight:570;min-width:186px}
  .stage .sby{color:var(--muted)}
  .stage .sr{color:var(--muted);margin-left:auto;text-align:right;font-size:12px;
    max-width:44%;overflow-wrap:anywhere}
  .tag{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:680;
    padding:2px 7px;border-radius:99px;background:var(--human-soft);color:var(--human)}

  /* ── ROOMS / DECISIONS / LISTS ───────────────────────────────────────────── */
  .rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
  .room{background:var(--card);border:1px solid var(--hair);border-radius:9px;padding:13px 15px}
  .room.closed{opacity:.6}
  .room .rt2{font-weight:610;font-size:14px;margin-bottom:3px}
  .room .rp{color:var(--muted);font-size:12.5px;margin-bottom:8px}
  .room .rw{font-size:12.5px;color:var(--muted)}
  .room .rw b{color:var(--ink);font-weight:580}
  .turn{border-left:2px solid var(--hair);padding:4px 0 4px 9px;margin-top:7px;font-size:12.5px}
  .turn b{font-weight:600}
  .turn.human{border-left-color:var(--human);background:var(--human-soft)}
  .room.open{cursor:pointer}
  .room.open:hover{border-color:var(--accent)}
  .silent{font-size:12.5px;color:var(--warn);background:var(--warn-soft);border-radius:6px;
    padding:8px 11px;margin-top:9px;line-height:1.45}
  .silent.loud{color:var(--bad);background:var(--bad-soft);font-weight:560}
  .detail{margin-top:11px;border-top:1px solid var(--hair);padding-top:11px;font-size:13px}
  .dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-bottom:10px}
  .dl dt{color:var(--muted);font-size:12px}
  .dl dd{margin:0}
  .evd{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--muted);
    background:var(--paper);border:1px solid var(--hair);border-radius:4px;padding:2px 7px;
    display:inline-block;margin:2px 4px 2px 0}
  .made{background:var(--paper);border:1px solid var(--hair);border-radius:7px;padding:11px 13px;
    margin:10px 0;font-size:13px}
  .made .mt{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
    font-weight:640;margin-bottom:5px}
  .nothing{background:var(--bad-soft);border:1px solid var(--bad);border-radius:7px;
    padding:12px 14px;margin:10px 0;font-size:13.5px;color:var(--bad);line-height:1.5}
  .nothing b{font-weight:680}
  .orgline{margin-top:8px;font-size:12.5px;color:var(--muted)}
  .orgline b{color:var(--ink);font-weight:620}
  .fold{margin-top:44px;border-top:1px solid var(--hair);padding-top:8px}
  .fold summary{cursor:pointer;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;
    color:var(--muted);font-weight:640;padding:6px 0;list-style:none}
  .fold summary::-webkit-details-marker{display:none}
  .fold summary::before{content:"▸  ";color:var(--muted)}
  .fold[open] summary::before{content:"▾  "}
  .fold summary:hover{color:var(--accent)}
  .foldbody{padding-bottom:20px}

  /* the developer's own view of a change */
  .where{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 4px;font-size:12.5px}
  .where a{color:var(--accent);font-weight:600;text-decoration:none}
  .where a:hover{text-decoration:underline}
  .tabs{display:flex;gap:4px;margin:13px 0 0;border-bottom:1px solid var(--hair)}
  .tabs button{background:none;border:0;border-bottom:2px solid transparent;color:var(--muted);
    font:inherit;font-size:12.5px;font-weight:600;padding:7px 11px;cursor:pointer;margin-bottom:-1px}
  .tabs button.on{color:var(--ink);border-bottom-color:var(--accent)}
  .tabs button:hover{color:var(--ink)}
  .pane{padding-top:12px;font-size:13px}
  .doc{background:var(--paper);border:1px solid var(--hair);border-radius:7px;margin-bottom:9px}
  .doc .dh{display:flex;gap:9px;align-items:center;padding:9px 12px;cursor:pointer;
    border-bottom:1px solid transparent}
  .doc.on .dh{border-bottom-color:var(--hair)}
  .doc .dh:hover{color:var(--accent)}
  .doc .dg{font-weight:620;flex:1}
  .doc .dp{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--muted);
    overflow-wrap:anywhere}
  .doc pre{margin:0;padding:12px 14px;white-space:pre-wrap;overflow-wrap:anywhere;
    font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.55;max-height:460px;
    overflow-y:auto;color:var(--ink)}
  .tl2{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--hair);align-items:baseline}
  .tl2:last-child{border-bottom:0}
  .tl2 .g{font-weight:600;min-width:170px}
  .tl2 .d{color:var(--muted);font-variant-numeric:tabular-nums;font-size:12px}
  .tl2 .o{flex:1;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--muted);
    overflow-wrap:anywhere}
  .verd{border-left:3px solid var(--hair);padding:4px 0 8px 11px;margin-bottom:10px}
  .verd.ok{border-left-color:var(--ok)} .verd.no{border-left-color:var(--bad)}
  .verd .vh{font-weight:600;margin-bottom:2px}
  .verd .vw{color:var(--muted);font-size:12.5px;margin-bottom:5px}
  .verd .vr{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px}
  .trow{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--hair);align-items:baseline;
    font-size:12.5px}
  .trow:last-child{border-bottom:0}
  .trow .tc{font-family:ui-monospace,Menlo,monospace;min-width:96px}
  .trow .to{font-weight:640;min-width:66px}
  .trow .to.passed{color:var(--ok)} .trow .to.failed,.trow .to.errored{color:var(--bad)}
  .trow .td{color:var(--muted);font-variant-numeric:tabular-nums}
  .step{border-bottom:1px solid var(--hair);padding:11px 0}
  .step:last-child{border-bottom:0}
  .sh{display:flex;align-items:baseline;gap:9px;margin-bottom:6px}
  .sh .d{margin-left:auto;color:var(--muted);font-size:11.5px;font-variant-numeric:tabular-nums}
  .plan{margin-left:17px}
  .pl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);
    font-weight:640;margin-bottom:3px}
  .pi{font-size:12.5px;padding:1px 0 1px 15px;position:relative;color:var(--muted)}
  .pi::before{content:"•";position:absolute;left:2px;color:var(--hair)}
  .pi.on{color:var(--ink)}
  .pi.on::before{content:"✓";color:var(--ok);font-weight:700}
  .made2{margin:6px 0 0 17px;font-size:12.5px;color:var(--muted)}
  .stamp{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:680;
    padding:2px 7px;border-radius:99px;background:var(--warn-soft);color:var(--warn)}

  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted);font-weight:640;padding:0 10px 7px 0;border-bottom:1px solid var(--hair)}
  td{padding:8px 10px 8px 0;border-bottom:1px solid var(--hair);vertical-align:top}
  tr:last-child td{border-bottom:0}
  .scroll{overflow-x:auto}
  .empty{color:var(--muted);font-size:13.5px;background:var(--card);border:1px dashed var(--hair);
    border-radius:9px;padding:16px 18px;margin:0}
  .warnline{color:var(--bad);font-size:13px;background:var(--bad-soft);border-radius:7px;
    padding:9px 13px;margin-bottom:7px}
  .ok-t{color:var(--ok)} .bad-t{color:var(--bad)} .muted-t{color:var(--muted)}
</style></head><body>
<div class="wrap">
  <header>
    <div class="masthead">
      <h1>The Organization</h1>
      <button class="pausebtn" id="pause">Pause</button>
      <span class="pulse"><span class="dot" id="dot"></span><span id="pulsetext">connecting</span></span>
    </div>
    <div class="state" id="state"></div>
    <div class="orgline" id="orgline"></div>
  </header>

  <div class="askwrap" id="needs"></div>

  <h2 id="work">Work <span class="n" id="workn"></span></h2>
  <div id="items"></div>

  <details class="fold" id="orgfold">
    <summary>The organization &mdash; departments, rooms, decisions, staffing</summary>
    <div class="foldbody">
      <h2 id="floor">The floor <span class="n" id="floorn"></span></h2>
      <div class="depts" id="depts"></div>

      <h2 id="rooms">Rooms <span class="n" id="roomn"></span></h2>
      <p class="sub">Click a room to read it: what was asked, what was attached, what was said, and what it decided.</p>
      <div class="rooms" id="roomlist"></div>

      <h2 id="decisions">Decisions <span class="n" id="decn"></span></h2>
      <div class="scroll" id="approvals"></div>

      <h2 id="staffing">Staffing</h2>
      <div class="scroll" id="supply"></div>

      <h2>What people asked for</h2>
      <div id="timeline"></div>
    </div>
  </details>

  <h2 id="refh" hidden>The log could not account for</h2>
  <div id="refs"></div>
</div>
<script>
var $ = function (id) { return document.getElementById(id); };
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function when(ms) { return new Date(ms).toLocaleString(); }

/* WHAT THE READER HAS OPENED, kept OUTSIDE the render.
   The page redraws every few seconds; without this, a department you expanded closes itself
   under your hand, which makes the page feel like it is fighting you. */
var opened = { depts: {}, stages: {}, rooms: {}, tabs: {}, docs: {} };

/* AND WHAT THEY ARE TYPING. A refresh mid-sentence wipes a reason somebody was halfway through
   writing — and a reason is required, so that is the field they are always halfway through. */
var typing = false;
function watchTyping(root) {
  var fields = root.querySelectorAll("input");
  for (var i = 0; i < fields.length; i++) {
    fields[i].addEventListener("focus", function () { typing = true; });
    fields[i].addEventListener("blur", function (e) { if (e.target.value.trim() === "") typing = false; });
  }
}

/* A CONFIRMATION THAT SURVIVES THE REDRAW IT CAUSED.
   Acting changes the organization, which changes the view, which repaints the page — and the first
   version put the confirmation in the card that the repaint then replaced. So the reader clicked
   Approve, the card vanished, and nothing said it had worked. The message lives outside the render
   and is re-applied by it, for long enough to be read. */
var flash = null;
function say(msg, ok) {
  flash = { msg: msg, ok: ok, atMs: Date.now() };
  paintFlash();
}
function paintFlash() {
  var n = $("note-global");
  if (!n) return;
  if (flash === null || Date.now() - flash.atMs > 8000) { n.textContent = ""; return; }
  n.className = "note " + (flash.ok ? "ok" : "bad");
  n.textContent = flash.msg;
}

/* ── ONE DOOR FOR EVERY ACTION ───────────────────────────────────────────────
   Every button on this page ends up here. There is no form where you choose a verb and type a
   subject: the verb comes from the button and the subject comes from the thing you clicked, so an
   action addressed at nothing is not something the interface can express. */
async function send(kind, subjectId, reason, detail, noteId) {
  var note = noteId ? $(noteId) : null;
  if (!reason || reason.trim() === "") {
    if (note) { note.className = "note bad"; note.textContent = "Say why — every action here is recorded with a reason."; }
    return false;
  }
  try {
    var res = await fetch("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: kind,
        byHuman: (window.localStorage && localStorage.getItem("org-who")) || "operator",
        subjectId: subjectId,
        reason: reason.trim(),
        atMs: Date.now(),
        detail: detail || {},
      }),
    });
    var out = await res.json();
    var msg = out.ok ? "Recorded. The organization will pick it up on its next pass." : out.reason;
    say(msg, out.ok);
    /* Also in place, for a refusal — which does NOT repaint, so the reader can see what was wrong
       with the field they are still looking at. */
    if (note && !out.ok) { note.className = "note bad"; note.textContent = out.reason; }
    if (out.ok) { typing = false; tick(); }
    return out.ok;
  } catch (err) {
    say("Could not reach the server: " + err.message, false);
    if (note) { note.className = "note bad"; note.textContent = "Could not reach the server: " + err.message; }
    return false;
  }
}

/* ── WHAT AM I ACTUALLY APPROVING? ───────────────────────────────────────────
   The question the whole page failed to answer. An Approve button over a gate NAME asks somebody to
   sign for a thing they have not been shown, which is the rubber stamp the fourteen gates exist to
   prevent, arriving one layer out. So the card shows what the phase produced — and when the phase
   produced nothing, it says so in red instead of offering a button as though there were something
   to approve. */
function evidenceFor(w) {
  var stage = null;
  for (var i = 0; i < w.stages.length; i++) {
    if (w.stages[i].gate === w.awaitingHumanAt) stage = w.stages[i];
  }
  if (stage === null) return "";
  var out = "";
  if (stage.produced && (stage.produced.summary || stage.produced.refs.length > 0)) {
    out += '<div class="made"><div class="mt">What was produced for this stage</div>'
      + esc(stage.produced.summary)
      + (stage.produced.refs.length > 0
          ? '<div style="margin-top:7px">' + stage.produced.refs.map(function (r) {
              return '<span class="evd">' + esc(r) + "</span>";
            }).join("") + "</div>"
          : "")
      + "</div>";
  } else {
    out += '<div class="nothing"><b>Nothing was produced for this stage.</b> No document, no diff, '
      + "no reference &mdash; there is no artifact behind this gate for you to read. Approving it "
      + "records your name against a phase that made nothing. Sending it back costs the organization "
      + "one more pass; approving it blind costs whatever the missing work would have caught.</div>";
  }
  /* WHAT CAME BEFORE. A person approving the BRD needs to know whether the two stages behind it
     were examined by anybody, because approving on top of two defaults is approving three things. */
  var priorStamped = w.stages.filter(function (s) { return s.state === "passed" && s.rubberStamped; });
  if (priorStamped.length > 0) {
    out += '<div class="silent loud">' + priorStamped.length + " earlier stage"
      + (priorStamped.length === 1 ? " was" : "s were")
      + " passed by a simulated reviewer that reads no evidence and consults nobody &mdash; "
      + esc(priorStamped.map(function (s) { return s.label; }).join(", "))
      + ". You are being asked to approve on top of them.</div>";
  }
  return out;
}

/* ── NEEDS YOU ───────────────────────────────────────────────────────────────
   The only section on this page that does not move unless the reader moves, so it is the only one
   above the fold. Two kinds live here and they are genuinely different: a CHECKPOINT is the
   organization pausing at a gate it was told to pause at, and a BLOCKER is an agent that ran out of
   organization and needs a person. The first is expected; the second is the company stuck. */
function drawNeeds(v) {
  var out = "";
  var gates = v.awaitingDecisions || [];
  var blockers = v.awaitingPeople || [];

  for (var i = 0; i < gates.length; i++) {
    var w = gates[i];
    out += '<div class="ask">'
      + '<div class="who">Waiting for your approval &middot; ' + esc(w.awaitingHumanLabel) + "</div>"
      + '<div class="q">' + esc(w.awaitingHumanAsks) + "</div>"
      + '<div class="ctx"><b>' + esc(w.title) + "</b> &middot; " + esc(w.typeLabel)
      + " &middot; " + esc(w.gatesPassed) + " of " + esc(w.gatesTotal) + " stages done"
      + (w.assigneeName ? " &middot; with " + esc(w.assigneeName) : "") + "</div>"
      + evidenceFor(w)
      + '<div class="actions">'
      + '<input id="r-' + esc(w.workId) + '" placeholder="Why? (recorded against your name)" />'
      + '<button class="go" data-approve="' + esc(w.workId) + '" data-gate="' + esc(w.awaitingHumanAt) + '">Approve</button>'
      + '<button class="go no" data-reject="' + esc(w.workId) + '" data-gate="' + esc(w.awaitingHumanAt) + '">Send back</button>'
      + "</div>"
      + '<div class="note" id="n-' + esc(w.workId) + '"></div>'
      + "</div>";
  }

  for (var j = 0; j < blockers.length; j++) {
    var b = blockers[j];
    out += '<div class="ask blocker">'
      + '<div class="who">Stuck &middot; nobody in the company can answer this</div>'
      + '<div class="q">' + esc(b.about) + "</div>"
      + '<div class="ctx">' + esc(b.because) + '<br />Raised by <b>' + esc(b.byName)
      + "</b> &middot; an answer lets it: " + esc(b.unblocks) + "</div>"
      + '<div class="actions">'
      + '<input id="a-' + esc(b.blockerId) + '" placeholder="Your answer" />'
      + '<button class="go" data-answer="' + esc(b.blockerId) + '">Answer</button>'
      + "</div>"
      + '<div class="note" id=" n-' + esc(b.blockerId) + '"></div>'.replace(" n-", "nb-")
      + "</div>";
  }

  for (var k = 0; k < (v.blockerProblems || []).length; k++) {
    out += '<div class="warnline">A question could not be read: <code>'
      + esc(v.blockerProblems[k].file) + "</code> &mdash; " + esc(v.blockerProblems[k].reason) + "</div>";
  }

  if (out === "") {
    out = '<p class="empty">Nothing is waiting on you. The organization is running on its own.</p>';
  }
  $("needs").innerHTML = out;

  var self = document.getElementById("needs");
  self.querySelectorAll("[data-approve]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-approve");
      send("approve_gate", id, ($("r-" + id) || {}).value, { gate: btn.getAttribute("data-gate") }, "n-" + id);
    });
  });
  self.querySelectorAll("[data-reject]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-reject");
      send("reject_gate", id, ($("r-" + id) || {}).value, { gate: btn.getAttribute("data-gate") }, "n-" + id);
    });
  });
  self.querySelectorAll("[data-answer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-answer");
      var text = ($("a-" + id) || {}).value || "";
      send("answer_blocker", id, "answered from the dashboard", { answer: text.trim() }, "nb-" + id);
    });
  });
  watchTyping(self);
}

/* ── THE FLOOR ───────────────────────────────────────────────────────────────
   Idle departments are SHOWN, dashed and quiet. A chart that hid them would answer "what is
   everyone doing" with "everyone is busy", and an idle Security department is a different fact
   from an absent one — usually a more interesting one. */
function drawDepartments(v) {
  var busy = 0;
  var html = v.departments.map(function (d) {
    var isIdle = d.active.length === 0;
    if (!isIdle) busy++;
    var body = '<div class="dept' + (isIdle ? " idle" : "") + '" data-dept="' + esc(d.departmentId) + '">'
      + '<div class="nm">' + esc(d.name) + "</div>"
      + '<div class="hd">' + (d.headName ? "Led by " + esc(d.headName) : "No head in the chart") + "</div>"
      + '<div class="row"><span><b>' + d.active.length + "</b>/" + d.hatCount + " working</span>"
      + "<span><b>" + d.decisions + "</b> decisions</span>"
      + "<span><b>" + d.working.length + "</b> in hand</span></div>";
    if (opened.depts[d.departmentId] && d.active.length > 0) {
      body += '<div class="people">' + d.active.map(function (p) {
        return '<div class="person"><span class="pn">' + esc(p.name) + "</span>"
          + '<span class="lv">' + esc(p.level) + "</span>"
          + '<span class="rt">' + (p.doingNow ? '<span class="busy">' + esc(p.doingNow) + "</span>" : "")
          + (p.decisions > 0 ? " &middot; " + p.decisions + " decisions" : "") + "</span></div>";
      }).join("") + "</div>";
    }
    return body + "</div>";
  }).join("");
  $("depts").innerHTML = html;
  $("floorn").textContent = busy + " of " + v.departments.length + " active";
  $("depts").querySelectorAll("[data-dept]").forEach(function (el) {
    el.addEventListener("click", function () {
      var id = el.getAttribute("data-dept");
      opened.depts[id] = !opened.depts[id];
      drawDepartments(v);
    });
  });
}

/* ── WORK, WITH THE WHOLE JOURNEY VISIBLE ────────────────────────────────────
   The rail is fourteen segments because the chain is fourteen gates. A ratio would say "2 of 14"
   and leave the reader no better off; this says WHICH two, and opening it says who signed them and
   why — which is the difference between a progress bar and an account. */
function drawWork(v) {
  if (v.work.length === 0) {
    $("items").innerHTML = '<p class="empty">No work has reached the organization yet.</p>';
    $("workn").textContent = "";
    return;
  }
  $("workn").textContent = v.done.length + " delivered, " + v.inFlight.length + " in flight, "
    + v.pending.length + " unstaffed";

  $("items").innerHTML = v.work.map(function (w) {
    var chip = w.merged
      ? '<span class="chip done">Delivered</span>'
      : w.awaitingHumanAt
        ? '<span class="chip wait">Waiting on you</span>'
        : '<span class="chip">' + esc(w.stateLabel) + "</span>";
    var rail = w.stages.map(function (s) {
      var cls = s.state === "passed" ? (s.byHuman ? "passed human" : "passed") : s.state;
      return '<div class="seg ' + cls + '" title="' + esc(s.label)
        + (s.byName ? " - " + esc(s.byName) : "") + '"></div>';
    }).join("");

    /* WHERE THE WORK IS. The first thing a developer looks for, and the thing the log used to
       throw away: it recorded that a change reached Merged and not where to go and read it. */
    var where = "";
    if (w.change) {
      where = '<div class="where"><span class="muted-t">branch</span> <code>' + esc(w.change.branch) + "</code>"
        + (w.change.url ? ' &middot; <a href="' + esc(w.change.url) + '" target="_blank" rel="noreferrer">open the merge request &#8599;</a>' : "")
        + (w.change.workdir ? ' &middot; <span class="muted-t">worktree</span> <code>' + esc(w.change.workdir) + "</code>" : "")
        + "</div>";
    }

    var tab = opened.tabs[w.workId] || "steps";
    var counts = {
      steps: w.gatesTotal,
      docs: w.stages.filter(function (s) { return s.produced && s.produced.refs.length > 0; }).length,
      reviews: w.stages.filter(function (s) { return s.byName; }).length,
      tests: w.tests.length,
    };
    var tabs = '<div class="tabs">'
      + ["steps", "docs", "reviews", "tests"].map(function (k) {
          var label = { steps: "Steps", docs: "Documents", reviews: "Reviews", tests: "Tests" }[k];
          return '<button data-tab="' + k + '" data-for="' + esc(w.workId) + '"'
            + (tab === k ? ' class="on"' : "") + ">" + label
            + (counts[k] ? ' <span class="muted-t">' + counts[k] + "</span>" : "") + "</button>";
        }).join("")
      + "</div>";

    var pane = "";
    if (tab === "steps") {
      /* EVERY STEP, AND WHAT IT WAS SUPPOSED TO DO. The checklist is the standard the step is held
         to; the plan is what this run said it would do. Showing both makes a step that planned
         less than its standard visible, which a verdict alone never does. */
      pane = w.stages.map(function (s) {
        var cls = s.state === "passed" && s.byHuman ? "human" : s.state;
        var items = (s.plan.length > 0 ? s.plan : s.checklist).map(function (t) {
          return '<div class="pi' + (s.state === "passed" ? " on" : "") + '">' + esc(t) + "</div>";
        }).join("");
        return '<div class="step"><div class="sh"><span class="pip ' + cls + '"></span>'
          + '<span class="sn">' + esc(s.label) + "</span>"
          + (s.byName ? '<span class="sby">' + esc(s.byName) + "</span>" : '<span class="sby muted-t">'
              + (s.state === "waiting" ? "waiting for you" : s.state === "next" ? "up next" : "not reached") + "</span>")
          + (s.byHuman ? ' <span class="tag">you</span>' : "")
          + (s.rubberStamped ? ' <span class="stamp">not reviewed</span>' : "")
          + (s.durationMs !== undefined && s.durationMs > 0 ? '<span class="d">' + s.durationMs + "ms</span>" : "")
          + "</div>"
          + '<div class="plan"><div class="pl">' + (s.plan.length > 0 ? "What this step said it would do" : "What this step is for") + "</div>"
          + (items || '<div class="pi muted-t">nothing declared</div>') + "</div>"
          + (s.produced && s.produced.summary ? '<div class="made2">' + esc(s.produced.summary) + "</div>" : "")
          + "</div>";
      }).join("");
    } else if (tab === "docs") {
      var docs = w.stages.filter(function (s) { return s.produced && s.produced.refs.length > 0; });
      pane = docs.length === 0
        ? '<p class="empty">No phase in this run wrote a document. With every port simulated nothing is authored &mdash; wire <code>--artifact-cmd</code> and the documents appear here.</p>'
        : docs.map(function (s) {
            return s.produced.refs.map(function (ref) {
              var key = w.workId + "::" + ref;
              var on = !!opened.docs[key];
              return '<div class="doc' + (on ? " on" : "") + '">'
                + '<div class="dh" data-doc="' + esc(key) + '" data-ref="' + esc(ref) + '">'
                + '<span class="dg">' + esc(s.label) + "</span>"
                + '<span class="dp">' + esc(ref) + "</span></div>"
                + (on ? '<pre id="doc-' + esc(key) + '">reading...</pre>' : "")
                + "</div>";
            }).join("");
          }).join("");
    } else if (tab === "reviews") {
      var judged = w.stages.filter(function (s) { return s.byName; });
      pane = judged.length === 0
        ? '<p class="empty">Nothing has been judged yet.</p>'
        : judged.map(function (s) {
            return '<div class="verd ' + (s.state === "passed" ? "ok" : "no") + '">'
              + '<div class="vh">' + esc(s.label) + " &mdash; " + esc(s.state)
              + (s.rubberStamped ? ' <span class="stamp">not reviewed</span>' : "")
              + (s.byHuman ? ' <span class="tag">you</span>' : "") + "</div>"
              + '<div class="vw">' + esc(s.byName) + "</div>"
              + '<div class="vr">' + esc(s.reason || "no reason was recorded") + "</div>"
              + (s.output.length > 0
                  ? '<div class="o" style="margin-top:6px">' + s.output.map(esc).join("<br />") + "</div>"
                  : "")
              + "</div>";
          }).join("");
    } else {
      pane = w.tests.length === 0
        ? '<p class="empty">No test has run against this change.</p>'
        : w.tests.map(function (t) {
            return '<div class="trow"><span class="tc">' + esc(t.testCaseId) + "</span>"
              + '<span class="to ' + esc(t.outcome) + '">' + esc(t.outcome) + "</span>"
              + '<span class="td">' + t.durationMs + "ms</span>"
              + '<span class="muted-t">' + esc(t.byHatId) + "</span>"
              + '<span class="o">' + t.evidence.map(esc).join(" ") + "</span></div>";
          }).join("");
    }

    var isOpen = !!opened.stages[w.workId];
    return '<div class="item">'
      + '<div class="top"><span class="ttl">' + esc(w.title) + "</span>" + chip
      + '<span class="chip quiet">' + esc(w.typeLabel) + "</span></div>"
      + '<div class="meta">' + (w.assigneeName
          ? "With <b>" + esc(w.assigneeName) + "</b>" + (w.assigneeDepartment ? " in " + esc(w.assigneeDepartment) : "")
          : "<b>Nobody is on this</b>")
        + ' &middot; <code>' + esc(w.workId) + "</code></div>"
      + where
      + '<div class="rail">' + rail + "</div>"
      + '<div class="railfoot"><span><b>' + w.gatesPassed + "</b> of <b>" + w.gatesTotal + "</b> steps"
      + (w.merged ? " &middot; complete" : (w.nextGateLabel ? " &middot; next: <b>" + esc(w.nextGateLabel) + "</b>" : ""))
      + (w.rubberStamped > 0 ? ' &middot; <span class="bad-t">' + w.rubberStamped + " not reviewed</span>" : "")
      + (w.unauthorized > 0 ? ' &middot; <span class="bad-t">' + w.unauthorized + " out-of-scope verdict(s)</span>" : "")
      + "</span>"
      + '<button class="toggle" data-stages="' + esc(w.workId) + '">'
      + (isOpen ? "Close" : "Open this change") + "</button></div>"
      + (w.refusals.length > 0
          ? w.refusals.map(function (r) { return '<div class="warnline">' + esc(r) + "</div>"; }).join("")
          : "")
      + (isOpen ? tabs + '<div class="pane">' + pane + "</div>" : "")
      + "</div>";
  }).join("");

  $("items").querySelectorAll("[data-stages]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-stages");
      opened.stages[id] = !opened.stages[id];
      drawWork(v);
    });
  });
  $("items").querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      opened.tabs[btn.getAttribute("data-for")] = btn.getAttribute("data-tab");
      drawWork(v);
    });
  });
  /* READING A DOCUMENT is a fetch, because the page holds the log and the log holds a PATH. The
     server decides whether that path is readable at all - see the --docs allowlist. */
  $("items").querySelectorAll("[data-doc]").forEach(function (el) {
    el.addEventListener("click", async function () {
      var key = el.getAttribute("data-doc");
      var ref = el.getAttribute("data-ref");
      opened.docs[key] = !opened.docs[key];
      drawWork(v);
      if (!opened.docs[key]) return;
      var box = $("doc-" + key);
      if (!box) return;
      try {
        var res = await fetch("/api/artifact?ref=" + encodeURIComponent(ref), { cache: "no-store" });
        var out = await res.json();
        box.textContent = out.ok ? out.text : "Cannot read it: " + out.reason;
      } catch (err) {
        box.textContent = "Cannot read it: " + err.message;
      }
    });
  });
}

/* ── ROOMS YOU CAN ACTUALLY OPEN ─────────────────────────────────────────────
   A room was a block with a count on it. Everything a person wants from a room — who asked, what
   they asked, what was attached, what was said, what was decided, and why it is quiet if it is —
   was in the log the whole time and none of it was on the screen. */
function drawRooms(v) {
  var open = v.rooms.filter(function (r) { return r.open; }).length;
  $("roomn").textContent = open + " open of " + v.rooms.length;
  $("roomlist").innerHTML = v.rooms.length === 0
    ? '<p class="empty">The organization has not opened a room yet.</p>'
    : v.rooms.slice(0, 40).map(function (r) {
        var isOpen = !!opened.rooms[r.roomId];
        var head = '<div class="room open' + (r.open ? "" : " closed") + '" data-room="' + esc(r.roomId) + '">'
          + '<div class="rt2">' + esc(r.title) + "</div>"
          + '<div class="rp">' + esc(r.why) + "</div>"
          + '<div class="rw">' + esc(r.openedByName)
          + (r.askedOfName ? " asked <b>" + esc(r.askedOfName) + "</b>" : "")
          + " &middot; owes <b>" + esc(r.owes) + "</b>"
          + " &middot; " + r.turns.length + (r.turns.length === 1 ? " turn" : " turns")
          + (r.workId ? " &middot; <code>" + esc(r.workId) + "</code>" : "") + "</div>";
        if (!isOpen) {
          return head + (r.silentBecause
            ? '<div class="silent' + (r.silentBecause.indexOf("NOBODY") === 0 ? " loud" : "") + '">'
              + esc(r.silentBecause.slice(0, 70)) + "&hellip;</div>"
            : '<div class="turn"><b>' + esc(r.turns[r.turns.length - 1].byName) + "</b> "
              + esc(r.turns[r.turns.length - 1].body) + "</div>")
            + "</div>";
        }
        var body = head + '<div class="detail">'
          + '<dl class="dl">'
          + "<dt>Asked</dt><dd>" + esc(r.openingMessage || "nothing was said when this was opened") + "</dd>"
          + "<dt>In the room</dt><dd>" + esc(r.participants.join(", ")) + "</dd>"
          + "<dt>State</dt><dd>" + esc(r.state) + "</dd>"
          + "</dl>"
          + (r.evidence.length > 0
              ? "<div>Attached: " + r.evidence.map(function (e) {
                  return '<span class="evd">' + esc(e) + "</span>";
                }).join("") + "</div>"
              : '<div class="silent">Nothing was attached to this request. The reviewer was asked to '
                + "judge it from the work item alone.</div>")
          + (r.turns.length === 0
              ? '<div class="silent' + (r.silentBecause && r.silentBecause.indexOf("NOBODY") === 0 ? " loud" : "") + '">'
                + esc(r.silentBecause) + "</div>"
              : r.turns.map(function (t) {
                  return '<div class="turn' + (t.byHuman ? " human" : "") + '"><b>' + esc(t.byName) + "</b> "
                    + '<span class="muted-t">' + when(t.atMs) + "</span><div>" + esc(t.body) + "</div></div>";
                }).join(""))
          + (r.verdict
              ? '<div class="made"><div class="mt">What this room decided</div>'
                + '<span class="' + (r.verdict.outcome === "approved" ? "ok-t" : "bad-t") + '">'
                + esc(r.verdict.outcome) + "</span> by " + esc(r.verdict.byName)
                + ' <span class="muted-t">&mdash; ' + esc(r.verdict.reason) + "</span></div>"
              : "")
          + '<div class="actions" style="margin-top:10px">'
          + '<input id="say-' + esc(r.roomId) + '" placeholder="Say something in this room" />'
          + '<button class="go" data-say="' + esc(r.roomId) + '">Post</button></div>'
          + '<div class="note" id="sn-' + esc(r.roomId) + '"></div>'
          + "</div></div>";
        return body;
      }).join("");

  $("roomlist").querySelectorAll("[data-room]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (e.target.closest(".actions")) return;
      var id = el.getAttribute("data-room");
      opened.rooms[id] = !opened.rooms[id];
      drawRooms(v);
    });
  });
  $("roomlist").querySelectorAll("[data-say]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-say");
      var text = ($("say-" + id) || {}).value || "";
      send("post_to_room", id, "left a note in the room", { message: text.trim() }, "sn-" + id);
    });
  });
  watchTyping($("roomlist"));
}

function drawDecisions(v) {
  $("decn").textContent = v.approvals.length + " recorded";
  $("approvals").innerHTML = v.approvals.length === 0
    ? '<p class="empty">No gate has been judged yet.</p>'
    : '<table><thead><tr><th>Stage</th><th>Verdict</th><th>Who</th><th>Work</th><th>Because</th></tr></thead><tbody>'
      + v.approvals.slice(0, 60).map(function (a) {
          var cls = a.outcome === "approved" || a.outcome === "waived" ? "ok-t" : "bad-t";
          return "<tr><td>" + esc(a.gateLabel) + "</td>"
            + '<td class="' + cls + '">' + esc(a.outcome) + "</td>"
            + "<td>" + esc(a.byName) + (a.byHuman ? ' <span class="tag">you</span>' : "") + "</td>"
            + "<td><code>" + esc(a.workId) + "</code></td>"
            + '<td class="muted-t">' + esc(a.reason) + "</td></tr>";
        }).join("")
      + "</tbody></table>";
}

function drawStaffing(v) {
  if (v.supply.length === 0 && v.agents.length === 0) {
    $("supply").innerHTML = '<p class="empty">No roster was declared, so every hat has an unlimited '
      + "supply of wearers &mdash; a staffing decision that cannot be refused. "
      + "Start the server with <code>--roster &lt;file&gt;</code> to make supply real.</p>";
    return;
  }
  $("supply").innerHTML = '<table><thead><tr><th>Hat</th><th class="n">Capacity</th><th>Wearing it</th>'
    + "<th>Free</th><th>Blocked</th></tr></thead><tbody>"
    + v.supply.map(function (h) {
        return "<tr><td>" + esc(h.hatId) + "</td><td>" + h.maxWearers + "</td>"
          + "<td>" + (h.wearers.length ? h.wearers.map(esc).join(", ") : '<span class="muted-t">nobody</span>') + "</td>"
          + "<td>" + (h.available.length ? h.available.map(esc).join(", ") : '<span class="bad-t">none &mdash; unstaffable</span>') + "</td>"
          + '<td class="muted-t">' + (h.blocked.length
              ? esc(h.blocked.map(function (b) { return b.agentId + " (" + b.reason + ")"; }).join("; ")) : "&mdash;")
          + "</td></tr>";
      }).join("")
    + "</tbody></table>";
}

function drawTimeline(v) {
  var rows = v.actions.slice().reverse().slice(0, 25).map(function (a) {
    return '<div class="turn"><b>' + esc(a.byHuman) + "</b> " + esc(a.kind.replace(/_/g, " "))
      + " &middot; <code>" + esc(a.subjectId) + "</code> " + '<span class="muted-t">' + when(a.atMs)
      + '</span><div class="muted-t">' + esc(a.reason) + "</div></div>";
  }).join("");
  var lost = (v.actionProblems || []).map(function (p) {
    return '<div class="warnline">A request could not be read: <code>' + esc(p.file) + "</code> &mdash; "
      + esc(p.reason) + "</div>";
  }).join("");
  $("timeline").innerHTML = (rows + lost)
    || '<p class="empty">Nobody has asked the organization for anything yet.</p>';
}

function draw(v) {
  var flags = [];
  if ((v.awaitingDecisions || []).length > 0) flags.push((v.awaitingDecisions.length) + " awaiting your approval");
  if ((v.awaitingPeople || []).length > 0) flags.push(v.awaitingPeople.length + " stuck without you");
  $("state").innerHTML =
    "<span><b>" + v.done.length + "</b> delivered</span>"
    + "<span><b>" + v.inFlight.length + "</b> in flight</span>"
    + "<span><b>" + v.approvals.length + "</b> decisions</span>"
    + "<span><b>" + v.rooms.filter(function (r) { return r.open; }).length + "</b> rooms open</span>"
    + "<span><b>" + v.runs + "</b> runs, <b>" + v.events + "</b> events</span>"
    + (v.paused ? '<span class="flag">PAUSED</span>' : "")
    + (flags.length ? '<span class="flag">' + esc(flags.join(" &middot; ")).replace(/&amp;middot;/g, "&middot;") + "</span>" : "")
    + '<span class="note" id="note-global"></span>';
  paintFlash();
  $("pause").textContent = v.paused ? "Resume" : "Pause";

  var busyNames = [];
  for (var di = 0; di < v.departments.length; di++) {
    for (var pi = 0; pi < v.departments[di].active.length; pi++) {
      if (v.departments[di].active[pi].decisions > 0) busyNames.push(v.departments[di].active[pi].name);
    }
  }
  var stamped = v.work.reduce(function (n, w) { return n + w.rubberStamped; }, 0);
  $("orgline").innerHTML =
    "<b>" + v.approvals.length + "</b> gates passed"
    + (stamped > 0 ? ' (<span class="bad-t">' + stamped + " not reviewed</span>)" : "")
    + " &middot; <b>" + v.rooms.filter(function (r) { return r.open; }).length + "</b> rooms open"
    + (busyNames.length > 0 ? " &middot; " + esc(busyNames.slice(0, 4).join(", ")) : "")
    + (busyNames.length > 4 ? " +" + (busyNames.length - 4) + " more" : "")
    + " deciding";

  drawNeeds(v);
  drawDepartments(v);
  drawWork(v);
  drawRooms(v);
  drawDecisions(v);
  drawStaffing(v);
  drawTimeline(v);

  $("refh").hidden = v.refusals.length === 0;
  $("refs").innerHTML = v.refusals.map(function (r) {
    return '<div class="warnline">' + esc(r) + "</div>";
  }).join("");
}

var latest = null;
var lastSeen = "";
async function tick() {
  /* A REDRAW MID-SENTENCE THROWS AWAY WHAT SOMEBODY IS WRITING, and every action here needs a
     written reason — so the poll holds off while a field has something in it. The data is still
     fetched; only the repaint waits. */
  try {
    var res = await fetch("/api/view", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var body = await res.text();
    latest = JSON.parse(body);
    /* REDRAW ONLY WHEN SOMETHING CHANGED.
       Replacing the whole document every four seconds destroys whatever the reader was in the
       middle of — a half-open department, a hovered stage, a selected line of text — and a finished
       run produces the identical view forever, so the page was fighting the reader to show them
       nothing new. Comparing the payload is enough: the view is a pure fold, so identical bytes
       mean an identical organization. */
    if (!typing && body !== lastSeen) {
      lastSeen = body;
      draw(latest);
    }
    $("pulsetext").textContent = (typing ? "paused while you type · " : "live · ") + new Date().toLocaleTimeString();
    $("dot").style.background = "var(--ok)";
  } catch (err) {
    /* A reader that goes quiet on failure is indistinguishable from one showing fresh data. */
    $("pulsetext").textContent = "cannot read the store — " + err.message;
    $("dot").style.background = "var(--bad)";
  }
}

$("pause").addEventListener("click", function () {
  if (!latest) return;
  var resume = latest.paused;
  var reason = window.prompt(resume ? "Why resume?" : "Why pause the organization?");
  if (reason === null) return;
  send(resume ? "resume_run" : "pause_run", "run", reason, {}, "note-global");
});

tick();
setInterval(tick, 4000);
</script></body></html>`;

export async function main(argv: readonly string[]): Promise<number> {
  const store = valueAfter(argv, "--store");
  if (store === undefined) {
    console.error("usage: serve-org.ts --store <dir> [--port 4319] [--host 127.0.0.1]");
    return 2;
  }
  const port = Number.parseInt(valueAfter(argv, "--port") ?? "4319", 10);
  const hostname = valueAfter(argv, "--host") ?? "127.0.0.1";

  const queueDir = valueAfter(argv, "--actions");
  const outboxDir = valueAfter(argv, "--blockers");
  // Repeatable. Empty means this server serves no file contents at all, which is the safe default
  // for a process that is otherwise read-only over a log.
  const docRoots = argv.map((a, i) => (a === "--docs" ? argv[i + 1] : undefined)).filter((v): v is string => v !== undefined);
  // `--request-url jira=https://x/browse/{id}` — repeatable, one per source. Absent for a source
  // means its ids render as text, which is the honest default for an unconfigured install.
  const requestUrls: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--request-url") continue;
    const pair = argv[i + 1] ?? "";
    const at = pair.indexOf("=");
    if (at > 0) requestUrls[pair.slice(0, at).trim().toLowerCase()] = pair.slice(at + 1).trim();
  }
  const rosterPath = valueAfter(argv, "--roster");
  // A single-page UI to serve at `/ui`, SAME ORIGIN as the API it reads.
  // Absent means this server serves its own built-in page and nothing else — a static file server
  // is not something a read-only observer should become by default.
  const uiPath = valueAfter(argv, "--ui");
  // WHO THE UI SIGNS AS. No default: see `portalPayload`. Without it the page can read everything
  // and answer nothing, which is the correct behaviour for a server nobody told who is using it.
  const operator = valueAfter(argv, "--operator");
  // ── THE COMMAND CENTRE'S THREE EXTRA SEAMS ────────────────────────────────
  // Each is absent by default and each absence is REPORTED by its route rather than faked: a
  // server with no tracker says it has no tracker, instead of showing an empty backlog that reads
  // as "there is no work".
  const jiraCredentialsPath = valueAfter(argv, "--jira");
  const inboxDir = valueAfter(argv, "--inbox");
  const roomsDir = valueAfter(argv, "--rooms");
  // The memory root. Absent ⇒ the portal says the organization has no memory rather than showing
  // an empty one, which would read as "it has learned nothing".
  const memoryDir = valueAfter(argv, "--memory");
  // Repeatable, and empty by default: no checkpoint exists unless an operator names one.
  const checkpoints = argv
    .map((a, i) => (a === "--checkpoint" ? argv[i + 1] : undefined))
    .filter((v): v is string => v === "grooming" || v === "approach") as readonly HumanCheckpoint[];

  Bun.serve({
    port,
    hostname,
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname;

      // ── WORK MANAGEMENT AND ROOMS, FIRST ───────────────────────────────
      // Ahead of every other route on purpose. `/api/work/:id` is a prefix match, so it swallowed
      // `/api/work/search` and answered "no work item 'search'" — a routing order bug that reads
      // as a missing feature. Specific paths are claimed before the prefix that contains them.
      const work = await workRoutes(path, request, {
        ...(jiraCredentialsPath === undefined ? {} : { jiraCredentialsPath }),
        ...(inboxDir === undefined ? {} : { inboxDir }),
        ...(roomsDir === undefined ? {} : { roomsDir }),
        ...(operator === undefined ? {} : { operator }),
      });
      if (work !== undefined) return work;

      // ── THE ONE WRITE, AND IT DOES NOT REACH THE ORGANIZATION ─────────────
      // A POST enqueues a REQUEST for the run to consider. It cannot change the cascade, a gate,
      // or a binding — writing to the queue and changing the org are different acts, which is what
      // lets this server accept input and still be unable to alter what it reports.
      if (path === "/api/actions" && request.method === "POST") {
        if (queueDir === undefined) {
          return json({ ok: false, reason: "this server was started without --actions, so it accepts none" }, 400);
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, reason: "body must be JSON" }, 400);
        }
        const verdict = acceptAction(body);
        if (!verdict.ok) return json({ ok: false, reason: verdict.reason }, 400);
        appendAction(verdict.action, queueDir);
        return json({ ok: true, action: verdict.action });
      }

      if (path === "/api/view") {
        return new Response(
          JSON.stringify(currentView(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls)),
          {
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      // ── THE SPINE, ADDRESSABLE ─────────────────────────────────────────
      // One endpoint per thing rather than one fold for everything: the app deep-links to a request
      // and to a work item, and a page that can only be reached by folding the world is a page that
      // cannot be linked to.
      if (path === "/api/requests") {
        const view = currentView(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls);
        return json({ requests: view.requests, refused: view.refusedRequests });
      }
      if (path.startsWith("/api/requests/")) {
        const key = decodeURIComponent(path.slice("/api/requests/".length));
        const view = currentView(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls);
        const request = view.requests.find((r) => r.key === key || r.externalId === key);
        if (request === undefined) return json({ ok: false, reason: `no request '${key}'` }, 404);
        // The request AND the work under it, resolved — so one fetch fills the whole page rather
        // than the client joining ids it was handed.
        const ids = new Set(request.workIds);
        return json({
          request,
          work: view.work.filter((w) => ids.has(w.workId)),
          rooms: view.rooms.filter((r) => r.workId !== undefined && ids.has(r.workId)),
          approvals: view.approvals.filter((a) => ids.has(a.workId)),
        });
      }
      if (path.startsWith("/api/work/")) {
        const id = decodeURIComponent(path.slice("/api/work/".length));
        const view = currentView(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls);
        const item = view.work.find((w) => w.workId === id);
        if (item === undefined) return json({ ok: false, reason: `no work item '${id}'` }, 404);
        return json({
          work: item,
          rooms: view.rooms.filter((r) => r.workId === id),
          approvals: view.approvals.filter((a) => a.workId === id),
        });
      }
      // ── THE PORTAL, IN ONE FETCH ───────────────────────────────────────
      if (path === "/api/portal") {
        const payload = portalPayload(store, queueDir, rosterPath, checkpoints, outboxDir, requestUrls, operator, memoryDir) as Record<string, unknown>;
        // The rooms live in their own store, not the org log — the run folds them in later. The
        // portal shows them from the source that is current NOW, which is the store.
        return json({
          ...payload,
          rooms: roomsDir === undefined ? [] : loadRooms(roomsDir).map(roomJson),
          canOpenRoom: roomsDir !== undefined && operator !== undefined,
          hasTracker: jiraCredentialsPath !== undefined,
          canLoadWork: jiraCredentialsPath !== undefined && inboxDir !== undefined && operator !== undefined,
        });
      }
      // ── WATCHING IT WORK ──────────────────────────────────────────────
      // A TAIL of the log, never a second channel. See `event-stream.ts`: an in-memory bus would
      // be a second account of what the organization did, and the two would disagree exactly under
      // load, which is when somebody is watching.
      if (path === "/api/stream") {
        const url = new URL(request.url);
        // `Last-Event-ID` is what a browser sends on its OWN reconnect; `?cursor=` is for a client
        // that manages its own position. The header wins, because the browser knows what it
        // actually received and the caller only knows what it last asked for.
        const raw = request.headers.get("last-event-id") ?? url.searchParams.get("cursor");
        const parsed = parseCursor(raw);
        if (parsed === "invalid") {
          // REFUSED, not rewound. Silently starting from the beginning would replay the whole log
          // into the page and look, to the person watching, like the organization redoing its work.
          return new Response(`unreadable cursor '${String(raw)}' — expected <atMs>:<eventId>`, {
            status: 400,
          });
        }

        // A POSITION, not a cursor. The mark alone loses events: a run's life tick appends at the
        // run's own instant while the walk has advanced hours past it, so those events land behind
        // a mark that already went by. Measured on a live run: 161 of 318 events dropped.
        //
        // Seeded lazily, on the first tick, because seeding needs the log and the log is read there.
        let position: StreamPosition | undefined;
        let closed = false;
        const encoder = new TextEncoder();
        const everyMs = Number.parseInt(url.searchParams.get("everyMs") ?? "1000", 10);
        const period = Number.isFinite(everyMs) ? Math.min(10_000, Math.max(250, everyMs)) : 1000;

        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const push = (text: string): void => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(text));
              } catch {
                // The viewer went away mid-write. Stop the timer rather than throwing on every
                // tick for the rest of the process's life.
                closed = true;
              }
            };

            // Says what the socket IS before it says anything about the organization, so a viewer
            // that sees no events knows whether it is connected.
            push(`: watching ${store}\n\n`);

            const tick = (): void => {
              if (closed) return;
              let events: readonly OrgEvent[];
              try {
                events = readEvents(store);
              } catch (error) {
                // A store that cannot be read is REPORTED down the socket. Swallowing it would
                // leave the page showing a quiet organization when what happened is that its
                // history became unreadable.
                push(`event: error\ndata: ${JSON.stringify({ reason: String(error) })}\n\n`);
                return;
              }
              position = position ?? seedPosition(events, parsed);
              const stepped = advance(events, position, Date.now());
              position = stepped.position;
              for (const frame of stepped.frames) push(sseFrame(frame));
            };

            tick();
            const timer = setInterval(tick, period);
            // Fires when the client disconnects, which is the only way this stream ever ends.
            request.signal.addEventListener("abort", () => {
              closed = true;
              clearInterval(timer);
              try {
                controller.close();
              } catch {
                // Already closed by the runtime. Nothing to do and nothing worth reporting.
              }
            });
          },
        });

        return new Response(body, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            // Named so a proxy in front of this does not buffer the stream into uselessness.
            "x-accel-buffering": "no",
            ...(parsed === undefined ? {} : { "x-cursor": formatCursor(parsed) }),
          },
        });
      }
      if (path === "/api/artifact") {
        const ref = new URL(request.url).searchParams.get("ref") ?? "";
        const got = readArtifact(ref, docRoots);
        return new Response(JSON.stringify(got), {
          status: got.ok ? 200 : 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (path.startsWith("/api/hat/")) {
        const hatId = decodeURIComponent(path.slice("/api/hat/".length));
        return new Response(renderHat(hatId, "rmo_office"), {
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      // ── THE PORTAL PAGE, SAME ORIGIN AS ITS DATA ───────────────────────
      // Served from here rather than from a separate static server so `/api/portal` is a relative
      // fetch. The alternative was CORS on a process whose whole claim is that it is read-only.
      if ((path === "/ui" || path === "/ui/") && uiPath !== undefined) {
        try {
          return new Response(readFileSync(uiPath, "utf-8"), {
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          });
        } catch (error) {
          return new Response(`could not read ${uiPath}: ${String(error)}`, { status: 500 });
        }
      }
      if (path === "/" || path === "/index.html") {
        return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("not found", { status: 404 });
    },
  });

  console.log(`observing ${store}`);
  console.log(queueDir === undefined
    ? "  (read-only: no --actions queue, so this server accepts no human actions)"
    : `  accepting human actions into ${queueDir}`);
  console.log(rosterPath === undefined ? "  (no --roster: hats show no provisioning)" : `  roster ${rosterPath}`);
  console.log(docRoots.length === 0
    ? "  (no --docs: documents are listed by path and cannot be opened here)"
    : `  documents readable under ${docRoots.join(", ")}`);
  console.log(outboxDir === undefined
    ? "  (no --blockers: questions the organization raises will not be shown here)"
    : `  blocker outbox ${outboxDir}`);
  console.log(checkpoints.length === 0
    ? "  (no --checkpoint: the organization runs the whole chain agentically)"
    : `  human checkpoints: ${checkpoints.join(", ")}`);
  console.log(`  http://${hostname}:${String(port)}/            the view`);
  console.log(`  http://${hostname}:${String(port)}/api/view    the same numbers as JSON`);
  console.log(`  http://${hostname}:${String(port)}/api/hat/cfo one hat's duty and omissions`);
  console.log("the only write is the action QUEUE; nothing here can change the organization itself.");
  await new Promise(() => {});
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
