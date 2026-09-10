# Pre-result clarification: exact receipt fixtures and authentication

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Parent protocol: [2026-09-06](2026-09-06-protocol.md), commit `4f470f40e`

This clarification precedes the first panel execution. Independent review of
the first kernel draft found two implementation defects and underspecified
fixture details. Retain both defects as regression cases and include the
review findings in the result record.

1. All attestation capabilities must bind the required signer `Actor` and
   the exact canonical receipt contents. There is no separate signer field;
   `Accepted` cannot merely mean that some key signed something. Parent IDs
   are a set, deduplicated and sorted ordinally before authentication.
   Attestation encoding itself is excluded from the invariant. A fixture token
   is valid only for the exact actor/content pair listed in the frozen table.
2. A repeated receipt's causal position is the minimum position among its
   authenticated local occurrences. Adding an earlier purported occurrence
   still has to satisfy every disclosed parent constraint; a replay before
   its parent is refused. Count identical canonical receipts as replays.
   Different authenticated contents under the same event ID are forks, not
   replays. A duplicate event ID alone must not inflate the replay count.
3. When authenticated variants fork, boundary-parent diagnostics use the union
   of their parent sets. Selecting the first variant made those diagnostics
   depend on arrival order. The conflict status takes priority, and there is
   no canonical invariant for a conflicting cut.
4. The origins `-1000,0,1000` and scales `1,7` apply to clock coordinates.
   Transported positions use `p -> 3p+5`, preserving the kernel's nonnegative
   position domain. Composition tests additionally use `p -> 7(p+3)` and
   `t -> 5(t+11)`. The entropy panel fixes `Z` to a constant, identity order
   `(X1,X2,X3)`, and all three proposed conditional bounds to one bit.
5. The exact four-event diamond, attestation tables, attack mutations, input
   bit streams, CHSH rounds, and signature-only baseline will be preserved in
   `RelationalIdentityExperiment.fs` and the independent Python checker on
   an immutable source archive ref before any panel runs. The result will
   record that ref and content hashes. This supplies fixture specificity
   without selecting cases after seeing an outcome.

The registered stop rule, graph sizes/costs, prediction-lane separation,
unknown-coverage behavior, and evidence boundaries are unchanged. The
multiplier remains the accounting identity `M=1+R/B`, with stipulated work
costs, not an empirical estimate of adversarial hardness.

## Conditional innovation wording

The protocol's fair-innovation example requires fairness and mutual
independence **conditional on `Z`**, or joint independence of the innovations
from `Z` in addition to mutual independence. Unconditional independence alone
does not suffice: `Z=(X1,X2,X3)` reveals every bit. The pointwise conditional
proposition already states the correct premise; the registered fixture fixes
`Z` constant, so this clarification changes no fixture or bound.
