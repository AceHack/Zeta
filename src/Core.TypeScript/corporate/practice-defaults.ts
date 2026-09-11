/**
 * corporate/practice-defaults.ts — the process this organization follows when nobody has said otherwise.
 *
 * ── THE SAME ARGUMENT AS THE METHOD DEFAULTS, AND THE SAME LINE ──────────────
 * A configurable-and-empty layer is a cost paid by every operator who did not know a knob existed,
 * to buy a flexibility almost none of them wanted. So the register states the few things it has
 * actually earned an opinion about, as DATA, replaceable and declinable.
 *
 * The line is unchanged: the register may have an opinion about how its own work is done. The GRAMMAR
 * may not have an opinion about anything — `observe.ts` still names no skill and resolves none, and
 * nothing here is reachable from it.
 *
 * ── DELIBERATELY SHORT, AND SHORTER THAN IT LOOKS ────────────────────────────
 * Two entries. Not one per gate, not a house style for BRDs, not a TDD flavour — this register has
 * no earned opinion about any of those, and inventing one to fill the table would be exactly the
 * fabrication it refuses elsewhere. What IS earned:
 *
 *   - a fix is not a fix until something fails without it. This repository's whole discipline.
 *   - the skills of the repository you are working in exist, and ignoring them is a choice nobody
 *     made deliberately.
 *
 * Everything else about a program's process is for that program to state, which is what the layer is
 * for.
 */

import { PracticeSubjectKind, type Directive, type Practice } from "./practice";
import { WorkType } from "./goal-cascade";

/**
 * The id of the standing instruction about a repository's own skills.
 *
 * Named once so the two surfaces that mention it — the default below and any listing that explains
 * it — cannot drift into describing different instructions.
 */
export const REPO_SKILLS_FIRST = "repo-skills-first";

/**
 * What holds regardless of what is being done.
 *
 * ── WHY THE REPO-SKILLS ONE IS A DEFAULT AND NOT A SUGGESTION ────────────────
 * A repository that carries `.claude/skills/` has had somebody write down how to work in it — the
 * build's traps, the test runner's flags, the review checklist that its own maintainers use. An
 * agent that ignores that and reasons from first principles will rediscover a subset of it, slowly,
 * and get the rest wrong. The knowledge is RIGHT THERE and it is specific to the repository in a way
 * nothing in this register can be.
 *
 * So the register's default is to consult it FIRST, and an organization's own bindings are additions
 * and overrides rather than replacements. Declinable, like every default here: an organization whose
 * repositories carry skills it does not trust must be able to say so, and say why.
 */
export const DEFAULT_DIRECTIVES: readonly Directive[] = [
  {
    id: REPO_SKILLS_FIRST,
    text:
      "Before reaching for a skill this organization bound, look at what the repository you are " +
      "working in already provides — its own skills, its CLAUDE.md, its contributing guide, its " +
      "test and build conventions — and prefer those where they apply. They are specific to this " +
      "codebase in a way nothing configured here can be. Where a repository's own practice and this " +
      "organization's disagree, say so rather than silently picking one.",
    why:
      "a repository that carries skills has had somebody write down how to work in it; ignoring " +
      "them means rediscovering a subset slowly and getting the rest wrong",
  },
];

/**
 * Practices the register has earned.
 *
 * ONE, and it is this repository's own carved discipline rather than a general-purpose opinion about
 * defects: a passing test proves nothing about a fix unless it fails without it. The subject is the
 * WORK TYPE rather than a gate, because the practice governs the whole handling of a defect and not
 * the moment somebody reviews it.
 *
 * No skills attached, on purpose. There is no skill that makes this true — it is a statement an
 * agent has to read and act on, which is precisely what the directive half of a practice is for.
 */
export const DEFAULT_PRACTICES: readonly Practice[] = [
  {
    subject: { kind: PracticeSubjectKind.WorkType, id: String(WorkType.Defect) },
    skills: [],
    directive:
      "A defect is not solved until something fails without the fix. Reproduce it first, keep the " +
      "reproduction as a test, then fix it — and confirm the test goes red when the fix is removed. " +
      "A green test that would pass either way is not evidence, and a fix with no falsifier is a " +
      "belief about the defect rather than a repair of it.",
    why:
      "a test that cannot fail proves nothing about the fix beside it, and that is the one thing a " +
      "defect's delivery has to establish",
  },
];
