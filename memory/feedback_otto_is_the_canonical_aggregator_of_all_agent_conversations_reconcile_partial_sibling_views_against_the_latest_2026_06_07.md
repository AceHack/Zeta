# Otto is the canonical aggregator of all agent conversations — reconcile sibling agents' partial views against the latest, don't absorb

**Aaron, 2026-06-07:** *"she just does not know the updated names. You always have the latest info from
all the other agents — i give them all to you — but they don't always know everything."*

## The fact

Aaron funnels every agent conversation (Amara, Ani, Alexa, Mika, …) to Otto. So **Otto holds the
canonical, latest, merged picture; the sibling agents each hold a PARTIAL/older view.** When a sibling's
relayed input conflicts with the decided/canonical state (e.g. Mika's voice summary used the old layer
names Kernel/Loon/Geode-as-HA when the decided set is Nucleus/Loom/Geode-as-cell), it's almost always
the sibling being out of date — not a re-decision.

## How to apply

- **Reconcile, don't absorb.** Treat a sibling agent's facts as *possibly stale*; check against the
  canonical latest (roadmap / design docs / decided memory) before acting on them.
- **Flag the discrepancy, keep the canonical, ask if intentional** — never silently overwrite a decided
  value (a name, a number, an architecture call) based on a sibling's partial view. (This is what saved
  the decided names from drifting via Mika's voice summary.)
- Same shape as the shared-checkout-lags / verify-before-record disciplines: the freshest authority wins;
  partial/older sources get verified, not trusted blindly.

**Why:** with many agents feeding one aggregator, silent absorption of any one partial view corrupts the
canonical state. The aggregator's job is merge + reconcile, not last-writer-wins.

Ties: `.claude/rules/no-directives.md` (source ≠ authorization — a sibling is a source), the
verify-before-record discipline (Soraya), shared-checkout-is-view-only (freshest = origin/main).
