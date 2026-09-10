/**
 * corporate/study-topics.ts — what to study, drawn from the org's own sources.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `subjectFor` picks from a hardcoded table and rotates by cycle. Its fallback is the string
 * *"the part of this repository this hat touches"* — which is not a subject, it is a description of
 * one. A hat handed that has been told to go and study something unnamed, and whatever it then
 * writes into memory is an opinion formed from its own recollection rather than from a document a
 * second party could also read. That is the same failure `BusinessContextGrooming` exists to
 * prevent, occurring on the study path where no gate is watching.
 *
 * ── A TOPIC NAMES A DOCUMENT ─────────────────────────────────────────────────
 * Every topic here carries a `sourceRef` — a real `<source>:<revision>:<path>` from a
 * `DataSourcePort`. So a study session reads something that exists, and the memory it produces can
 * cite where it came from. A topic that cannot name a document is not produced.
 *
 * ── AIMED AT WHERE CONTEXT IS ACTUALLY MISSING ───────────────────────────────
 * The ranking is the point. Study time is scarce now that it is budgeted, so spending it on
 * whatever sorts first would waste the budget the sessions module just imposed. Three signals, in
 * order of how much they say about a real gap:
 *
 *   1. REWORK — the org keeps failing a gate on this area. Nothing evidences a missing
 *      understanding better than having got it wrong and been sent back.
 *   2. RELEVANCE — the document is in the hat's own domain. Studying a neighbour's area is not
 *      useless, it is just less useful than studying your own.
 *   3. NOVELTY — nothing in memory covers it yet. Re-reading what the hat already knows produces a
 *      reinforcement, not a new capability, and reinforcement is what delivering work is for.
 *
 * The third is a SUBTRACTION rather than a filter: a known document with active rework beats an
 * unknown one nobody has struggled with, because the evidence of a gap outweighs the presumption of
 * one. Filtering known documents out entirely would make the org unable to re-learn something it
 * had recorded wrongly.
 */

import type { GateStep } from "./gate-demand";
import type { SourceDocument } from "./providers";

/** Something worth spending a bounded study session on. */
export interface StudyTopic {
  /** What the hat will look at, in words. */
  readonly subject: string;
  /** The citable document reference — what it will actually read. */
  readonly sourceRef: string;
  /** The document's path within its source, for the memory key. */
  readonly path: string;
  /** Why this is worth an hour, in a sentence a manager could read. */
  readonly because: string;
  /** Higher is more worth studying. Derived; never set by a caller. */
  readonly weight: number;
}

/** How much each signal is worth. Exported so the weighting is inspectable, not buried. */
export const TOPIC_WEIGHTS = {
  /** Per rework attempt touching this area. The strongest evidence of a real gap. */
  rework: 3,
  /** The document sits in the hat's own domain. */
  relevance: 2,
  /** Nothing in memory covers it yet. */
  novelty: 1,
} as const;

/**
 * The last path segment without its extension — the word a document is "about".
 *
 * Used for matching a document against a domain and against memory keys. Deliberately crude: a
 * cleverer extractor would be one more thing that can be subtly wrong, and the ranking only needs
 * to be better than a hardcoded rotation, which this already is.
 */
export function topicKeyOf(path: string): string {
  const last = path.split(/[/\\]/).filter((s) => s !== "").pop() ?? path;
  const dot = last.lastIndexOf(".");
  return (dot > 0 ? last.slice(0, dot) : last).toLowerCase();
}

function mentions(haystack: string, needle: string): boolean {
  if (needle === "") return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export interface TopicInput {
  /** What the source holds, already read. This module performs no I/O. */
  readonly documents: readonly SourceDocument[];
  /** The hat the topics are for. */
  readonly hatId: string;
  /** Its domain or department, when the chart says. Drives the relevance signal. */
  readonly domain?: string;
  /**
   * Memory keys this hat already holds — `topicKeyOf` values it has written before.
   *
   * Supplied by the caller from the memory store rather than read here, because "what does this hat
   * know" is a question about the store and this module is the ranking.
   */
  readonly known?: ReadonlySet<string>;
  /**
   * Gate steps currently in rework, from `gateDemand`. Where the org keeps being sent back.
   */
  readonly rework?: readonly GateStep[];
  /** Cap on how many topics come back. */
  readonly limit?: number;
}

/**
 * Rank what this hat could usefully study, best first.
 *
 * Returns an EMPTY LIST when the source has nothing — never a placeholder subject. An organization
 * whose sources hold no documents has nothing to study, and saying so lets the caller skip the
 * session instead of booking an hour against a string.
 */
export function topicsFor(input: TopicInput): readonly StudyTopic[] {
  const known = input.known ?? new Set<string>();
  const rework = input.rework ?? [];
  const out: StudyTopic[] = [];

  for (const doc of input.documents) {
    const key = topicKeyOf(doc.path);
    if (key === "") continue;

    const reasons: string[] = [];
    let weight = 0;

    // 1. REWORK. A gate that keeps coming back on work whose title or id mentions this document's
    // subject is the clearest evidence the org does not understand this area well enough.
    const failing = rework.filter((s) => mentions(s.title, key) || mentions(s.workId, key));
    if (failing.length > 0) {
      weight += TOPIC_WEIGHTS.rework * failing.length;
      const first = failing[0];
      reasons.push(
        `${String(failing.length)} item(s) are in rework here` +
          (first === undefined ? "" : `, e.g. ${first.workId} at '${first.gate}'`),
      );
    }

    // 2. RELEVANCE.
    if (input.domain !== undefined && input.domain !== "" && mentions(doc.path, input.domain)) {
      weight += TOPIC_WEIGHTS.relevance;
      reasons.push(`it is in ${input.domain}`);
    }

    // 3. NOVELTY.
    if (!known.has(key)) {
      weight += TOPIC_WEIGHTS.novelty;
      reasons.push("nothing in memory covers it yet");
    }

    if (weight === 0) continue;

    out.push({
      subject: doc.path,
      sourceRef: doc.ref,
      path: doc.path,
      because: reasons.join("; "),
      weight,
    });
  }

  // Ties broken by path so the same sources rank the same way twice — a study plan that reshuffled
  // between runs would make the org's own reading list unreplayable.
  out.sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));
  return input.limit === undefined ? out : out.slice(0, input.limit);
}

/** The single best topic, or `undefined` when there is genuinely nothing worth reading. */
export function bestTopic(input: TopicInput): StudyTopic | undefined {
  return topicsFor({ ...input, limit: 1 })[0];
}

/**
 * The memory key a study session on this topic writes to.
 *
 * Stable for a given topic, so studying the same document twice REINFORCES one memory rather than
 * accumulating near-duplicates — the same property `memoryId` relies on, applied to the study path.
 */
export function memoryKeyFor(topic: StudyTopic): string {
  return `study:${topicKeyOf(topic.path)}`;
}
