---
id: 081M0DK2TXD087G0R003674BAS
type: task
state: backlog
priority: P2
slug: policy-fs-has-one-instance-and-no-trust-interpreter-the-node
title: "Policy.fs has one instance and no trust interpreter -- the node-local trust policy evaluator is the missing decision layer"
created: 2026-08-19T18:03:38.797Z
depends_on: []
composes_with: []
---

# Policy.fs has one instance and no trust interpreter -- the node-local trust policy evaluator is the missing decision layer

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DK2TXD087G0R003674BAS-*.md` glob. -->

**Finding, `docs/research/2026-08-19-draft-the-distributed-identity-server-inventory-of-existing-pieces-the-witnessed-self-claim-spine-and-verification-routing.md` §3 G7.**

Aaron 2026-08-19: *"each node has local OPA like policy trust, we have policies mathematically modeled as well."*

The mathematics ships. The model does not. `src/Core/Policy.fs` says so in its own docstring:

> *"This kernel proves the generic `Policy` with exactly ONE instance — XML structure-selection (`DynamicValueXmlPolicy`). It does NOT yet build trust / retry / routing interpreters."*

**What exists:** the profunctor kernel `Policy<'i,'d,'f> = 'i -> { Decision; Feedback }`, total, selects-never-mutates, covariant in the decision and contravariant in the input, with a typed why-channel — explicitly designed so a policy cannot degenerate into a magic authority blob.

**What is missing:** the trust interpreter, and with it the three metered decision classes Aaron names, none of which has a policy instance today:

1. what data I **share** with you;
2. whose **computation** I permit to run on **my** hardware;
3. whose **data** I agree to **store** on **my** hardware.

All three are consent surfaces (manifesto §6), evaluated node-locally, with the crossing metered at the node's own membrane (§13 noninterference; `RoomAdmission` + `GlassHalo.RoomBoundary` is the existing membrane shape).

**Adjacent decision, deliberately not filed as verification work (§3 G8):** OPA/Rego is a wrapped external dependency (row `081KSE6WT0008QG0R002275NDE`) and nothing reconciles Rego's evaluation semantics with this kernel's. If a node's verdict can come from either, there are two policy semantics and no statement of which wins. That is an architecture call, not a proof obligation.
