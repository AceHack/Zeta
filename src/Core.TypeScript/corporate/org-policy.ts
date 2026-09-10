/**
 * corporate/org-policy.ts — what THIS organization demands at each step.
 *
 * ── WHY THIS IS PER-ORGANIZATION AND NOT A CONSTANT ──────────────────────────
 * The gates say WHAT must be judged; they have never said what evidence this particular company
 * will accept for it. `qa.ts` already models a test case's `ExecutionMode`, but the decision one
 * level up — *"how does this organization verify anything at all"* — had nowhere to live, so every
 * org verified the same way by omission.
 *
 * That is wrong in both directions. A greenfield product can have QA author repeatable Playwright
 * specs, because there is an app to drive and no existing suite to respect. A corporation usually
 * cannot: it has a UAT harness, a BDD corpus, and a process that predates us. Hardcoding either
 * makes the platform usable by exactly one kind of team.
 *
 * ── VERIFICATION IS A PREREQUISITE, NOT A DEFAULT ────────────────────────────
 * `verification` is REQUIRED on `OrgPolicy`. An organization that has not said how it verifies has
 * not been configured, and defaulting it would mean the first QA gate silently picks an approach
 * nobody chose — which is how a suite comes to "pass" by walking a scenario no one specified.
 * `validateOrgPolicy` refuses such a policy before any work is scheduled against it.
 *
 * ── A RULE THAT CANNOT BE CHECKED IS DECORATION ──────────────────────────────
 * Every rule here is a CHECKABLE requirement over facts the gate already carries — evidence refs,
 * approver ids, the artifacts prior phases produced. There is deliberately no free-text rule: a
 * rule the evaluator cannot test would pass by being unreadable, which is the vacuity class wearing
 * a governance label. If a rule cannot be expressed against those facts, it belongs in the gate's
 * prompt, not in a policy that claims to enforce it.
 *
 * ── SKILLS ARE OFFERED, NOT INJECTED ─────────────────────────────────────────
 * `skills` lists what this org makes available at a step. REPO SKILLS ARE NOT LISTED and are always
 * available — an agent reaches for the repository's own tooling as a matter of course, and
 * enumerating that here would produce a list nobody maintains that silently narrows over time.
 */

import type { GateKind } from "./quality-gate";

/**
 * How this organization proves a change works.
 *
 * Chosen at creation. Distinct from `qa.ExecutionMode`, which is how ONE test case runs — several
 * of these approaches produce browser-automation cases, and the difference that matters here is who
 * authors the check and what artifact it leaves behind.
 */
export const VerificationApproach = {
  /**
   * QA authors repeatable scripts (Playwright and similar). The SCRIPT is the artifact, so the
   * check survives the session that wrote it and can be re-run at the next gate.
   */
  AuthoredScripts: "authored_scripts",
  /** The org already owns a harness; QA drives it and attaches its report. */
  ExistingHarness: "existing_harness",
  /** Behaviour specifications — written here, executed here, or both. */
  BehaviourSpecs: "behaviour_specs",
  /** A scenario walked by hand, with evidence attached. The honest option when nothing is automatable. */
  ManualWalkthrough: "manual_walkthrough",
} as const;

export type VerificationApproach = (typeof VerificationApproach)[keyof typeof VerificationApproach];

export function isVerificationApproach(value: unknown): value is VerificationApproach {
  return typeof value === "string" && Object.values(VerificationApproach).includes(value as VerificationApproach);
}

/** The kinds of demand a policy can make. Each is testable against facts the gate already has. */
export const RuleKind = {
  /** Some evidence ref must contain this substring — a report path, a spec directory, a run id. */
  EvidenceMatching: "evidence_matching",
  /** At least N DISTINCT hats must have approved. */
  MinApprovers: "min_approvers",
  /** A named artifact must have been produced by an earlier phase. */
  ArtifactPresent: "artifact_present",
} as const;

export type RuleKind = (typeof RuleKind)[keyof typeof RuleKind];

export interface GateRule {
  readonly id: string;
  readonly kind: RuleKind;
  /** The substring for `EvidenceMatching`, or the artifact path for `ArtifactPresent`. */
  readonly needle?: string;
  /** The count for `MinApprovers`. */
  readonly atLeast?: number;
  /** Why this org demands it — shown when the rule is unmet. */
  readonly because: string;
}

export interface GatePolicy {
  readonly gate: GateKind;
  /** Extra conditions this org adds on top of the gate's own judgement. */
  readonly rules?: readonly GateRule[];
  /**
   * Skills this org offers at this step, beyond the repository's own.
   *
   * Offered rather than required: an agent that does not need one does not use it, and a policy
   * that FORCED a skill would be scripting the step rather than staffing it.
   */
  readonly skills?: readonly string[];
  /** Overrides the org's default approach for this gate only. */
  readonly verification?: VerificationApproach;
}

export interface OrgPolicy {
  readonly orgId: string;
  /** REQUIRED. An org that has not said how it verifies has not been configured. */
  readonly verification: VerificationApproach;
  readonly gates?: readonly GatePolicy[];
}

export type PolicyCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Refuse a policy that cannot mean what it says.
 *
 * Checked BEFORE anything is scheduled against it, because every one of these failures is silent at
 * run time: a duplicated gate policy applies whichever was found first, a rule with no needle
 * matches everything, and a `MinApprovers` of zero is a requirement that cannot fail.
 */
export function validateOrgPolicy(policy: OrgPolicy): PolicyCheck {
  if (policy.orgId.trim() === "") return { ok: false, reason: "an organization policy needs an org id" };
  if (!isVerificationApproach(policy.verification)) {
    return {
      ok: false,
      reason:
        `'${String(policy.verification)}' is not a verification approach; an organization must ` +
        `state how it verifies before any work is scheduled against it`,
    };
  }

  const seen = new Set<GateKind>();
  for (const gp of policy.gates ?? []) {
    if (seen.has(gp.gate)) {
      return { ok: false, reason: `'${gp.gate}' has two policies; which one applies is undefined` };
    }
    seen.add(gp.gate);

    if (gp.verification !== undefined && !isVerificationApproach(gp.verification)) {
      return { ok: false, reason: `'${gp.gate}' names an unknown verification approach` };
    }

    const ids = new Set<string>();
    for (const rule of gp.rules ?? []) {
      if (ids.has(rule.id)) {
        return { ok: false, reason: `'${gp.gate}' has two rules called '${rule.id}'` };
      }
      ids.add(rule.id);

      const bad = ruleIsWellFormed(rule);
      if (bad !== undefined) return { ok: false, reason: `'${gp.gate}' rule '${rule.id}': ${bad}` };
    }
  }
  return { ok: true };
}

/** Why this rule could never fail, or `undefined` if it is sound. */
function ruleIsWellFormed(rule: GateRule): string | undefined {
  if (rule.because.trim() === "") return "a rule must say why it exists";
  switch (rule.kind) {
    case RuleKind.EvidenceMatching:
    case RuleKind.ArtifactPresent:
      // An empty needle is contained in every string, so the rule would pass on anything —
      // a check that cannot fail.
      return rule.needle === undefined || rule.needle.trim() === ""
        ? "needs a non-empty needle, or it matches everything and cannot fail"
        : undefined;
    case RuleKind.MinApprovers:
      return rule.atLeast === undefined || rule.atLeast < 1
        ? "needs atLeast >= 1, or it is satisfied by nobody approving"
        : undefined;
    default:
      return `unknown rule kind '${String(rule.kind)}'`;
  }
}

/** The policy for one gate, or `undefined` when this org adds nothing there. */
export function policyFor(policy: OrgPolicy, gate: GateKind): GatePolicy | undefined {
  return (policy.gates ?? []).find((g) => g.gate === gate);
}

/** How this org verifies at this gate — the gate's override, else the org's default. */
export function verificationAt(policy: OrgPolicy, gate: GateKind): VerificationApproach {
  return policyFor(policy, gate)?.verification ?? policy.verification;
}

/**
 * Skills offered at this step.
 *
 * Empty is the normal answer. Repository skills are always available and never listed here, so an
 * empty list means "nothing beyond the repo's own", never "no tooling".
 */
export function skillsAt(policy: OrgPolicy, gate: GateKind): readonly string[] {
  return policyFor(policy, gate)?.skills ?? [];
}

/** The facts a rule is checked against — everything the gate already carries. */
export interface GateFacts {
  readonly evidenceRefs: readonly string[];
  readonly approverHatIds: readonly string[];
  /** Paths of artifacts earlier phases produced on this item. */
  readonly artifactPaths: readonly string[];
}

export interface UnmetRule {
  readonly rule: GateRule;
  readonly because: string;
}

/**
 * Which of this org's extra rules this gate does not satisfy.
 *
 * Returns the UNMET ones rather than a boolean, so a refusal can name what is missing. "The QA gate
 * failed policy" sends somebody looking; "no evidence ref mentions `playwright-report`" is
 * actionable in one read.
 */
export function unmetRules(
  policy: OrgPolicy,
  gate: GateKind,
  facts: GateFacts,
): readonly UnmetRule[] {
  const rules = policyFor(policy, gate)?.rules ?? [];
  const out: UnmetRule[] = [];

  for (const rule of rules) {
    switch (rule.kind) {
      case RuleKind.EvidenceMatching: {
        const needle = rule.needle ?? "";
        if (needle !== "" && facts.evidenceRefs.some((r) => r.includes(needle))) break;
        out.push({
          rule,
          because: `no evidence reference mentions '${needle}' (${String(facts.evidenceRefs.length)} attached)`,
        });
        break;
      }
      case RuleKind.MinApprovers: {
        const need = rule.atLeast ?? 1;
        const distinct = new Set(facts.approverHatIds).size;
        if (distinct >= need) break;
        out.push({
          rule,
          because: `${String(distinct)} distinct approver(s), this org requires ${String(need)}`,
        });
        break;
      }
      case RuleKind.ArtifactPresent: {
        const needle = rule.needle ?? "";
        if (needle !== "" && facts.artifactPaths.some((p) => p.includes(needle))) break;
        out.push({ rule, because: `no artifact named like '${needle}' was produced` });
        break;
      }
      default:
        out.push({ rule, because: `rule kind '${String(rule.kind)}' cannot be checked` });
    }
  }
  return out;
}

/** Does this gate satisfy everything the org demands on top of the gate's own judgement? */
export function satisfiesPolicy(policy: OrgPolicy, gate: GateKind, facts: GateFacts): boolean {
  return unmetRules(policy, gate, facts).length === 0;
}

/**
 * A starting policy for an organization that has stated only how it verifies.
 *
 * Deliberately carries NO gate rules. A default full of opinions would be this module deciding what
 * every organization's process must be — the thing `validatePipeline` already refuses to do for
 * pipelines — and an org that wants rules adds them knowingly.
 */
export function basePolicy(orgId: string, verification: VerificationApproach): OrgPolicy {
  return { orgId, verification };
}
