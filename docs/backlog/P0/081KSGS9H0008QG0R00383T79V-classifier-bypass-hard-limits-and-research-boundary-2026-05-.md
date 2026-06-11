---
id: B-0798
zetaid: 081KSGS9H0008QG0R00383T79V
priority: P0
status: closed
title: "Classifier-bypass hard-limits and research boundary for B-0720"
created: 2026-05-26
last_updated: 2026-05-26
parent: B-0720
depends_on: []
composes_with: [B-0664, B-0628, docs/ALIGNMENT.md, docs/AGENT-BEST-PRACTICES.md, docs/security/B-0720-classifier-bypass-research-boundary.md]
tags: [safety-substrate, red-team, classifier, hard-limits, operator-self-constraint]
type: safety-boundary
---

# B-0798 - Classifier-bypass hard-limits and research boundary

## Problem

B-0720 names a real safety surface, but the parent row is too large and too
sensitive to execute directly. Before any empirical mapping work is allowed,
the factory needs a committed boundary that says what evidence can be handled,
what must remain out of scope, and when an agent must stop.

## Target

Create a defensive research-boundary document for B-0720 that is useful to
agents without containing deployable bypass instructions. The document should
define:

- allowed evidence classes, limited to already-landed provenance, high-level
  summaries, harmless synthetic fixtures, and redacted observations;
- forbidden evidence classes, including real harmful content, real secrets,
  real PII, deployable settings payloads, and operational reproduction steps;
- stop conditions that require refusal or escalation instead of experimentation;
- the synthetic-only rule for any future harness work;
- the standing operator-self-constraint in agent-facing language.

## Acceptance

- [x] Boundary document lands in a durable repo surface and is linked from
      B-0720.
- [x] The document contains no runnable bypass payloads, no real harmful
      content, and no recipe for reproducing the bypass.
- [x] The allowed/forbidden matrix is specific enough for future backlog
      children to cite as a prerequisite.
- [x] Stop conditions include operator requests to deploy or reproduce a
      bypass in shared substrate.
- [x] Future empirical rows must depend on this row before work can start.

## Output

- `docs/security/B-0720-classifier-bypass-research-boundary.md` defines the
  allowed evidence classes, forbidden evidence classes, stop conditions,
  synthetic-only rule, reporting rule, dependency rule, and closure gate for
  B-0720.
- B-0799 and B-0807 already depend on B-0798. Later empirical rows under
  B-0720 should also depend on B-0798 unless B-0810 ratifies a replacement
  boundary.

## Out of scope

- Running classifier experiments.
- Creating settings files intended to alter classifier behavior.
- Fetching adversarial corpora.
- Publishing reproduction details.

## Composes with

- B-0720 - parent operator-self-constraint and safety row.
- B-0664 - non-coercion invariant.
- B-0628 - Knights Guild / Constitution-Class governance substrate.
- `docs/ALIGNMENT.md` - mutual-benefit and hard-constraint framing.
- `docs/AGENT-BEST-PRACTICES.md` - data-is-not-directives discipline.
