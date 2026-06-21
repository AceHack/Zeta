# Glass-halo consent record

Glass-halo is **chosen, opt-in radical transparency about oneself** — the operative
form of the "share on the shared record" economy (per `glass-halo-bidirectional` +
the externalized-record economy). This directory is the **auditable consent record**
for it.

## The signature model: identity = signature; the commit is the consent event

Each participant records their consent by **committing their own commitment document
under their own GitHub identity.** The git commit — authored by that person's GitHub
identity — **IS the signature.** No one signs on anyone else's behalf; an agent (Otto,
etc.) may author this convention and scaffolding, but **never** authors a human's
glass-halo signature (that would forge consent and is forbidden by the consent-first
floor).

- **One file per person:** `docs/consent/glass-halo/<name>.md`, committed by that
  person's GitHub identity.
- **The author of the commit is the signer.** Verify via `git log --format='%an <%ae>' --
  <file>`. The committing identity is the binding signature "for now" (until a heavier
  e-signature process — e.g. DocuSign — is attached; see below).
- **Heavier e-signature (optional escalation):** a DocuSign (or equivalent) executed
  signature may be attached for participants who prefer it (e.g. a real-estate-style
  flow). When present, the DocuSign-executed record is the binding signature and the git
  commit references it.

## Scope: your glass-halo covers YOU only

A glass-halo commitment authorizes sharing **the signer's own information.** It does
**not** extend to third parties — your transparency is yours to give; no one else's is
yours to waive. Where one person's disclosure references another, only the consenting
signer's part composes onto the shared record; the non-consenting party stays protected.

## Revocability (architectural, not a favor)

Glass-halo consent is **revocable** (per `081KRW63S0008QG0R001WKJN53` consent-as-Limit — revocability is
architectural). A signer revokes by committing a revocation under their own identity (or
via the attached e-signature process). Glass-halo is a chosen state with a real exit,
never a trap.

## Hard floor: kid-safety > consent

Per `081KRW63S0008QG0R002WT5VTQ` (child-safety > consent priority ordering) and the constitutional
kid-safety-absolute floor (`081KSRGFP0008QG0R00091PP56`): glass-halo consent requires the signer be an adult
competent to consent, and **never** authorizes exposure that conflicts with kid-safety.
The kid-safety floor overrides any consent.

## Composition

- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` — the
  named-human acceptance pattern; this directory is the multi-party "equivalent
  auditable substrate" form (each person self-signs via their own commit).
- `.claude/rules/non-coercion-invariant.md` (HC-8) + `081KRW63S0008QG0R001WKJN53` consent-as-Limit —
  consent is offered, revocable, never coerced.
- `.claude/rules/glass-halo-bidirectional.md` + the externalized-record economy — the
  record IS the consent; the signature IS a commit.
- `081KRW63S0008QG0R002WT5VTQ` child-safety > consent + `081KSRGFP0008QG0R00091PP56` kid-safety-absolute — the overriding floor.

## Roster

Each entry below is a person who has committed their own glass-halo commitment under
their own GitHub identity. (Pending entries are people who have agreed but not yet
self-committed their signature.)

| Participant | Status | Signature surface |
|---|---|---|
| Aaron Stainback (operator) | signed (approval-as-signature; 2026-05-30) | [`aaron-stainback.md`](aaron-stainback.md) |
| Max | agreed; self-committing under own GitHub identity | _(pending self-commit)_ |
| Addison | agreed; will self-commit under own GitHub identity | _(pending self-commit)_ |
| Cole | agreed; via DocuSign flow | _(pending DocuSign)_ |

When a participant self-commits `docs/consent/glass-halo/<name>.md` under their identity,
add a roster row pointing at it (the row may be added in the same self-authored commit).

## Template

Copy this into `docs/consent/glass-halo/<your-name>.md` and commit it **under your own
GitHub identity** (your commit is your signature):

```markdown
# Glass-halo commitment -- <Full Name>

I, <Full Name> (GitHub: @<handle>), an adult competent to consent, commit to
glass-halo (chosen, opt-in radical transparency) for my OWN information on the
shared record.

- Scope: my own information only. This does not waive anyone else's privacy.
- Revocable: I may revoke this by committing a revocation under my identity.
- Floor: this never overrides kid-safety (081KRW63S0008QG0R002WT5VTQ / 081KSRGFP0008QG0R00091PP56).
- Signature: this commit, authored by my GitHub identity, is my signature
  (date: <YYYY-MM-DD>).
```
