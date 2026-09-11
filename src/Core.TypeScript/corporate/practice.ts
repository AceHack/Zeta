/**
 * corporate/practice.ts — HOW THIS ORGANIZATION WORKS, as configuration rather than as code.
 *
 * ── WHAT WAS MISSING ─────────────────────────────────────────────────────────
 * The register could already say WHO does a thing (the chart), WHEN it must happen (the gate
 * chains), and WHICH ONE SKILL performs a gate (`org skill bind`). It could not say how the work is
 * DONE — the practice. Two organizations with identical charts and identical gates can hold
 * completely different beliefs about:
 *
 *   - whether a test is written before the code, and what a test has to prove
 *   - what a BRD contains and who it is written for
 *   - what happens when a defect is solved — a regression test, a post-mortem, a fix and nothing else
 *
 * None of that is expressible as one skill id per gate, and all of it differs between programs and
 * between the STAGES of one program. A greenfield spike and a regulated release do not run the same
 * process, and asking an operator to pick one for the whole organization is asking the wrong
 * question.
 *
 * ── THE SHAPE, AND WHY IT IS NOT THREE FIELDS ────────────────────────────────
 * A practice attaches, to a SUBJECT, an ORDERED list of skills and a DIRECTIVE in prose.
 *
 * Ordered, not `primary`/`secondary`/`tertiary`. Position IS the precedence, so an organization that
 * wants four is not blocked and one that wants one does not carry two empty fields. Three named
 * fields would also have made "what comes after tertiary" a schema change rather than a list entry.
 *
 * The DIRECTIVE is prose on purpose. "Every defect ships with a regression test that fails without
 * the fix" is not a skill id and cannot be compiled into one — it is the thing an agent has to READ.
 * A layer that only carried skill ids would force every process statement to be smuggled into a
 * skill nobody wrote, which is how configuration surfaces become fiction.
 *
 * ── THE SUBJECT USES VOCABULARIES THAT ALREADY EXIST ─────────────────────────
 * Three kinds, and not one of them is new: a GATE (`brd_approval`), a VERB as `observe` names it
 * (`draft_business_doc`), or a WORK TYPE (`defect`). Each is validated against the roster that
 * already defines it, so a typo is refused rather than stored as a practice nobody will ever match.
 *
 * A fourth, free-form kind was the obvious alternative and is the reason this is a closed set: an
 * unvalidated subject makes every misspelling a silently inert configuration, which is the defect
 * class this register spends most of its guards on.
 *
 * ── WHAT IS DATA, AND WHAT IS NOT ────────────────────────────────────────────
 * Everything here is data in the register: subjects, order, prose, scope. This module holds the
 * RESOLUTION RULE — nearest scope wins, then the register's default — and no opinions about what any
 * particular organization's process should be. The register's own defaults live in
 * `practice-defaults.ts`, in the same style and for the same reason as the method defaults: the
 * register may have an opinion about how its own gates are performed; the grammar may not have an
 * opinion about anything.
 */

import { ACTION_KINDS } from "../observe/action-reconciliation";
import { ancestorsOf } from "./branch-topology";
import type { Cascade } from "./goal-cascade";
import type { CascadeNode } from "./goal-cascade";
import { WorkType } from "./goal-cascade";
import { ORDERED_GATES } from "./quality-gate";
import { SkillSource, type SkillSource as SkillSourceT } from "./skill-binding";

/** What a practice governs. Each kind names a roster that already exists. */
export const PracticeSubjectKind = {
  /** A quality gate, as the gate chains name it. */
  Gate: "gate",
  /** An action an agent can choose, as `observe` names it. */
  Verb: "verb",
  /** A kind of work — what this organization does when it meets one. */
  WorkType: "work_type",
} as const;
export type PracticeSubjectKind = (typeof PracticeSubjectKind)[keyof typeof PracticeSubjectKind];

export interface PracticeSubject {
  readonly kind: PracticeSubjectKind;
  readonly id: string;
}

/**
 * One skill in a practice's chain, with where it comes from.
 *
 * The same three sources as a gate binding, deliberately: an operator who has learned that
 * `marketplace` needs a marketplace name should not learn a second rule here.
 */
export interface PracticeSkill {
  readonly skill: string;
  readonly source: SkillSourceT;
  readonly marketplace?: string;
}

export interface Practice {
  readonly subject: PracticeSubject;
  /**
   * The skills that perform this, IN ORDER. First is what to reach for; the rest are what to reach
   * for when it does not apply.
   *
   * MAY BE EMPTY, and an empty list with a directive is a real and common configuration: "this is
   * how we do it" often has no skill attached at all. What is refused is a practice that is empty in
   * BOTH halves, because that is a row that governs nothing.
   */
  readonly skills: readonly PracticeSkill[];
  /**
   * The process, in the organization's own words. What an agent reads before doing the thing.
   *
   * Optional only because a practice may be pure skill routing. When present it is the half that
   * cannot be expressed any other way.
   */
  readonly directive?: string;
  /**
   * Why this is the practice here — required, like a method's reason.
   *
   * An agent handed a process with no reason cannot tell whether it still applies to what it is
   * doing, so it follows it because it arrived. That is the difference between a practice and an
   * order, and this field is the whole of it.
   */
  readonly why: string;
  /**
   * DECLINED: this subject is deliberately left with no process.
   *
   * The third state, and it has to be a FIELD rather than a shape. A practice with no skills and
   * no directive is refused, because such a row reads in every listing exactly like process — and
   * a default that cannot be turned off is a mandate. Both are right, and inferring the difference
   * from emptiness cannot satisfy both, because an accidental empty and a deliberate decline look
   * identical. Declared, they do not: a reader of the registry file sees the decision, and
   * declining while also carrying a process becomes a contradiction this module can refuse.
   */
  readonly declined?: boolean;
  /**
   * Restrict to one work item and everything under it.
   *
   * THE POINT OF THE WHOLE LAYER, not a refinement of it: "different programs and different stages
   * of one program" is exactly this field. A pilot under an epic can run a lighter process than the
   * release beside it without a second configuration system.
   */
  readonly scopeWorkId?: string;
}

export type PracticeCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const SKILL_RE = /^[A-Za-z0-9][A-Za-z0-9 _.:/@-]{0,127}$/;

/** The ids a subject kind admits. Read from the rosters rather than restated. */
export function subjectRosterFor(kind: PracticeSubjectKind): readonly string[] {
  switch (kind) {
    case PracticeSubjectKind.Gate:
      return ORDERED_GATES.map((g) => String(g));
    case PracticeSubjectKind.Verb:
      return ACTION_KINDS;
    case PracticeSubjectKind.WorkType:
      return Object.values(WorkType).map((w) => String(w));
    default:
      // An exhaustive switch that still answers, because a new kind added without a roster must not
      // silently admit everything — an empty roster refuses every id, loudly, at the first bind.
      return [];
  }
}

/**
 * Refuse a practice that cannot mean what it says.
 *
 * Every refusal here is a row that would otherwise be STORED AND INERT — matched by nothing, shown
 * in listings as configuration, and blamed for behaviour it never governed.
 */
export function validatePractice(practice: Practice): PracticeCheck {
  const roster = subjectRosterFor(practice.subject.kind);
  if (roster.length === 0) {
    return { ok: false, reason: `'${String(practice.subject.kind)}' is not a subject kind this register knows` };
  }
  if (!roster.includes(practice.subject.id)) {
    return {
      ok: false,
      reason:
        `'${practice.subject.id}' is not a ${String(practice.subject.kind)} — ` +
        `known: ${roster.slice(0, 8).join(", ")}${roster.length > 8 ? ", …" : ""}`,
    };
  }
  if (practice.why.trim() === "") {
    return { ok: false, reason: "a practice with no reason is an instruction: say why it applies here" };
  }
  // A DECLINE IS THE ONE EMPTY ROW THAT IS ALLOWED, and only because it says so.
  if (practice.declined === true) {
    if (practice.skills.length > 0 || (practice.directive ?? "").trim() !== "") {
      return {
        ok: false,
        reason: "a declined practice cannot also carry a process: decline it or state it, not both",
      };
    }
    return { ok: true };
  }
  // GOVERNS SOMETHING. A practice with neither skills nor a directive is a row that changes nothing
  // and reads, in a listing, exactly like one that does.
  if (practice.skills.length === 0 && (practice.directive ?? "").trim() === "") {
    return {
      ok: false,
      reason:
        "a practice must carry at least one skill or a directive, or it governs nothing — use 'org practice unbind' to state that a subject has no process",
    };
  }
  const seen = new Set<string>();
  for (const entry of practice.skills) {
    if (!SKILL_RE.test(entry.skill)) {
      return { ok: false, reason: `'${entry.skill}' is not a usable skill id` };
    }
    // ORDER IS PRECEDENCE, so a repeat is a contradiction rather than a duplicate: the same skill
    // cannot be both first choice and third.
    if (seen.has(entry.skill)) {
      return { ok: false, reason: `'${entry.skill}' appears twice in one practice: order is precedence, so a repeat says two things` };
    }
    seen.add(entry.skill);
    if (entry.source === SkillSource.Marketplace && (entry.marketplace ?? "").trim() === "") {
      return { ok: false, reason: `'${entry.skill}' comes from a marketplace but names none, so nobody can fetch it` };
    }
  }
  return { ok: true };
}

/** Refuse a set that contradicts itself. */
export function validatePractices(practices: readonly Practice[]): PracticeCheck {
  const seen = new Set<string>();
  for (const p of practices) {
    const one = validatePractice(p);
    if (!one.ok) return one;
    // ONE PRACTICE PER SUBJECT PER SCOPE. Two would resolve by array order, which is a rule nobody
    // stated and nobody can see — the same reason gate bindings refuse a duplicate at one scope.
    const key = `${String(p.subject.kind)}|${p.subject.id}|${p.scopeWorkId ?? ""}`;
    if (seen.has(key)) {
      return {
        ok: false,
        reason:
          `'${p.subject.id}' already has a practice at ${p.scopeWorkId === undefined ? "organization scope" : `'${p.scopeWorkId}'`}` +
          `: replace it rather than adding a second`,
      };
    }
    seen.add(key);
  }
  return { ok: true };
}

/**
 * A standing instruction, true regardless of what is being done.
 *
 * ── WHY THIS IS NOT A PRACTICE WITH A WILDCARD SUBJECT ───────────────────────
 * "Prefer the skills the repository you are working in already provides" is not about a gate, a verb
 * or a kind of work — it is about how an agent should approach ALL of them. Expressed as a practice
 * it would have to be repeated on every subject, and would then be missing from whichever subject
 * nobody remembered, which is the worst of the three possible outcomes.
 *
 * Keyed by `id` so a later statement REPLACES an earlier one rather than accumulating: an
 * organization that changes its mind about a standing instruction has one instruction, not two that
 * disagree.
 */
export interface Directive {
  /** Short, stable name. What a listing shows and what a replacement matches on. */
  readonly id: string;
  /** The instruction itself, in the organization's own words. Empty means DECLINED. */
  readonly text: string;
  readonly why: string;
}

/**
 * The directives in force: the register's, as this organization has amended them.
 *
 * THREE STATES, and the third is the one that matters — the same argument as the method defaults. A
 * default that cannot be turned off is a mandate, and an operator who disagrees with a standing
 * instruction must be able to decline it rather than only replace it. A declined directive is one
 * whose text is empty, and it keeps its reason, because removing an instruction is a decision
 * somebody made.
 */
export function directivesInForce(
  own: readonly Directive[] | undefined,
  defaults: readonly Directive[],
): readonly { readonly directive: Directive; readonly byDefault: boolean }[] {
  const stated = new Map((own ?? []).map((d) => [d.id, d]));
  const out: { directive: Directive; byDefault: boolean }[] = [];

  for (const fallback of defaults) {
    const override = stated.get(fallback.id);
    if (override === undefined) {
      out.push({ directive: fallback, byDefault: true });
      continue;
    }
    stated.delete(fallback.id);
    if (override.text.trim() !== "") out.push({ directive: override, byDefault: false });
  }
  // Anything this organization said that the register has no opinion about, in the order stated.
  for (const extra of stated.values()) {
    if (extra.text.trim() !== "") out.push({ directive: extra, byDefault: false });
  }
  return out;
}

export function validateDirective(d: Directive): PracticeCheck {
  if (d.id.trim() === "") return { ok: false, reason: "a directive needs an id, or nothing can replace it" };
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(d.id)) {
    return { ok: false, reason: `'${d.id}' is not a usable directive id: lowercase letters, digits and dashes` };
  }
  if (d.why.trim() === "") {
    return { ok: false, reason: "a directive with no reason is an order: say why it holds here" };
  }
  return { ok: true };
}

/**
 * A knob the process turns at a decision the runtime makes mechanically.
 *
 * ── WHY THIS IS NOT A PRACTICE ───────────────────────────────────────────────
 * A practice is read by an AGENT — an ordered chain of skills and a sentence about how the work is
 * done. A setting is read by the RUNTIME, which cannot act on prose: "this epic gets no feature
 * branch" has to resolve to a value some code branches on.
 *
 * Kept in this module rather than in its own because it is the same configuration surface answering
 * the same question — *how does this organization work* — and the alternative is what the first
 * attempt at this actually did: a separate registry field, separate commands, and a separate path
 * into the runtime, for one boolean. The next knob would have needed its own again.
 */
export const ProcessSetting = {
  /**
   * Whether a collection of work carries an integration branch.
   *
   *   `collect` — a feature branch: its children merge into it, and it merges to the trunk once done.
   *   `direct`  — no branch: its children are cut from the trunk and merge back individually.
   *
   * UNSET is a third answer and the usual one: the shape decides, which is a collection of two or
   * more code-producing items. This setting exists because shape cannot tell a feature from a bucket.
   * Measured on the real AIAGENT project: `AIAGENT-796` ("Dev Portal: Stabilization") has 148
   * children spanning years of unrelated work, `AIAGENT-1519` has 12 that are one feature, and both
   * collect. What separates them is coherence, which no property of the cascade exposes.
   */
  IntegrationBranch: "integration_branch",
  /**
   * What happens to a defect that arrives with no reproduction.
   *
   *   `refuse`          — declined at intake, visibly. The register's original position.
   *   `reproduce_first` — admitted, with establishing a reproduction as the first obligation.
   *
   * UNSET means `refuse`. Measured on the Agentic Team's first real run: `refuse` bounced four of
   * five live tickets, including one whose summary IS its reproduction and three that are
   * investigations — for an organization whose own defect practice says "reproduce it first".
   */
  UnreproducedDefects: "unreproduced_defects",
} as const;
export type ProcessSetting = (typeof ProcessSetting)[keyof typeof ProcessSetting];

/**
 * What each setting will accept.
 *
 * A CLOSED SET PER SETTING, checked at bind and at load. A free-form value would make
 * `integration_branch=directly` a stored row that lists as configuration and governs nothing — the
 * defect class this register spends most of its guards on.
 */
export const SETTING_VALUES: Readonly<Record<ProcessSetting, readonly string[]>> = {
  [ProcessSetting.IntegrationBranch]: ["collect", "direct"],
  [ProcessSetting.UnreproducedDefects]: ["refuse", "reproduce_first"],
};

export interface SettingBinding {
  readonly setting: ProcessSetting;
  readonly value: string;
  /**
   * What this applies to: a work id, or a TICKET KEY, or absent for organization-wide.
   *
   * Both vocabularies, because they belong to different readers — an operator writes `AIAGENT-796`
   * and the cascade calls the same node `proj-013`. Demanding the internal id would make this
   * unusable from a command line; accepting only the ticket would make it unusable in a cascade with
   * no upstream.
   */
  readonly scope?: string;
  /** Why the process works this way here. A knob with no reason is indistinguishable from a typo. */
  readonly why: string;
}

export function validateSetting(binding: SettingBinding): PracticeCheck {
  const names = Object.values(ProcessSetting) as readonly string[];
  if (!names.includes(binding.setting)) {
    return { ok: false, reason: `'${String(binding.setting)}' is not a process setting — known: ${names.join(", ")}` };
  }
  const legal = SETTING_VALUES[binding.setting];
  if (!legal.includes(binding.value)) {
    return {
      ok: false,
      reason: `'${binding.value}' is not a value for '${String(binding.setting)}' — known: ${legal.join(", ")}`,
    };
  }
  if (binding.why.trim() === "") {
    return { ok: false, reason: `'${String(binding.setting)}' was set with no reason: say why the process works this way here` };
  }
  return { ok: true };
}

export function validateSettings(bindings: readonly SettingBinding[]): PracticeCheck {
  const seen = new Set<string>();
  for (const b of bindings) {
    const one = validateSetting(b);
    if (!one.ok) return one;
    // ONE VALUE PER SETTING PER SCOPE. Two would resolve by array order — a rule nobody stated and
    // nobody can see, exactly as for practices.
    const key = `${String(b.setting)}|${b.scope ?? ""}`;
    if (seen.has(key)) {
      return {
        ok: false,
        reason:
          `'${String(b.setting)}' is already set at ${b.scope === undefined ? "organization scope" : `'${b.scope}'`}` +
          ": replace it rather than adding a second",
      };
    }
    seen.add(key);
  }
  return { ok: true };
}

export interface SettingResolution {
  readonly setting: ProcessSetting;
  /** Absent means NOTHING IS SET, which is a real answer and usually the right one. */
  readonly value?: string;
  readonly scope?: string;
  readonly why?: string;
  readonly because: string;
}

/**
 * What a setting is, for one thing.
 *
 * `candidates` are the names this thing answers to, NEAREST FIRST — its work id, its ticket, then its
 * parents' ids and tickets. The caller assembles them because this module holds the rule and the
 * cascade holds the shape; `settingCandidates` does it for the ordinary case.
 *
 * UNSET IS NOT A FAILURE. It means the mechanical default applies — for `integration_branch`, the
 * shape rule — and a resolver that invented a value here would silently replace that default with
 * a guess.
 */
export function resolveSetting(
  bindings: readonly SettingBinding[],
  setting: ProcessSetting,
  candidates: readonly string[] = [],
): SettingResolution {
  const forSetting = bindings.filter((b) => b.setting === setting);
  for (const name of candidates) {
    const scoped = forSetting.find((b) => b.scope === name);
    if (scoped !== undefined) {
      return {
        setting,
        value: scoped.value,
        scope: name,
        why: scoped.why,
        because: `set for '${name}' specifically, which is nearer than any organization-wide setting`,
      };
    }
  }
  const orgWide = forSetting.find((b) => b.scope === undefined);
  if (orgWide !== undefined) {
    return { setting, value: orgWide.value, why: orgWide.why, because: "set organization-wide" };
  }
  return { setting, because: `nothing is set for '${String(setting)}', so the mechanical default applies` };
}

export interface PracticeResolution {
  readonly subject: PracticeSubject;
  /** Whether anything at all governs this subject. */
  readonly governed: boolean;
  /** True when what governs it came from the REGISTER rather than from this organization. */
  readonly byDefault?: boolean;
  readonly skills: readonly PracticeSkill[];
  readonly directive?: string;
  readonly why?: string;
  /** The work item a scoped practice matched, when one did. */
  readonly scopeWorkId?: string;
  /** Always populated. A resolution nobody can explain is one nobody will trust. */
  readonly because: string;
}

/**
 * How this organization performs a subject, for this work item.
 *
 * `ancestry` is the work item and its parents, NEAREST FIRST — the caller walks the cascade because
 * this module holds the rule and the cascade holds the shape. The nearest scoped practice wins
 * OUTRIGHT rather than merging with the organization-wide one.
 *
 * NOT MERGED, and that is the load-bearing choice. Merging two ordered lists needs a rule for
 * interleaving them that nobody stated and no reader could predict — and a program that deliberately
 * runs a lighter process than its parent would find the parent's steps reappearing inside its own.
 * A scope either states its practice or inherits it whole.
 */
export function resolvePractice(
  practices: readonly Practice[],
  subject: PracticeSubject,
  ancestry: readonly string[] = [],
  defaults: readonly Practice[] = [],
): PracticeResolution {
  const matches = practices.filter(
    (p) => p.subject.kind === subject.kind && p.subject.id === subject.id,
  );

  for (const workId of ancestry) {
    const scoped = matches.find((p) => p.scopeWorkId === workId);
    if (scoped !== undefined) return found(scoped, `stated for '${workId}' specifically, which is nearer than any organization-wide practice`, workId);
  }

  const orgWide = matches.find((p) => p.scopeWorkId === undefined);
  if (orgWide !== undefined) return found(orgWide, "stated organization-wide");

  const fallback = defaults.find(
    (p) => p.subject.kind === subject.kind && p.subject.id === subject.id,
  );
  if (fallback !== undefined) {
    return {
      ...found(fallback, `nothing is stated for '${subject.id}', so the register's own practice applies — 'org practice bind' replaces it`),
      byDefault: true,
    };
  }

  return {
    subject,
    governed: false,
    skills: [],
    because: `nothing is stated for '${subject.id}', so it is done however the repository and the agent see fit`,
  };
}

function found(p: Practice, because: string, scopeWorkId?: string): PracticeResolution {
  return {
    subject: p.subject,
    governed: true,
    skills: p.skills,
    ...(p.directive === undefined ? {} : { directive: p.directive }),
    why: p.why,
    ...(scopeWorkId === undefined ? {} : { scopeWorkId }),
    because,
  };
}

/**
 * The practices in force, as a listing — the organization's own, plus the defaults it has not replaced.
 *
 * Answers "what process is this organization following", which is not the same question as "what did
 * somebody type". A listing that showed only the second told an operator their organization had no
 * process while it was following the register's.
 */
export function practicesInForce(
  practices: readonly Practice[],
  defaults: readonly Practice[],
): readonly { readonly practice: Practice; readonly byDefault: boolean }[] {
  const stated = practices.map((practice) => ({ practice, byDefault: false }));
  const keyOf = (p: Practice) => `${String(p.subject.kind)}|${p.subject.id}|${p.scopeWorkId ?? ""}`;
  const claimed = new Set(practices.map(keyOf));
  const inherited = defaults
    .filter((d) => !claimed.has(keyOf(d)))
    .map((practice) => ({ practice, byDefault: true }));
  return [...stated, ...inherited];
}

/**
 * A practice DECLINED — stated, and stating that nothing governs this.
 *
 * The third state, and the one that keeps a default from being a mandate. An operator who disagrees
 * with the register's practice must be able to answer "neither", and that answer carries its reason
 * like every other decision here. Recognised by an empty skill list AND an empty directive, which
 * `validatePractice` otherwise refuses — so a decline can only be built deliberately, through
 * `declinePractice`, and never typed by accident.
 */
export function declinePractice(subject: PracticeSubject, why: string, scopeWorkId?: string): Practice {
  return {
    subject,
    skills: [],
    declined: true,
    why,
    ...(scopeWorkId === undefined ? {} : { scopeWorkId }),
  };
}

/** Whether a practice is a decline rather than a statement. */
export function isDeclined(p: Practice): boolean {
  // READ, not inferred. A row that merely looks empty is a defect; this one says it is a decision.
  return p.declined === true;
}

/**
 * Everything an agent needs to be told about how to do one thing.
 *
 * Rendered rather than returned as a structure, because the consumer is a prompt: an agent reads
 * this. The skills are numbered so the ORDER is visible — a list an agent reads as unordered is a
 * list whose precedence was configured and then discarded on the way out.
 */
export function renderPractice(r: PracticeResolution): string {
  if (!r.governed) return "";
  // A DECLINED PRACTICE RENDERS AS NOTHING. Caught by its own test: without this it produced a
  // heading and a `because` with no process between them — an agent told "here is how we handle
  // defects: (nothing)", which is worse than silence because it reads as an empty rule rather
  // than as an absent one. A decline says the subject is ungoverned; saying it out loud in the
  // agent's brief is the operator's business, not this renderer's.
  const hasDirective = r.directive !== undefined && r.directive.trim() !== "";
  if (!hasDirective && r.skills.length === 0) return "";
  const lines: string[] = [];
  if (r.directive !== undefined && r.directive.trim() !== "") lines.push(`  ${r.directive.trim()}`);
  r.skills.forEach((s, i) => {
    const where = s.source === SkillSource.Marketplace ? `${s.source}:${s.marketplace ?? "?"}` : String(s.source);
    lines.push(`  ${String(i + 1)}. ${s.skill}  (${where})`);
  });
  if (r.why !== undefined) lines.push(`  because ${r.why}`);
  return lines.join("\n");
}

/**
 * How this organization works, for one gate on one work item — ready to hand to an agent.
 *
 * ── TWO SUBJECTS, NOT ONE ────────────────────────────────────────────────────
 * A gate on a defect is governed by BOTH the practice for that gate and the practice for defects,
 * and neither subsumes the other: "how we review" and "what solving a defect means here" are
 * different statements and an agent needs both. So both are resolved and both are rendered, each
 * labelled with what it governs — an unlabelled concatenation would leave an agent unable to tell
 * which statement it was allowed to disagree with.
 *
 * ── SCOPE COMES FROM THE CASCADE ─────────────────────────────────────────────
 * The ancestry is the work item and its parents, nearest first, so a practice stated for one program
 * or one STAGE of a program reaches everything under it. That is the whole reason the layer is
 * scoped, and computing the ancestry here rather than asking the caller for it means a caller cannot
 * forget and silently get organization-wide answers.
 *
 * ── RENDERED, NOT RETURNED AS STRUCTURE ──────────────────────────────────────
 * The consumer is a prompt. Returning structure would put the decision of how a process READS in the
 * adapter that spawns the process, which is the last place it belongs.
 */
export function guidanceFrom(input: {
  readonly practices?: readonly Practice[];
  readonly directives?: readonly Directive[];
  /** The register's own practices, so an organization that stated nothing still has a process. */
  readonly defaultPractices?: readonly Practice[];
  readonly defaultDirectives?: readonly Directive[];
  readonly cascade?: Cascade;
  /** Connected repositories, so an agent is told what each already offers. */
  readonly repoSkills?: string;
}): (gate: string, node: CascadeNode) => {
  readonly practice?: string;
  readonly directives?: string;
  readonly repoSkills?: string;
} {
  const practices = input.practices ?? [];
  const defaults = input.defaultPractices ?? [];

  // COMPUTED ONCE. The standing directives do not depend on the gate or the item, and re-rendering
  // them per phase would be work done for every producer call to reach the same answer.
  const standing = directivesInForce(input.directives, input.defaultDirectives ?? [])
    .map((row) => `  ${row.directive.text}\n    because ${row.directive.why}`)
    .join("\n");

  return (gate, node) => {
    const ancestry =
      input.cascade === undefined
        ? [node.workId]
        : [node.workId, ...ancestorsOf(input.cascade, node.workId).map((a) => a.workId)];

    const parts: string[] = [];
    for (const [label, subject] of [
      [`the '${gate}' gate`, { kind: PracticeSubjectKind.Gate, id: gate }],
      [`work of kind '${String(node.workType)}'`, { kind: PracticeSubjectKind.WorkType, id: String(node.workType) }],
    ] as readonly [string, PracticeSubject][]) {
      const resolved = resolvePractice(practices, subject, ancestry, defaults);
      if (!resolved.governed) continue;
      const rendered = renderPractice(resolved);
      if (rendered === "") continue;
      parts.push(`How this organization handles ${label}:\n${rendered}`);
    }

    return {
      ...(parts.length === 0 ? {} : { practice: parts.join("\n\n") }),
      ...(standing === "" ? {} : { directives: standing }),
      ...(input.repoSkills === undefined || input.repoSkills === "" ? {} : { repoSkills: input.repoSkills }),
    };
  };
}
