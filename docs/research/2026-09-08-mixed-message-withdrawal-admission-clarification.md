# Conservative learned-artifact admission after evidence withdrawal

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation clarification
Lifecycle: active
Status: explicit admission proposal; source implementation and review pending
Work item: 081M1Z63YMC087G0R003N5FH9X

## The missing ancestry carrier

The [source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
section 3 and M7 require a withdrawn training row to invalidate dependent
learned artifacts. Its compact SelectedVersions record carries the full artifact
but only a TrainingCut hash. The
[transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md)
restricts retained compensation history to a query. Neither supplies complete
training ancestry to an arbitrary fresh query owner.

The bridge's actual sealed training sessions can establish some local ancestry
from their full cuts, RowIds, child forecasts and returned artifacts. They do
not provide a general imported ancestry registry, and the fixed four-session
M5 route cannot gain a fifth session. At bridge source `4402be8a7121f2f1609d4a7213d7ba7d3e3e65ee`,
the existing source admission does not enforce training-withdrawal invalidation.
This is an implementation gap, not evidence that hashes establish independence
or that the bridge already owns an operational revocation mechanism.

## Bounded rule for this cycle

Use a conservative refusal while ancestry is unavailable. When the supplied
current EvidenceCut has any Retractions, refuse reuse of selected learned
artifacts, retained learned weights, or learned child forecasts in that epoch.
This invalidates a superset of possible descendants; it does not identify the
minimal affected set or certify that an unrelated artifact remains valid.

Concretely, current-cut Retractions require empty SelectedVersions and empty
InitialState.Weights. A query or compensation therefore cannot reuse a neural
node's frozen artifact. A compensation's retained query must also have empty
SelectedVersions and no learned weights in its supplied retained/checkpoint
state. Existing complete-plan correspondence and query-only history admission
still apply; changing the historical plan cannot erase a dependency.

Training under that cut must have empty ChildCuts and ChildForecasts. Every
training row remains explicitly active and outside Retractions, with the
existing availability, split and fixed-initializer checks. No old parameter
vector supplies initialization. ParentVersion may remain a publication
precondition/history reference; it does not authorize a warm start or reusing
its data-dependent weights. New training is a separately budgeted new artifact,
not an inverse update and not a refund of prior work.

All cuts must keep ActiveIds disjoint from Retractions. Pure contribution/site
compensation with no learned-artifact reuse remains available through the
existing applied-revision/checkpoint/replay mechanism. Existing caps, operations,
wire keys, evidence rows and fixed M4/M5/frozen-query inputs do not change.
The registered controls contain no withdrawal and therefore gain no new fit
or process session from this clarification.

The rule applies to the supplied current cut. It is not global historical
revocation across independent callers, proof that an external producer has
disclosed every withdrawal, or a new current-state registry. Historical records
remain retained. Selective post-withdrawal reuse needs a separately reviewed
complete ancestry carrier and is outside this cycle; absent that carrier the
caller receives a refusal rather than an invented ancestry verdict.

## Required discrimination and preservation

Core and bridge must enforce the same boundary before numerical entry. Retain
the current behavior and subsequent controls for affected selected artifacts,
retained weights, child forecasts/cuts and active/retracted overlap. Keep a
cold-start training control on active nonretracted rows and a pure query
compensation control. Refusal of inverse SGD alone does not satisfy M7.

Include this unchanged clarification in the final registered SourceFiles and
independent admission. Bind the repaired code separately and preserve the
earlier source and observed failures. The original contract/amendment remain
unchanged; this document narrows admitted reuse without claiming selective
invalidation or an executed control result.
