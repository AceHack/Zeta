# Guarded controller: finite outer-negative design review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Reviewed source: `7da46c7f1d2aea9fb4ee721aeb9fd34a7c438681`
Disposition: design accepted; implementation and actual conformance pending

The reviewer read the [outer-negative design](2026-09-07-hidden-switch-compiled-outer-negative-design.md)
and its corrections against the frozen protocol and existing semantic
falsifier contract. No checker implementation, policy/source call, guard
computation, native execution, test or measurement was performed by this
reviewer. This review belongs to the new compiled study and changes no
scientific model, seed, schedule, threshold or archive.

## Retained findings and resolution

The initial byte-substitution examples changed semantically constrained Role
or Payload fields. Those examples could fail without exercising the intended
complete-byte hash boundary. The accepted variants leave the decoded replay
tree unchanged, using leading whitespace or an escaped existing key. They
must fail at the retained original expected byte binding. An executed mutant
that omits only that check must incorrectly accept both, and the witness
checker must reject those actual acceptances.

Initial prose did not uniquely specify the call count for composite controls,
storage setup and Python child/helper work. The exact operation/role table now
defines 136 case-level calls across 92 cases. Four additional executed mutant
and witness-checker operations have a named, separately bound audit artifact;
all four are independently replayed. They are excluded only from the named
case-level counter, not from evidence or conformance requirements.

A working-draft chronology imposed an order between producer output closure
and process exit. The review's initial exit-before-closure example preceded
the first source pin; `05ef2a04fca26f0fb2bb1750d634bcc123ac8168` already used
the reverse order. The material issue was the unnecessary total order. The
accepted design requires behavior finish before both events and both before
cost startup, without ordering closure against exit. Coordinator observations
remain distinct from the producer's closure event.

## Accepted boundary

The 92 cases span certificate, complete semantic, strict-selector, JSON,
artifact, Git source, actual Python loader, storage, byte/link chronology,
choice-buffer, schedule and resource domains. Positive controls precede their
specified mutations. Unexpected success, a wrong early refusal, timeout or
missing result cannot count as the required negative. Prefix counts derive
from the actual ordered completed operations, with source/input and prior
result retention required on later failure.

Eight standalone prerequisites keep the evidence graph acyclic. The proposed
six-member semantic replay API checks the existing complete slices and semantic
members without manufacturing an outer descriptor. Final hand admission must
bind those same members, the completed outer envelope and its actual descriptor.
The additional byte-mutant audit does not refer back to the final hand or outer
envelope. Raw source and native result artifacts remain distinct from copied
summaries or asserted pass flags.

No material design finding remains at the reviewed source. Actual call-site
implementation, independent replay and failure fixtures still need source and
evidence review. Native executing-graph/runtime admission and the final actual
hand/certificate/behavior/cost/replay/verdict byte chain remain two separate
mandatory obligations. Finite mutation coverage does not prove either one.
