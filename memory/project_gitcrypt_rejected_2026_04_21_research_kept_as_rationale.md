---
name: git-crypt REJECTED 2026-04-21 — research kept as the rationale artifact
description: Aaron rejected git-crypt for Zeta secrets after reading the cartographer pass; the research stays as the durable "why we said no" so future-self doesn't re-ask. Encoded in WONT-DO + BACKLOG + research-doc banner.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Decision (2026-04-21):** git-crypt is **out** of Zeta's
candidate set for gitops-friendly secrets management. Three
Zeta-values-level mismatches, not mere trade-offs:

1. **No access revocation.** Upstream explicit: every user
   with the key has every historical version forever. Core
   mismatch with retraction-native (Value #4 in
   `docs/CONFLICT-RESOLUTION.md`).
2. **Binary diffs break code review.** Reviewers cannot
   tell a key rotation from a key theft.
3. **Metadata leak by design.** Filenames, commit messages,
   symlink targets, `.gitattributes` layout — all in
   plaintext. Encryption only covers file contents.

`git-secret` ruled out by sibling reasoning (same OpenPGP-
GPG base, same no-revocation property, same binary-diff
problem). **Remaining candidate set for the eventual ADR:**
SOPS (KMS / Vault / age backend — plaintext-keys / encrypted-
values renders review-grade diffs; external KMS enables clean
rotation) and `age` (modern X25519 + scrypt; draft PQC profile
for future hybrid readiness).

**Why:** Aaron after reading the research:

- *"git crypto no go i read your initial review"* — the
  decision.
- *"keeep the reserach"* — don't delete the 250-line
  cartographer pass.
- *"so i don't ask you tomorrow"* — the durable rationale
  artifact prevents re-litigation.

**Encoded across three artifacts in PR #38:**

1. `docs/WONT-DO.md` — new entry *"git-crypt for secrets
   management"* under **Engineering patterns** (after Sakana
   AI Scientist, before Repo/process divider). Decision date
   + proposal + three why-nots + revisit-when (effectively
   never — architectural constraints, not missing features).
2. `docs/BACKLOG.md` — P2 row *"Gitops-friendly key
   management + rotation"* narrowed to SOPS + age. "Research
   inputs" block retitled to *"Candidate set after
   2026-04-21 decisions"* + *"Research inputs (rationale
   kept, decision recorded)"*.
3. `docs/research/git-crypt-deep-dive-2026-04-21.md` —
   REJECTED banner at the top so future-self sees the
   decision before reading the 250-line research. Status
   field updated from "Proposed" to "REJECTED 2026-04-21".

**Pattern captured — "research-as-rationale artifact":**

When a cartographer pass ends in rejection, the right move is
**not** to delete the research. The research IS the rationale.
It becomes a durable "why we said no" artifact:

- Banner at the top of the research doc (not buried in the
  conclusion).
- Cross-linked from `docs/WONT-DO.md` as the long-form
  explanation.
- Cross-linked from the BACKLOG row that triggered it.
- Future-self's first question is already answered.

This is a generalisation of the mini-ADR pattern Aaron
validated at
`memory/feedback_decision_audits_for_everything_that_makes_sense_mini_adr.md`
— the decision audit lives **on the artifact that drove the
decision**, not in a separate ADR repo.

**How to apply:**

- After every cartographer / research pass that ends in
  rejection, add a REJECTED banner at the top with the user's
  quote that made the call.
- Keep the research; do not delete it.
- Cross-link from the policy doc that now holds the decision
  (WONT-DO.md or ADR) and from the BACKLOG row that triggered
  the research.
- Narrow the BACKLOG row's candidate set rather than rewriting
  it; the rejected candidate stays listed with a strike-
  through or explicit "REJECTED YYYY-MM-DD" so the trail is
  visible.

**Scope:** `factory` — the rationale-artifact pattern applies
to every research pass, not just security / crypto ones.
