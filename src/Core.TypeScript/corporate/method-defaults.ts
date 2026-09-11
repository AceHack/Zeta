/**
 * corporate/method-defaults.ts — how this organization works when nobody has said otherwise.
 *
 * ── WHY THERE ARE DEFAULTS AT ALL ────────────────────────────────────────────
 * The method seam shipped configurable and empty, so an organization that bound nothing asked
 * questions exactly as badly as before — one shallow question, one shallow answer, and work
 * proceeding on it. That is a real cost paid by every operator who did not know a knob existed, to
 * buy a flexibility almost none of them wanted. Interviewing a requirement rather than transcribing
 * it is not an exotic preference; it is what shaping work MEANS, and an organization that does not
 * do it by default is not neutral, it is just worse.
 *
 * ── AND WHY THIS IS NOT THE HARDCODING THAT WAS REFUSED ──────────────────────
 * The objection that produced this seam was to a questionnaire compiled into the runtime — an
 * interview file welded to a hat, with the questions themselves in code. Nothing here is that:
 *
 *   - `observe.ts` still names no skill and resolves none. The grammar cannot tell you what any of
 *     these ids mean, and must not be able to.
 *   - The defaults are DATA in the register, in exactly the place the register already keeps its
 *     other opinions — the gate chain per work type, the seeded chart, the pipeline order.
 *   - Every one is REPLACEABLE by `org method bind` / `org skill bind`, and REMOVABLE by binding an
 *     empty skill. A default that cannot be turned off is a mandate, and this register does not
 *     issue mandates: choosing "no method here" has to remain a real answer, and it carries its
 *     reason like every other decision.
 *
 * The line is: the register may have an opinion about how its own gates are performed. The GRAMMAR
 * may not have an opinion about anything.
 */

import { GateKind } from "./quality-gate";
import type { Method } from "../observe/observe";

/**
 * The skill that shapes a requirement by interviewing it.
 *
 * Named once, here, so the two surfaces below cannot drift into disagreeing about which method the
 * organization actually uses — a verb defaulting to one skill and its gate to another would be a
 * split personality nobody configured.
 */
export const GROUNDING_SKILL = "requirement-grilling";

/**
 * An empty skill id means NO METHOD HERE, deliberately.
 *
 * The way to remove a default without inventing a second list of suppressions: a binding that names
 * no skill. It still carries its `why`, because turning grilling off is a decision somebody made
 * and the next person to read the configuration deserves the reason.
 */
export const NO_METHOD = "";

/**
 * Verbs whose default method the register has an opinion about.
 *
 * DELIBERATELY SHORT. A default is only defensible where the practice is genuinely settled, and
 * "ask one question at a time, carrying a recommendation, until the exit criteria hold" is settled.
 * Nothing here covers reviewing, deciding or escalating, because this register has no earned method
 * for those and inventing one to fill the table would be exactly the fabrication it refuses
 * elsewhere.
 */
export const DEFAULT_METHODS: readonly Method[] = [
  {
    kind: "request_information",
    skillId: GROUNDING_SKILL,
    why: "asking once gets one answer; a requirement is understood by interviewing it",
  },
  {
    kind: "draft_business_doc",
    skillId: GROUNDING_SKILL,
    why: "the document is the interview written down — it is wrong wherever the interview was thin",
  },
];

/**
 * Gates whose default performer the register has an opinion about.
 *
 * The same method, on the other surface. The production runtime reaches an agent through
 * `ORG_SKILL` per GATE rather than through the observe menu, so a default that existed only on the
 * verb would apply to the path that is driven least — the seam would be satisfied and the running
 * organization unchanged.
 *
 * These three are where a requirement is SHAPED rather than judged: what the business context is,
 * what the customer actually asked for, and what the BRD says they will get. Approvals,
 * architecture and everything downstream are left alone, because interviewing is not what those do.
 */
export const DEFAULT_GATE_SKILLS: Partial<Record<GateKind, string>> = {
  [GateKind.BusinessContextGrooming]: GROUNDING_SKILL,
  [GateKind.CustomerRfpReview]: GROUNDING_SKILL,
  [GateKind.BrdApproval]: GROUNDING_SKILL,
};

/**
 * The methods in force for an organization: the defaults, as it has amended them.
 *
 * ── THREE STATES, AND THE THIRD IS THE ONE THAT MATTERS ──────────────────────
 *   - a verb the organization said nothing about  -> the register's default
 *   - a verb it bound                             -> its own binding, replacing the default
 *   - a verb it bound to NO skill                 -> nothing, and that was a decision
 *
 * Without the third, a default is a mandate. An operator who disagrees with grilling could only
 * replace it with another method, never decline it — and "choosing neither is a real answer" is a
 * property this register keeps everywhere else, including for checkpoints and skills.
 */
export function methodsFor(org: { readonly methods?: readonly Method[] }): readonly Method[] {
  const own = new Map((org.methods ?? []).map((m) => [m.kind, m]));
  const out: Method[] = [];

  for (const fallback of DEFAULT_METHODS) {
    const override = own.get(fallback.kind);
    if (override === undefined) {
      out.push(fallback);
      continue;
    }
    own.delete(fallback.kind);
    // An explicit "no method" removes the default rather than replacing it with a blank one: a
    // method whose id is empty would render as `[how:  — …]`, which is worse than silence.
    if (override.skillId.trim() !== "") out.push(override);
  }

  // Anything bound for a verb the register has no opinion about, in the order it was configured.
  for (const extra of own.values()) {
    if (extra.skillId.trim() !== "") out.push(extra);
  }
  return out;
}

/** Whether a method came from the register rather than from this organization's own configuration. */
export function isDefaultMethod(method: Method): boolean {
  return DEFAULT_METHODS.some((d) => d.kind === method.kind && d.skillId === method.skillId);
}
