/**
 * corporate/change-request.ts — how this organization puts a finished change in front of people.
 *
 * ── WHY THIS IS CONFIGURATION, AND WHY IT IS REQUIRED ────────────────────────
 * An organization whose delivery is `human_review` ends every piece of work as a merge request, and
 * three things about that request are the operator's to decide, never the register's:
 *
 *   - WHAT IT SAYS. The first three requests this organization opened described themselves as a
 *     list of gate verdicts; the operator wanted the problem, whether it reproduced (and if not what
 *     gave it away), the root cause, the resolution and how the fix was confirmed. Nobody can guess a
 *     team's review conventions, so the SECTIONS are data: a heading and what it must state.
 *   - WHAT IT MUST NOT CARRY. The organization's evidence (screenshots, step documents) belongs to
 *     the organization. MEASURED on those same requests: a committed UAT screenshot and a committed
 *     step document. `keepOut` names what a change may never add, and the handoff refuses one that does.
 *   - HOW IT STAYS CURRENT. A request that falls behind its target is work waiting on somebody.
 *     Whether the organization brings it up to date, and how, rewrites a branch people are reviewing —
 *     so it is chosen, never assumed.
 *   - HOW IT ANSWERS. A reviewer who comments is owed an answer where they asked: what was changed
 *     and in which commit, or why nothing was. Whether the organization replies, and whether it also
 *     resolves the thread, speaks in the operator's name on somebody else's conversation — chosen.
 *
 * Required for exactly the organizations that hand work to people: `org configure` asks it, and a run
 * that would open a request without it is refused before it starts, rather than hours later when the
 * first change finishes.
 *
 * ── THE GRAMMAR HOLDS NO OPINION ─────────────────────────────────────────────
 * No section names live here. `validateChangeRequests` checks that a configuration can mean what it
 * says; `missingSections` checks a description against whatever was configured. What a good merge
 * request contains is the organization's statement, in its own words.
 */

import type { PracticeCheck } from "./practice";

/**
 * How a handed-off change is kept current with the branch it targets.
 *
 * A CLOSED SET, like every setting: an unknown method would be stored, listed, and govern nothing.
 * Rebasing is deliberately absent: it rewrites a branch under review and needs a force-push, which no
 * organization is authorized to do on its own.
 */
export const SyncMethod = {
  /** Merge the target into the change's branch and push normally. No history is rewritten. */
  MergeTarget: "merge_target",
  /** Only record that the change has fallen behind; the organization decides whether to act. */
  FlagOnly: "flag_only",
} as const;
export type SyncMethod = (typeof SyncMethod)[keyof typeof SyncMethod];

export function isSyncMethod(value: string): value is SyncMethod {
  return (Object.values(SyncMethod) as readonly string[]).includes(value);
}

/**
 * What the organization does on a reviewer's comment once it has decided about it.
 *
 * A CLOSED SET. Answering speaks on a reviewer's thread in the operator's name, and resolving closes
 * a conversation a person opened - both are the operator's call, never the register's default.
 */
export const ReplyPolicy = {
  /** Reply on the thread with what was done (or why not), then resolve it. */
  ReplyAndResolve: "reply_and_resolve",
  /** Reply on the thread; leave resolving to the people reviewing. */
  Reply: "reply",
  /** Say nothing on the thread: the decision stays in the organization's record only. */
  None: "none",
} as const;
export type ReplyPolicy = (typeof ReplyPolicy)[keyof typeof ReplyPolicy];

export function isReplyPolicy(value: string): value is ReplyPolicy {
  return (Object.values(ReplyPolicy) as readonly string[]).includes(value);
}

/**
 * Something the organization does ONCE, right after it opens a merge request - the project's own
 * convention for what follows an MR, never the register's. The example that asked for it: this
 * organization's reviewers are an AI review that runs when somebody comments `aireview`, so every
 * request it opens should get that comment, and what the review then says arrives as feedback like any
 * other comment. A CLOSED SET of kinds: a step kind nothing performs would be stored and do nothing.
 */
export const AfterOpenKind = {
  /** Post this comment on the request. */
  Comment: "comment",
} as const;
export type AfterOpenKind = (typeof AfterOpenKind)[keyof typeof AfterOpenKind];

export interface AfterOpenStep {
  readonly kind: AfterOpenKind;
  /** For `comment`: the comment's text, exactly as posted. */
  readonly body: string;
}

/** Re-reviews requested on one request before a person decides, when the organization has not said. */
export const DEFAULT_REVIEW_ROUNDS = 10;

/** A step's identity: the same step is performed once per request, and a changed step is a new one. */
export const afterOpenKey = (s: AfterOpenStep): string => `${s.kind}:${s.body.trim()}`;

/** One section a merge request's description must carry. */
export interface ChangeRequestSection {
  /** The heading as a reviewer sees it — `## <heading>` in the description. */
  readonly heading: string;
  /** What the section must state, in the organization's words. The author reads this; the reviewer never does. */
  readonly states: string;
}

export interface ChangeRequestConfig {
  /** In order. Every one must appear in every description the organization writes. */
  readonly sections: readonly ChangeRequestSection[];
  /**
   * Paths a change may never add — globs, `**` for any depth, `*` within one segment. A pattern with
   * no slash matches a file name anywhere. Empty is a real answer: the organization keeps nothing out.
   */
  readonly keepOut: readonly string[];
  readonly sync: SyncMethod;
  /**
   * Whether a reviewer's comment is answered on its thread once decided, and whether the thread is
   * resolved. REQUIRED where it is asked (`org change-requests set`, `org configure`, `run-org`);
   * absent only on a statement made before it was asked, which reads as NOT YET STATED - never as
   * `none`, and never as a reason to refuse the whole registry.
   */
  readonly replies?: ReplyPolicy;
  /**
   * What the organization does once each request is open, in order. REQUIRED where it is asked, like
   * `replies`: an empty list is a real answer ("nothing"), absent means NOT YET STATED.
   */
  readonly afterOpen?: readonly AfterOpenStep[];
  /**
   * What the organization does after EACH push of a follow-up that changed the code - e.g. comment
   * `aireview` again, so the reviewer reviews the fix. With it, review is a back-and-forth that runs
   * until a round raises nothing new. REQUIRED where asked, like `afterOpen`; empty is "nothing".
   */
  readonly afterUpdate?: readonly AfterOpenStep[];
  /**
   * At most this many re-reviews are requested on one request before a person is asked to decide -
   * a guard against two agents disagreeing forever, never a quiet stop. Default 10.
   */
  readonly reviewRounds?: number;
  /** Why merge requests are written this way here. A convention with no reason is followed until it is wrong. */
  readonly why: string;
}

const HEADING_RE = /^[^\n#][^\n]{0,79}$/;

/** Refuse a configuration that cannot mean what it says. */
export function validateChangeRequests(c: ChangeRequestConfig): PracticeCheck {
  if (c.sections.length === 0) {
    return {
      ok: false,
      reason: "a merge request with no required sections is a title and a diff: name at least one section it must carry",
    };
  }
  const seen = new Set<string>();
  for (const s of c.sections) {
    const heading = s.heading.trim();
    if (!HEADING_RE.test(heading)) {
      return { ok: false, reason: `'${s.heading}' is not a usable heading: one line, up to 80 characters, not starting with '#'` };
    }
    const key = heading.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `'${heading}' is required twice: a description cannot satisfy one heading twice` };
    seen.add(key);
    if (s.states.trim() === "") {
      return { ok: false, reason: `'${heading}' says nothing about what it must state, so no author can write it and no check can hold it` };
    }
  }
  for (const glob of c.keepOut) {
    if (glob.trim() === "" || glob.includes("\n")) return { ok: false, reason: `'${glob}' is not a usable path pattern` };
  }
  if (!isSyncMethod(c.sync)) {
    return { ok: false, reason: `'${String(c.sync)}' is not a way to keep a request current — known: ${Object.values(SyncMethod).join(", ")}` };
  }
  if (c.replies !== undefined && !isReplyPolicy(String(c.replies))) {
    return {
      ok: false,
      reason: `'${String(c.replies)}' is not a way to answer a reviewer's comment — known: ${Object.values(ReplyPolicy).join(", ")}`,
    };
  }
  if (c.reviewRounds !== undefined && (!Number.isInteger(c.reviewRounds) || c.reviewRounds < 1 || c.reviewRounds > 50)) {
    return { ok: false, reason: `reviewRounds must be a whole number from 1 to 50 - it is when a person is asked, not whether` };
  }
  for (const s of [...(c.afterOpen ?? []), ...(c.afterUpdate ?? [])]) {
    if (!(Object.values(AfterOpenKind) as readonly string[]).includes(String(s.kind))) {
      return { ok: false, reason: `'${String(s.kind)}' is not something the organization can do after opening a request — known: ${Object.values(AfterOpenKind).join(", ")}` };
    }
    if (typeof s.body !== "string" || s.body.trim() === "" || s.body.length > 10_000) {
      return { ok: false, reason: `an after-open ${String(s.kind)} needs a body of 1 to 10000 characters` };
    }
  }
  if (c.why.trim() === "") {
    return { ok: false, reason: "merge requests were configured with no reason: say why they are written this way here" };
  }
  return { ok: true };
}

/**
 * The configured headings a description does not carry, in configured order.
 *
 * A heading counts only as a markdown heading line (`#`..`######` then the text), compared without
 * case or trailing punctuation — a word in a paragraph is not a section, and an author who wrote
 * "Root cause:" for "Root cause" has written the section.
 */
export function missingSections(description: string, sections: readonly ChangeRequestSection[]): readonly string[] {
  const norm = (t: string): string => t.trim().replace(/[\s:.-]+$/, "").toLowerCase();
  const present = new Set(
    description
      .split(/\r?\n/)
      .map((l) => /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(l)?.[1])
      .filter((h): h is string => h !== undefined)
      .map(norm),
  );
  return sections.map((s) => s.heading.trim()).filter((h) => !present.has(norm(h)));
}

/** Turn one glob into a matcher. `**` spans directories, `*` and `?` stay inside one segment. */
function globMatcher(glob: string): (path: string) => boolean {
  const g = glob.trim().split("\\").join("/").replace(/^\.\//, "");
  const anchoredToName = !g.includes("/");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const ch = g[i] as string;
    if (ch === "*") {
      if (g[i + 1] === "*") {
        const slashAfter = g[i + 2] === "/";
        re += slashAfter ? "(?:.*/)?" : ".*";
        i += slashAfter ? 2 : 1;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  const whole = new RegExp(`^${re}$`, "i");
  return (path: string): boolean => {
    const p = path.split("\\").join("/");
    return anchoredToName ? whole.test(p.slice(p.lastIndexOf("/") + 1)) : whole.test(p);
  };
}

/** The paths, among those a change adds, that the organization keeps out of its requests. */
export function keptOutPaths(paths: readonly string[], keepOut: readonly string[]): readonly string[] {
  const matchers = keepOut.map(globMatcher);
  return paths.filter((p) => matchers.some((m) => m(p)));
}

/**
 * What a description's author is told to write. Rendered, because the consumer is a prompt: the
 * headings are exact, and what each must state is the organization's own sentence.
 */
export function sectionsBrief(sections: readonly ChangeRequestSection[]): string {
  return sections.map((s) => `## ${s.heading.trim()}\n${s.states.trim()}`).join("\n\n");
}

/** What the author of a merge request's description is asked to write about. */
export interface DescribeRequest {
  readonly workId: string;
  /** The title the request will carry. */
  readonly title: string;
  readonly branch: string;
  readonly base?: string;
  /** The change's own checkout, where its diff can be read. */
  readonly workdir?: string;
  readonly sections: readonly ChangeRequestSection[];
  /**
   * Review items already settled on this change, and what the reviewer was (or will be) told. MEASURED
   * on MR !162: a reply said "the rollout note is now appended to the description", and the description
   * - rewritten from scratch on the re-handoff by an author who never saw that decision - had none.
   */
  readonly settled?: readonly { readonly summary: string; readonly outcome: string; readonly how: string }[];
}
