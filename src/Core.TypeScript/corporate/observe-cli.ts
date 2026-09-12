/**
 * observe-cli.ts — an agent's worldview, served as a command it can run.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * Every agent this organization runs used to be HANDED its context: a gate name, a work id, a list of
 * paths, a brief copied into its environment. Each adapter chose what the agent got, so what an agent
 * knew depended on which adapter happened to invoke it — and an agent could never look at anything
 * it was not given. The Agentic Team's first real run found the consequence four times over: the
 * fixer never saw the reproduction, the BRD author never saw the grooming, the reviewer saw nothing.
 *
 * This inverts it. An agent is told WHO it is and that `observe` is its worldview, and it asks:
 *
 *   dashboard                  what I hold, what is waiting on me, what matters, what I could do
 *   item <workId>              one work item: description, steps, attachments, comments, links
 *   attachment <workId> <ref>  one thing left on that item, printed
 *   menu                       every action open to me, not only the first twelve
 *
 * The World it serves is built by the same bridge the organization's own driver uses
 * (`orgSurfaceFor`), plus the item record (`ItemContext`) folded from the log. Read-only: nothing
 * here writes, so an agent may run it as often as it likes, including in the middle of a run —
 * events are appended as they happen, so what it sees is what the organization has recorded so far.
 *
 * usage: bun observe-cli.ts --store <dir> --hat <hatId> [--actions <dir>] [--json] <command> [...]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildMenu,
  renderAction,
  renderDashboard,
  renderItem,
  type BacklogItem,
  type ItemAttachment,
  type ItemComment,
  type ItemContext,
  type Navigation,
  type World,
} from "../observe/observe";
import { readActions } from "./action-queue";
import { readBlockers } from "./blocker-outbox";
import type { RaisedBlocker } from "./human-blocker";
import { chainOf } from "./gate-demand";
import { childrenOf, isLeafType, nodeById, WorkState, type CascadeNode } from "./goal-cascade";
import { HumanActionKind, type HumanAction } from "./human-action";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldActionItems, foldBoard, foldHandedOffChanges, foldOrganization, foldSupervisorSignals, type FoldedOrganization } from "./org-fold";
import { orgSurfaceFor } from "./org-observe-bridge";
import { SEED_HATS } from "./org-seed";
import { readEvents, readRuns } from "./org-store";
import { viewOf, type WorkView } from "./observe-org";
import { gateQuestion, hatName } from "./org-presentation";
import { isPassing } from "./quality-gate";
import { parseRequestRef } from "./request";

/** The largest attachment printed whole. Past it, the head is printed and the rest is said to exist. */
const ATTACHMENT_LIMIT = 200_000;

/**
 * Every work item as a record an agent can open.
 *
 * One per cascade node, and each carries ONLY ITS OWN history. Its parent is a link: an agent that
 * wants the grooming behind a defect opens the goal, rather than finding it pre-copied onto every
 * child — which is what made each agent's picture of the work depend on who assembled it.
 */
export function itemContextsFrom(
  events: readonly OrgEvent[],
  folded: FoldedOrganization,
  work: readonly WorkView[],
  actions: readonly HumanAction[],
  /** For hat names beside ids. Absent, the ids are shown. */
  chart?: OrgChart,
  /**
   * Questions raised to a person that live in the blocker OUTBOX rather than the log. Without them an
   * item never showed what it asked - or what the person answered.
   */
  outbox: readonly RaisedBlocker[] = [],
): readonly ItemContext[] {
  const board = foldBoard(events);
  const views = new Map(work.map((w) => [w.workId, w] as const));
  const handedOff = foldHandedOffChanges(events);
  const actionItems = foldActionItems(events);
  const refusedOn = new Map<string, OrgEvent[]>();
  for (const e of events) {
    if (e.kind !== OrgEventKind.Refusal) continue;
    refusedOn.set(e.subjectId, [...(refusedOn.get(e.subjectId) ?? []), e]);
  }
  const docs = [...folded.documents.values()];
  return folded.cascade.nodes.map((node) => {
    const w = views.get(node.workId);
    // THE STEPS THIS ITEM OWES — its own stated chain when it has one — in order, with the LATEST
    // verdict and what the step produced, READ FROM THE LOG. It was read from `WorkView`, which covers
    // leaves only: MEASURED, a goal rejected twice showed both of its steps as `pending`, and the
    // reviewer that opened it saw no verdicts and no attachments.
    const steps = chainOf(node).map((gate) => {
      const verdicts = folded.gateEvaluations
        .filter((e) => e.workId === node.workId && String(e.gate) === String(gate))
        .sort((a, b) => a.atMs - b.atMs);
      const last = verdicts[verdicts.length - 1];
      const produced = folded.phaseOutputs.get(`${node.workId}::${String(gate)}`);
      const passed = last !== undefined && isPassing(last.outcome);
      return {
        name: String(gate),
        state: last === undefined ? (produced === undefined ? "pending" : "produced, awaiting verdict") : String(last.outcome),
        done: passed,
        asks: gateQuestion(String(gate)),
        ...(last === undefined ? {} : { by: chart === undefined ? last.byHatId : hatName(chart, last.byHatId), note: last.reason, atMs: last.atMs }),
        ...(produced === undefined || produced.refs.length === 0 ? {} : { attachments: produced.refs }),
      };
    });

    // ATTACHMENTS: every document that resolved to bytes, then anything else a step left. Deduped by
    // ref, first writer kept, so a document is listed once with the step that wrote it.
    const attachments: ItemAttachment[] = [];
    const seen = new Set<string>();
    // ── AN ATTACHMENT IS SOMETHING THAT CAN BE OPENED ─────────────────────────────────────────
    // MEASURED on agentic-tpm task-032, 2026-09-12: one listed attachment was 4,031 characters of a
    // test run's stdout - a step's `log:` evidence, which carries its text INSIDE the ref. It was
    // offered as openable, and opening it resolved the blob as a path and reported it missing. It was
    // also printed in full, twice, in a view every session reads. A ref that spans lines or is longer
    // than any path is evidence, not a document: the step that produced it already says what it says.
    const openable = (ref: string): boolean => !ref.includes(String.fromCharCode(10)) && ref.length <= 400;
    const attach = (a: ItemAttachment): void => {
      if (seen.has(a.ref) || !openable(a.ref)) return;
      seen.add(a.ref);
      attachments.push(a);
    };
    for (const d of docs.filter((x) => x.workId === node.workId).sort((a, b) => a.atMs - b.atMs)) {
      attach({ ref: d.path, from: d.gate, by: d.producedByHatId, atMs: d.atMs });
    }
    for (const st of steps) for (const ref of st.attachments ?? []) attach({ ref, from: st.name });

    // COMMENTS: what was said about the item — in rooms held on it, by people acting on it, and the
    // questions raised because of it. Verdict reasons are on the steps, not repeated here.
    const comments: ItemComment[] = [];
    const anchors = new Map(board.anchors.filter((a) => a.workItemId === node.workId).map((a) => [a.anchorId, a] as const));
    for (const p of board.posts.filter((x) => anchors.has(x.anchorId))) {
      comments.push({ by: p.byHatId, text: p.body, atMs: p.atMs, about: anchors.get(p.anchorId)?.title ?? p.anchorId });
    }
    for (const a of actions.filter((x) => x.subjectId === node.workId)) {
      comments.push({
        by: a.byHuman,
        text: `${String(a.kind)}: ${a.reason}`,
        atMs: a.atMs,
        ...(a.detail?.["gate"] === undefined ? {} : { about: a.detail["gate"] }),
      });
    }
    const asked = [...new Map([...folded.blockers, ...outbox].map((b) => [b.blockerId, b] as const)).values()];
    for (const b of asked.filter((x) => x.blocking === node.workId)) {
      comments.push({ by: b.byHatId, text: `asked a person: ${b.about}`, atMs: b.atMs, about: "question" });
      // AND WHAT THE PERSON ANSWERED, on the same item. An answer is filed against the QUESTION, so
      // the loop above (subject = this item) never saw it. MEASURED on AIAGENT-1659: a reviewer
      // opened the item, found the author citing the requester's instruction, could not find the
      // instruction anywhere on the record, and rejected the step as a fabricated citation.
      for (const a of actions.filter((x) => x.kind === HumanActionKind.AnswerBlocker && x.subjectId === b.blockerId)) {
        comments.push({ by: a.byHuman, text: `answered: ${a.detail?.["answer"] ?? a.reason}`, atMs: a.atMs, about: "answer" });
      }
    }
    for (const r of w?.refusals ?? []) comments.push({ by: "organization", text: r, about: "refused" });
    // What the organization declined to do FOR THIS ITEM, as the runtime recorded it — a step whose
    // author failed, a gate nobody could judge. The next attempt reads why here, not a bare verdict.
    for (const e of refusedOn.get(node.workId) ?? []) {
      comments.push({ by: e.actorHatId ?? "organization", text: e.decision, atMs: e.atMs, about: "refused" });
    }
    // ACTION ITEMS: what happened to the change after it was handed to people - a reviewer's comment,
    // the request updated, its target moving ahead - and whether the organization has dealt with it.
    // Shown with their ids, because deciding about one means naming it.
    const items = actionItems.get(node.workId) ?? [];
    for (const i of items) {
      comments.push({
        by: i.author ?? i.source,
        text:
          `[${i.actionItemId}] ${i.itemKind}: ${i.summary}` +
          (i.settled !== undefined
            ? ` - ${i.settled.outcome}: ${i.settled.how}` +
              (i.answered === undefined
                ? ""
                : i.answered.skipped !== undefined
                  ? ` [not answered on the thread: ${i.answered.skipped}]`
                  : ` [answered on the thread${i.answered.resolved ? ", resolved" : ""}]`)
            : i.deferred !== undefined
              ? ` - OPEN, left open by ${i.deferred.byHatId ?? "the organization"}: ${i.deferred.why}`
              : i.reopened !== undefined
                ? ` - OPEN, REOPENED: ${i.reopened.why}`
                : " - OPEN") +
          (i.url === undefined ? "" : ` (${i.url})`),
        atMs: i.raisedAtMs,
        about: "action item",
      });
    }
    comments.sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0));

    const ticket = node.requestRef === undefined ? undefined : parseRequestRef(node.requestRef);
    const change = folded.changes.get(node.workId);
    const where = [
      ...(ticket === undefined ? [] : [`ticket ${ticket.source}:${ticket.externalId}`]),
      ...(change === undefined ? [] : [`branch ${change.branch}`]),
      ...(change?.workdir === undefined ? [] : [`checkout ${change.workdir}`]),
      ...(change?.url === undefined ? [] : [`change ${change.url}`]),
      // IN FRONT OF PEOPLE: handed off for review, and the next act is theirs, not the organization's.
      ...((h) => (h === undefined ? [] : [`awaiting human review at ${h.url ?? `branch ${h.branch}`} - nothing was merged`]))(
        handedOff.get(node.workId),
      ),
      ...((open) => (open === 0 ? [] : [`${String(open)} open action item(s) on this change - see its comments`]))(
        (actionItems.get(node.workId) ?? []).filter((i) => i.settled === undefined).length,
      ),
    ];
    const kids = childrenOf(folded.cascade, node.workId).map((c: CascadeNode) => c.workId);
    return {
      id: node.workId,
      title: node.title,
      status: String(node.state),
      kind: String(node.workType),
      ...(node.brief === undefined ? {} : { description: node.brief }),
      ...(where.length === 0 ? {} : { where }),
      ...(node.parentWorkId === undefined ? {} : { parentId: node.parentWorkId }),
      ...(kids.length === 0 ? {} : { childIds: kids }),
      ...(node.dependsOn === undefined || node.dependsOn.length === 0 ? {} : { dependsOn: node.dependsOn }),
      holderId: node.assigneeHatId ?? node.ownerHatId,
      steps,
      attachments,
      comments,
    };
  });
}

/** The ids a hat HOLDS: assigned to it, owned by it while open, or with a review waiting on it. */
export function holdingOf(nodes: readonly CascadeNode[], hatId: string, asked: readonly string[]): readonly string[] {
  const open = (n: CascadeNode): boolean => n.state !== WorkState.Done && n.state !== WorkState.Canceled;
  return [
    ...new Set([
      ...nodes.filter((n) => n.assigneeHatId === hatId && open(n)).map((n) => n.workId),
      ...nodes.filter((n) => n.assigneeHatId === undefined && n.ownerHatId === hatId && open(n)).map((n) => n.workId),
      ...asked.filter((id) => nodes.some((n) => n.workId === id)),
    ]),
  ];
}

/** A hat's whole World, from the log. */
export function worldFor(input: {
  readonly events: readonly OrgEvent[];
  readonly hatId: string;
  readonly actions: readonly HumanAction[];
  /** The blocker outbox, so an item shows the questions it raised and what the person answered. */
  readonly blockers?: readonly RaisedBlocker[];
  readonly resourceAuthorityHatId?: string;
  readonly nowMs?: number;
  readonly runs?: number;
}): { readonly world: World; readonly items: readonly ItemContext[] } {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  const folded = foldOrganization(input.events);
  const nowMs = input.nowMs ?? (input.events.length === 0 ? 0 : Math.max(...input.events.map((e) => e.atMs)));
  const view = viewOf(input.events, input.runs ?? 0, nowMs, { actions: input.actions });
  const surface = orgSurfaceFor(
    {
      chart: built.chart,
      board: foldBoard(input.events),
      signals: foldSupervisorSignals(input.events),
      cascade: folded.cascade.nodes,
      artifacts: new Map(),
      raisedBlockers: folded.blockers,
      humanActions: input.actions,
    },
    input.hatId,
    input.resourceAuthorityHatId ?? "rmo_office",
  );
  const items = itemContextsFrom(input.events, folded, view.work, input.actions, built.chart, input.blockers ?? []);
  const holding = holdingOf(folded.cascade.nodes, input.hatId, (surface.reviewsAsked ?? []).map((r) => r.artifactId));
  // THE WORK THIS HAT HOLDS IS ITS BACKLOG. Ready when everything it waits on is done — the same
  // `dependsOn` edge the runtime holds work on, read here rather than restated.
  const done = new Set(folded.cascade.nodes.filter((n) => n.state === WorkState.Done).map((n) => n.workId));
  const backlog: BacklogItem[] = holding
    .map((id) => nodeById(folded.cascade, id))
    .filter((n): n is CascadeNode => n !== undefined && isLeafType(n.workType))
    .map((n) => ({ id: n.workId, title: n.title, ready: (n.dependsOn ?? []).every((d) => done.has(d)), ambiguous: false }));
  return { world: { backlog, ...surface, items, holding }, items };
}

/**
 * How an agent reaches each part of the surface — as the command it should run.
 *
 * The prefix comes from `ORG_OBSERVE_CMD` when the organization set one for its agents, so the page
 * tells an agent exactly what to type; otherwise from how this process was invoked.
 */
export function navigationFor(prefix: string, hatId: string): Navigation {
  const q = (v: string): string => (/^[A-Za-z0-9_.:@\/-]+$/.test(v) ? v : JSON.stringify(v));
  const base = `${prefix} --hat ${q(hatId)}`;
  return {
    dashboard: `${base} dashboard`,
    item: (id) => `${base} item ${id === "<id>" ? id : q(id)}`,
    attachment: (id, ref) => `${base} attachment ${id === "<id>" ? id : q(id)} ${ref === "<ref>" ? ref : q(ref)}`,
    more: [{ what: "every action open to you", how: `${base} menu` }],
  };
}

/**
 * Print one attachment — but ONLY one the record lists on that item.
 *
 * A path argument is untrusted input: without this check the command would read any file its caller
 * named, and "look at what the organization recorded" would become "read the disk".
 */
export function readAttachment(items: readonly ItemContext[], workId: string, ref: string): { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: string } {
  const item = items.find((i) => i.id === workId);
  if (item === undefined) return { ok: false, reason: `no work item '${workId}'` };
  // THE NAME AS SHOWN, OR AS SHORTENED. An opened item lists its attachments under a common root,
  // said once, so what an agent copies back is the tail - and a lookup that only accepts the whole
  // path would refuse the name it was just shown. An ambiguous tail is refused, never guessed.
  const exact = item.attachments.find((a) => a.ref === ref);
  const tails = exact !== undefined ? [exact] : item.attachments.filter((a) => a.ref.endsWith(ref));
  const listed = tails.length === 1 ? tails[0] : undefined;
  if (listed === undefined) {
    const why = tails.length > 1 ? `names ${String(tails.length)} of ${workId}'s attachments` : `is not attached to ${workId}`;
    return { ok: false, reason: `'${ref}' ${why} — it has: ${item.attachments.map((a) => a.ref).join(", ") || "nothing"}` };
  }
  const at = resolve(listed.ref);
  // READ, THEN INTERPRET — never `existsSync`/`statSync` and then read
  // (`js/file-system-race`, CWE-367). The file can change between the question
  // and the answer, and the check was redundant anyway: the read itself reports
  // both conditions the guard was testing, and reports them more precisely than
  // a boolean can. EISDIR is what "not a file" actually looks like from a read.
  let text: string;
  try {
    text = readFileSync(at, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    const why =
      code === "ENOENT" ? "is recorded but no longer on disk"
      : code === "EISDIR" ? "is a directory, not a document"
      : code === "EACCES" || code === "EPERM" ? "is not readable"
      : "could not be read";
    return { ok: false, reason: `'${ref}' ${why} on ${workId} (it may be a reference rather than a document)` };
  }
  return {
    ok: true,
    text: text.length <= ATTACHMENT_LIMIT ? text : `${text.slice(0, ATTACHMENT_LIMIT)}\n\n… ${String(text.length - ATTACHMENT_LIMIT)} more characters in ${at}`,
  };
}

function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

export async function main(argv: readonly string[], print: (s: string) => void = (s) => console.log(s)): Promise<number> {
  const store = valueAfter(argv, "--store");
  const hatId = valueAfter(argv, "--hat");
  if (store === undefined || hatId === undefined) {
    print("usage: observe-cli.ts --store <dir> --hat <hatId> [--actions <dir>] [--blockers <dir>] [--json] <dashboard | item <workId> | attachment <workId> <ref> | menu>");
    return 2;
  }
  const flagsWithValues = new Set(["--store", "--hat", "--actions", "--blockers"]);
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (flagsWithValues.has(a)) { i++; continue; }
    if (a.startsWith("--")) continue;
    positional.push(a);
  }
  const [command = "dashboard", ...rest] = positional;
  const actionsDir = valueAfter(argv, "--actions");
  const actions = actionsDir === undefined ? [] : readActions(actionsDir);
  const events = readEvents(store);
  const blockersDir = valueAfter(argv, "--blockers");
  const { world, items } = worldFor({
    events,
    hatId,
    actions,
    runs: readRuns(store).length,
    ...(blockersDir === undefined ? {} : { blockers: readBlockers(blockersDir) }),
  });
  const nav = navigationFor(process.env["ORG_OBSERVE_CMD"] ?? `bun ${JSON.stringify(resolve(import.meta.dir, "observe-cli.ts"))} --store ${JSON.stringify(store)}`, hatId);
  const json = argv.includes("--json");

  switch (command) {
    case "dashboard":
      print(json ? JSON.stringify({ hatId, holding: world.holding, inbox: { reviewsAsked: world.reviewsAsked, deliberations: world.deliberations, missing: world.missing }, unresolvable: world.unresolvable, menu: buildMenu(world) }, null, 2) : renderDashboard(world, hatId, nav));
      return 0;
    case "item": {
      const id = rest[0];
      const item = items.find((i) => i.id === id);
      if (id === undefined || item === undefined) {
        print(`no work item '${id ?? ""}'. Items: ${items.map((i) => i.id).join(", ") || "none"}`);
        return 1;
      }
      const wants = ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(argv[argv.indexOf("--passage") + 1]);
      print(
        json
          ? JSON.stringify(item, null, 2)
          : renderItem(item, nav, {
              full: argv.includes("--full"),
              ...(argv.includes("--passage") && wants !== undefined && Number.isFinite(wants) ? { passage: wants } : {}),
            }),
      );
      return 0;
    }
    case "attachment": {
      const [id, ref] = rest;
      if (id === undefined || ref === undefined) {
        print("attachment needs <workId> <ref>");
        return 2;
      }
      const got = readAttachment(items, id, ref);
      print(got.ok ? got.text : got.reason);
      return got.ok ? 0 : 1;
    }
    case "menu":
      for (const a of buildMenu(world)) print(renderAction(a, world.methods));
      return 0;
    default:
      print(`unknown command '${command}' — dashboard | item <workId> | attachment <workId> <ref> | menu`);
      return 2;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
