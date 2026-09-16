/**
 * corporate/ticket-report.ts — the ticket hears about the work, at the moments that are real progress.
 *
 * MEASURED on the Agentic Team, 2026-09-11..14: an organization ran for hours on AIAGENT-1658, 1659,
 * 1660-1662, decided an architecture, wrote an implementation, reproduced a defect, ran QA and opened
 * a merge request - and the Jira ticket said nothing the whole time. Every trace of that work lived
 * in the organization's own store and in GitLab. A person watching the tracker, which is where people
 * actually watch, could not tell the work from work nobody had started.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 * When a gate the organization calls a MILESTONE passes, the ticket gets one short comment: what will
 * be done, what was done, where the work stands, and the merge request if one is open. Milestones are
 * named by the operator (`milestones`), never by this file - an organization whose gates are
 * architecture, implementation and QA says so; one with different gates says something else.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 * Not a log of every verdict. MEASURED on the FlowDent store: 349 verdicts, 290 of them rejections
 * (83%), one gate rejecting a single item 81 times. A comment per verdict would bury the ticket in
 * the organization's own deliberation, which is what the review loop is FOR - it iterates until the
 * work comes back clean, and only the clean result is news to anybody outside. So a milestone reports
 * when it PASSES, once, and a turn-back stays inside the loop.
 *
 * ── WHICH TRACKER ────────────────────────────────────────────────────────────
 * Whichever one the work came from. Intake mints `requestRef` as `<source>|<externalId>`, so a Jira
 * item reports to Jira and a Linear item to Linear with nothing configured; `tracker` overrides that
 * for an organization that reads from one place and reports to another. Nothing here speaks either
 * protocol: the posting is a command seam, exactly like opening a merge request.
 */

import type { PracticeCheck } from "./practice";
import { stringCompare } from "../collation/collation.ts";

/** A gate whose passing this organization treats as progress worth telling the ticket about. */
export interface TicketReportConfig {
  /**
   * Gate kinds that are milestones here, in the operator's words - e.g. architecture_approval,
   * implementation_review, qa_uat. Empty is not "none": an organization that wants no ticket
   * updates states no `ticketReports` at all.
   */
  readonly milestones: readonly string[];
  /**
   * Where to write, when the work item's own source is not the answer. Absent means the item
   * decides, which is what an organization reading and reporting in one place wants.
   */
  readonly tracker?: string;
  /** Why this organization tells its tickets these things. A convention with no reason is followed until it is wrong. */
  readonly why: string;
}

/** Refuse a configuration that cannot mean what it says. `knownGates` is the roster it must name from. */
export function validateTicketReports(c: TicketReportConfig, knownGates: readonly string[]): PracticeCheck {
  if (c.milestones.length === 0) {
    return {
      ok: false,
      reason: "no gate is named a milestone, so nothing would ever reach the ticket: name the gates whose passing is progress, or do not configure ticket reports at all",
    };
  }
  const seen = new Set<string>();
  for (const gate of c.milestones) {
    const name = gate.trim();
    if (name === "") return { ok: false, reason: "a milestone with an empty name matches no gate and would never fire" };
    // A TYPO IS THE VACUITY CLASS. 'architecture-approval' looks configured and reports nothing
    // forever, so an unknown gate is refused rather than carried.
    if (!knownGates.includes(name)) {
      return { ok: false, reason: `'${name}' is not a gate this organization has - known: ${knownGates.join(", ")}` };
    }
    if (seen.has(name)) return { ok: false, reason: `'${name}' is named a milestone twice, which cannot mean anything more than once` };
    seen.add(name);
  }
  if (c.tracker !== undefined && c.tracker.trim() === "") {
    return { ok: false, reason: "'tracker' is present and empty - either name the tracker to report to, or leave it out so the work item's own source decides" };
  }
  if (c.why.trim() === "") return { ok: false, reason: "say why this organization reports these milestones to its tickets" };
  return { ok: true };
}

/** One passing verdict, as the fold hands it over. */
export interface MilestoneVerdict {
  readonly workId: string;
  readonly gate: string;
  readonly outcome: string;
  readonly atMs: number;
  readonly byHatId?: string;
  readonly reason?: string;
}

/** A milestone that passed and has not been told to the ticket yet. */
export interface MilestoneOwed {
  readonly workId: string;
  readonly gate: string;
  readonly atMs: number;
  readonly byHatId?: string;
  /** What the gate said when it passed - the organization's own words, carried to the composer. */
  readonly reason?: string;
}

export interface OwedInput {
  /** Every gate verdict recorded so far, in any order (`foldGateEvaluations`). */
  readonly verdicts: readonly MilestoneVerdict[];
  /** What has already been told to each ticket: work id -> gates reported (`foldTicketReports`). */
  readonly reported: ReadonlyMap<string, ReadonlySet<string>>;
  readonly milestones: readonly string[];
  /** Outcomes that count as passing. Stated by the caller so this file judges nothing. */
  readonly passing: readonly string[];
}

/**
 * Which milestones owe the ticket an update. Pure: everything it reads is handed in.
 *
 * Oldest first, so a ticket reads in the order the work happened - a run that reports three gates at
 * once must not tell the reader QA finished before the architecture was decided. A gate that passed
 * more than once (a reopen, a second pass) is owed ONE update, at its earliest pass, because the
 * report is "this milestone is behind us" and that becomes true once.
 */
export function milestonesOwed(input: OwedInput): readonly MilestoneOwed[] {
  const wanted = new Set(input.milestones);
  const passes = new Set(input.passing);
  const earliest = new Map<string, MilestoneOwed>();
  for (const v of input.verdicts) {
    if (!wanted.has(v.gate) || !passes.has(v.outcome)) continue;
    if (input.reported.get(v.workId)?.has(v.gate) === true) continue;
    const key = `${v.workId}|${v.gate}`;
    const held = earliest.get(key);
    if (held !== undefined && held.atMs <= v.atMs) continue;
    earliest.set(key, {
      workId: v.workId,
      gate: v.gate,
      atMs: v.atMs,
      ...(v.byHatId === undefined ? {} : { byHatId: v.byHatId }),
      ...(v.reason === undefined ? {} : { reason: v.reason }),
    });
  }
  // ORDINAL, NOT LINGUISTIC. `localeCompare` orders by ICU collation, which is locale- and
  // ICU-version dependent — two machines can disagree on the same two work ids, so the tie-break
  // is not stable and DST replay / the N-oracle byte-lock diverge on it. `stringCompare` is this
  // repo's canonical codepoint ordering, already imported by portal-view.ts and room-store.ts.
  // Rule: .claude/rules/culture-invariant-by-default.md.
  return [...earliest.values()].sort((a, b) => (a.atMs === b.atMs ? stringCompare(a.workId, b.workId) : a.atMs - b.atMs));
}

/** What the composer is asked, when a milestone owes the ticket an update. */
export interface TicketUpdateRequest {
  readonly workId: string;
  /** The ticket as people know it - e.g. AIAGENT-1658. */
  readonly ticket: string;
  readonly gate: string;
  /** What the gate said when it passed. */
  readonly gateReason?: string;
  /** The work item's own title, so the update can name what it is about. */
  readonly title?: string;
  /** The merge request, when one is open for this work. */
  readonly changeUrl?: string;
  readonly branch?: string;
  /** Where the work's evidence and step documents live, for an agent that wants to read them. */
  readonly workdir?: string;
}

/**
 * The update itself. Three lists and a line, because that is what a person scanning a ticket needs:
 * what is coming, what landed, and whether it is moving.
 */
export interface TicketUpdate {
  /** What the organization will do next. Empty when this milestone is the end of the work. */
  readonly willDo: readonly string[];
  /** What it actually did to get here. */
  readonly done: readonly string[];
  /** Where the work stands, in one line. */
  readonly status: string;
}

/** A tracker comment, addressed. The seam that posts it decides how to speak to its tracker. */
export interface TicketCommentRequest {
  readonly workId: string;
  readonly ticket: string;
  /** Which tracker - the work item's source, or the organization's override. */
  readonly tracker: string;
  readonly gate: string;
  readonly body: string;
}

const NL = String.fromCharCode(10);
const bullets = (lines: readonly string[]): string => lines.map((l) => `- ${l.split(/\s+/).join(" ").trim()}`).join(NL);

/**
 * The comment a person reads. Deterministic: the composer supplies the words, this decides the shape,
 * so every update on every ticket reads the same way and a reader learns where to look once.
 *
 * The merge request is appended by the ORGANIZATION, not by the composer - a link is a fact it holds
 * and the agent would only be repeating it, which is the class of claim that has been wrong before.
 */
export function renderTicketComment(gate: string, update: TicketUpdate, change?: { readonly url?: string; readonly branch?: string }): string {
  const out: string[] = [`**${gate.split("_").join(" ")} — done**`, ""];
  if (update.done.length > 0) out.push("What was done", bullets(update.done), "");
  if (update.willDo.length > 0) out.push("What happens next", bullets(update.willDo), "");
  out.push(`Status: ${update.status.split(/\s+/).join(" ").trim()}`);
  if (change?.url !== undefined && change.url.trim() !== "") {
    out.push("", `Merge request: ${change.url}${change.branch === undefined ? "" : ` (\`${change.branch}\`)`}`);
  } else if (change?.branch !== undefined && change.branch.trim() !== "") {
    out.push("", `Branch: \`${change.branch}\` — no merge request open yet.`);
  }
  return out.join(NL);
}

/** An update with nothing in it is not an update. Refused before it is posted, never posted empty. */
export function updateIsEmpty(update: TicketUpdate): boolean {
  return update.done.length === 0 && update.willDo.length === 0 && update.status.trim() === "";
}
