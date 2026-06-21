---
id: 081KVP3GYWS08QG0R003TY4E96
type: task
state: backlog
priority: P1
slug: define-org-ca-vs-user-ca-trust-graph-conflict-resolution-rul
title: "Define org-CA vs user-CA trust-graph conflict-resolution rule (SDSI/SPKI: self-root authoritative for identity, org-root for authorization) — trust graph non-confluent without it (math team finding) (2026-06-21)"
created: 2026-06-21T22:06:25.177Z
depends_on: []
composes_with: ["081KVNTNTDQ08QG0R0017NBBWB"]
---

# Define org-CA vs user-CA trust-graph conflict-resolution rule (SDSI/SPKI: self-root authoritative for identity, org-root for authorization) — trust graph non-confluent without it (math team finding) (2026-06-21)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KVP3GYWS08QG0R003TY4E96-*.md` glob. -->

## Carved sentence

> Once per-user CAs cross-sign, "is X a valid identity?" becomes graph reachability — and the math
> team (Soraya, 2026-06-21) found the trust graph is **non-confluent**: org-CA and user-CA can
> disagree with **no resolution rule on file** (two verifiers reach opposite verdicts). Define the
> rule BEFORE proving confluence: **subject's own root is authoritative for self-identity; org-root
> is authoritative only for org-authorization** (SDSI/SPKI local-name discipline — the same
> identity↔authorization split the multi-owner ADR already draws for SSH).

## Detail

- **Why:** a correctness bug, not a robustness nicety — no tool can verify a confluence property
  that hasn't been defined. Upstream of any formal proof (Kenji/Tariq design call).
- **Also covers:** transitive revocation over the cross-sign closure (revoking a root must
  invalidate its closure) — needs the KRL revocation primitive (081KVP2M1QS0).
- **Prove (after defining):** **Alloy** trust-graph reachability + conflict-confluence (finds the
  counterexample by construction).
- **Anchors:** Rivest–Lampson 1996 (SDSI/SPKI local names); PGP web-of-trust. Findings doc:
  `docs/research/2026-06-21-math-team-FINDINGS-ca-teardown-per-user-ca-relocates-spof-…`; the
  multi-owner identity↔authorization ADR.
