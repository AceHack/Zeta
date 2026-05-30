/**
 * Org-decision primitive — the observe→decide kernel applied at organizational
 * scope. Determinism computes the LEGAL option set (what an authority is allowed
 * to choose); an agent chooser picks within it; the pick is clamped to the legal
 * set so the agent can never escape the rules. This is "enough determinism,
 * agents drive outcomes" for priority, supply, assignment, and gate decisions.
 */

export type OrgChoice<T> =
  | { outcome: "chosen"; option: T; reason: string }
  | { outcome: "no_legal_option"; reason: string };

/**
 * An agent chooser: given the legal options and a context string, returns the
 * index it wants and its reason. The index is CLAMPED to the legal range, so a
 * chooser (deterministic or model-backed) can never select outside the rules.
 */
export type OrgChooser<T> = (legal: readonly T[], context: string) => { index: number; reason: string };

export function chooseWithinLegal<T>(legal: readonly T[], context: string, chooser: OrgChooser<T>): OrgChoice<T> {
  if (legal.length === 0) {
    return { outcome: "no_legal_option", reason: `no legal option for: ${context}` };
  }
  const pick = chooser(legal, context);
  const idx = Math.max(0, Math.min(legal.length - 1, Math.trunc(pick.index)));
  const option = legal[idx];
  if (option === undefined) {
    return { outcome: "no_legal_option", reason: `clamp failed for: ${context}` };
  }
  return { outcome: "chosen", option, reason: pick.reason };
}

/** Deterministic baseline chooser: always take the first (highest-priority) legal option. */
export function firstLegalChooser<T>(): OrgChooser<T> {
  return (legal) => ({ index: 0, reason: `deterministic: first of ${legal.length} legal option(s)` });
}
