// full-ai-cluster/platform-controller/src/policy.ts
//
// The "who decides" engine — no-directives made executable. An agent's intent to
// act is classified into a domain + (maybe) a gated class; the Policy maps that
// to one of three autonomy levels: auto (standing authority), propose (emit an
// authorization-request, wait for a human grant), or forbidden (human-only).
//
// Source != authorization (.claude/rules/no-directives.md): WHO proposes an
// action grants zero authority; only the autonomy level + a human grant on gated
// classes confers it. A gated class ALWAYS escalates above `auto`, even when the
// domain would otherwise be auto — least-privilege by construction.
export const GATED_CLASSES = ["budget", "non-reversible", "wont-do", "hard-limits", "force-push", "external-repo"];
const HARD_FLOOR = new Set(["wont-do", "hard-limits"]);
/**
 * Decide the autonomy for an action under a Policy.
 * Rules, in order:
 *   1. Unknown domain → forbidden (fail-closed; least privilege).
 *   2. domain=forbidden → forbidden.
 *   3. A gated class on the action escalates: hard-floor (wont-do/hard-limits) →
 *      forbidden; any other gated class → propose (needs a fresh human grant),
 *      EVEN IF the domain is `auto`. A gated class can never run on standing authority.
 *   4. Otherwise the domain's autonomy stands.
 */
export function decide(policy, action) {
    const dom = policy.domains.find((d) => d.name === action.domain);
    if (!dom)
        return { level: "forbidden", reason: `unknown domain "${action.domain}" — fail-closed` };
    if (dom.autonomy === "forbidden")
        return { level: "forbidden", reason: `domain "${action.domain}" is human-only` };
    if (action.gated) {
        if (!policy.gatedClasses.includes(action.gated)) {
            // A gated class the Policy doesn't even list is treated as gated anyway —
            // never silently downgrade a non-reversible/budget/etc. action to auto.
        }
        if (HARD_FLOOR.has(action.gated)) {
            return { level: "forbidden", reason: `gated class "${action.gated}" is a hard floor — human-only` };
        }
        return { level: "propose", reason: `gated class "${action.gated}" requires a fresh human authorization`, gated: action.gated };
    }
    if (dom.autonomy === "auto")
        return { level: "auto", reason: `domain "${action.domain}" runs on standing authority` };
    return { level: "propose", reason: `domain "${action.domain}" requires a proposal` };
}
/** Convenience: does this action run without waiting on a human? */
export function isAutonomous(policy, action) {
    return decide(policy, action).level === "auto";
}
