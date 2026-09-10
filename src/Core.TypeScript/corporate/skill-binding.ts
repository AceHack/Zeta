/**
 * corporate/skill-binding.ts — which skill performs a gate, when somebody has said.
 *
 * ── THE DEFAULT IS NO SKILLS AT ALL ──────────────────────────────────────────
 * An organization with no bindings works exactly as it does today: `withProducers` attaches
 * whatever adapters the composition root has, the repo's own skills are whatever the agent finds
 * in the checkout, and nothing here is consulted. That is the case this module is designed AROUND
 * rather than the case it tolerates — most orgs never bind anything, and a mechanism that made
 * them declare a skill per gate before they could start would be a configuration tax on the common
 * path.
 *
 * ── SO A MISSING BINDING FALLS BACK; IT NEVER REFUSES ────────────────────────
 * This was a real fork and it is settled: a gate with no binding uses the default producer. The
 * alternative — refusing — is more honest in the narrow sense that the org would never silently do
 * something other than what you configured, and it is wrong here for two reasons. It makes the
 * zero-config path impossible, and it converts every newly-added gate into an outage for every org
 * that has not yet heard of it.
 *
 * What the fallback must NOT be is silent. `resolve` always reports WHICH source answered, so
 * "this ran on the repo default" and "this ran on the skill you chose" are distinguishable at
 * every call site and in the trace afterwards. A fallback nobody can see is the failure that makes
 * people distrust configuration.
 *
 * ── SPECIFICITY: PROJECT BEATS ORG ───────────────────────────────────────────
 * A binding may be scoped to one work item's subtree, which is what "different pipelines for
 * different projects" needs. The more specific scope wins, and `resolve` says which one did — so
 * an operator wondering why an epic behaves differently from its sibling gets an answer rather
 * than a theory.
 */

import { stringCompare } from "../collation/collation.ts";
import type { GateKind } from "./quality-gate";

/** Where a skill comes from. The distinction an operator cares about when something misbehaves. */
export const SkillSource = {
  /** Whatever the checkout provides. The default, and what an unbound gate uses. */
  Repo: "repo",
  /** Installed from a marketplace by name. */
  Marketplace: "marketplace",
  /** A path in the operator's own tree. */
  Local: "local",
} as const;

export type SkillSource = (typeof SkillSource)[keyof typeof SkillSource];

export interface SkillBinding {
  readonly gate: GateKind;
  /** The skill to invoke — a slash-command name, a marketplace id, or a path. */
  readonly skill: string;
  readonly source: SkillSource;
  /**
   * Restrict this binding to one work item and everything under it.
   *
   * Absent means organization-wide. Present is what makes a per-project pipeline expressible
   * without a second configuration system.
   */
  readonly scopeWorkId?: string;
  /** Where a marketplace skill came from, so a reader can find it again. */
  readonly marketplace?: string;
}

export type BindingCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const SKILL_RE = /^[A-Za-z0-9][A-Za-z0-9 _.:/@-]{0,127}$/;

/**
 * Refuse a binding that cannot mean what it says.
 *
 * The marketplace rule is the one worth stating: a binding whose source is a marketplace and which
 * names no marketplace is unresolvable later — the skill id alone does not say where to get it, so
 * an org that moved machines would fail with "skill not found" and no way to know what to install.
 */
export function validateBinding(binding: SkillBinding): BindingCheck {
  if (!SKILL_RE.test(binding.skill)) {
    return { ok: false, reason: `'${binding.skill}' is not a usable skill name` };
  }
  if (!Object.values(SkillSource).includes(binding.source)) {
    return { ok: false, reason: `'${String(binding.source)}' is not a skill source` };
  }
  if (binding.source === SkillSource.Marketplace && (binding.marketplace ?? "").trim() === "") {
    return {
      ok: false,
      reason: `'${binding.skill}' comes from a marketplace but names none, so nothing could install it later`,
    };
  }
  if (binding.source !== SkillSource.Marketplace && binding.marketplace !== undefined) {
    return {
      ok: false,
      reason: `'${binding.skill}' is a ${binding.source} skill and cannot also come from a marketplace`,
    };
  }
  if (binding.scopeWorkId !== undefined && binding.scopeWorkId.trim() === "") {
    return { ok: false, reason: "a scoped binding needs a work item id" };
  }
  return { ok: true };
}

/** How a gate's performer was decided. `bound` false means the default producer runs. */
export interface Resolution {
  readonly gate: GateKind;
  readonly bound: boolean;
  readonly skill?: string;
  readonly source?: SkillSource;
  readonly marketplace?: string;
  /** The work item a scoped binding matched, when one did. */
  readonly scopeWorkId?: string;
  /** Always populated. A fallback nobody can see is the failure that makes people distrust config. */
  readonly because: string;
}

/**
 * Which skill performs this gate for this work item.
 *
 * `ancestry` is the work item and its parents, nearest first — the caller walks the cascade because
 * this module holds the rule and the cascade holds the shape. A binding scoped to any of them
 * matches, and the NEAREST one wins, so a task can override its epic and an epic its organization.
 */
export function resolve(
  bindings: readonly SkillBinding[],
  gate: GateKind,
  ancestry: readonly string[] = [],
): Resolution {
  const forGate = bindings.filter((b) => b.gate === gate);

  for (const workId of ancestry) {
    const scoped = forGate.find((b) => b.scopeWorkId === workId);
    if (scoped !== undefined) {
      return {
        gate,
        bound: true,
        skill: scoped.skill,
        source: scoped.source,
        ...(scoped.marketplace === undefined ? {} : { marketplace: scoped.marketplace }),
        scopeWorkId: workId,
        because: `bound for '${workId}' specifically, which is nearer than any organization-wide binding`,
      };
    }
  }

  const orgWide = forGate.find((b) => b.scopeWorkId === undefined);
  if (orgWide !== undefined) {
    return {
      gate,
      bound: true,
      skill: orgWide.skill,
      source: orgWide.source,
      ...(orgWide.marketplace === undefined ? {} : { marketplace: orgWide.marketplace }),
      because: "bound organization-wide",
    };
  }

  return {
    gate,
    bound: false,
    because: `nothing is bound for '${String(gate)}', so the repo's own default performs it`,
  };
}

/**
 * Every gate this organization has said something about, with what it said.
 *
 * For `org skills list` — an operator needs to see the whole configuration at once, because the
 * question "why did this gate behave that way" is usually answered by a binding somewhere else.
 */
export function bindingsOf(bindings: readonly SkillBinding[]): readonly SkillBinding[] {
  return [...bindings].sort((a, b) => {
    const g = stringCompare(String(a.gate), String(b.gate));
    if (g !== 0) return g;
    // Organization-wide first, then scoped — the order somebody reads a configuration in.
    return stringCompare(a.scopeWorkId ?? "", b.scopeWorkId ?? "");
  });
}

/**
 * Refuse a set of bindings that contradicts itself.
 *
 * Two bindings for the same gate at the same scope is a configuration whose behaviour depends on
 * array order, which means the same file could behave differently after an unrelated edit.
 */
export function validateBindings(bindings: readonly SkillBinding[]): BindingCheck {
  const seen = new Set<string>();
  for (const binding of bindings) {
    const check = validateBinding(binding);
    if (!check.ok) return check;
    const key = `${String(binding.gate)}|${binding.scopeWorkId ?? "*"}`;
    if (seen.has(key)) {
      return {
        ok: false,
        reason:
          `'${String(binding.gate)}' is bound twice at ${binding.scopeWorkId ?? "organization"} scope; ` +
          `which one wins would depend on order`,
      };
    }
    seen.add(key);
  }
  return { ok: true };
}
