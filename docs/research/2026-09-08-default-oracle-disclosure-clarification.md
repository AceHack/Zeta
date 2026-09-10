# Deliberate multi-oracle choice and conspicuous default use

Date: 2026-09-08 UTC
Operational status: research-grade change receipt
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

Aaron explicitly prefers multi-oracle choice and asks that an unchosen default
be made conspicuous so it is not accidentally treated as chosen. The additive
clarification in [MANIFESTO section 11](../governance/MANIFESTO.md#11-default-moral-regard-default-oracle)
records that unambiguous requirement in the existing specification surface.
The original section 11 prose and all other existing bytes remain unchanged.
This is a separate current-state clarification authorized by the user's
direction, not an automatic promotion of Otto's conceptual ferry.

Whenever an application uses the default without an explicit oracle choice,
it must make both facts prominent. It cannot record silence as an explicit
selection. Deliberate multi-oracle choice is preferred, and choosing an oracle
does not waive existing non-coercion, privacy, consent or protected floors.
No scalar ranking of moral positions or irreducible resource units is added.

The pending warning-versus-mandatory-selection question is deliberately
unresolved: a disclosure requirement alone neither permits fallback execution
nor requires a hard stop. The [bounded interface census](2026-09-08-moral-oracle-disclosure-interface-review.md)
found no operational moral-oracle selector to patch in its inspected scope.
No runtime chooser, UI warning, acknowledgement record or enforcement test
has therefore been implemented by this documentation change. An actual
application must still define and test that owned interface before claiming
it enforces the requirement.

This composes with the [HC-8 explanatory correction](2026-09-08-hc8-default-oracle-explanation-correction.md).
That correction preserves the operative non-coercion paragraph; this additive
section 11 clarification makes the user's preference and disclosure requirement
discoverable without altering the existing default moral baseline.

The [independent clarification review](2026-09-08-default-oracle-clarification-independent-review.md)
accepts the exact additive scope and verifies that removing the nine new
lines restores every byte of the original specification. Its audit and
source-cut identities are preserved alongside the review.
