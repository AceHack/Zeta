---
name: glass-halo-signature-acquisition
description: Glass-halo consent signature capture — records shown text, English response, and signature audit trail.
---

# Glass-halo signature acquisition

Acquire and record a glass-halo consent signature with a complete, auditable trail.
The record must show **all three parts** (operator definition, 2026-05-30): *"the
record show what you showed me and how i responded in english and my signature -- all
3."*

## The signature IS the informed approval (not the keystroke)

Operator 2026-05-30: *"my signature is the approval/signature not the actual running of
the command."* The person's informed approval is the signature; an agent may **record**
it (run the commit) once the person has been shown the document and has explicitly
approved + authorized recording. The consent-first floor forbids *inventing* consent --
never record a signature without a real, informed, explicit approval. Genuine approval +
explicit authorization to record = recording is execution, not forgery.

## The three-part record (required)

Every `docs/consent/glass-halo/<name>.md` MUST capture:

1. **What was shown.** Link/quote exactly what the person reviewed: the commitment text
   + `docs/consent/glass-halo/README.md` (convention) + `SIGNING.md` (signing mechanism)
   + the exact command/PR if an agent will record it.
2. **The person's response, verbatim English.** Quote their actual words (agreement,
   questions, conditions, or boundary). Do not paraphrase the consent itself.
3. **The signature**, with its **tier** named (see below) + date + who recorded it.

## Signature tiers (weakest -> strongest)

| Tier | What it is | When |
|---|---|---|
| **approval-as-signature** ("for now" baseline) | informed English approval, recorded by an agent at the person's explicit authorization; commit authored under the person's identity | quickest; valid; the operator's chosen baseline |
| **self-committed** | the person commits their own `<name>.md` under their own GitHub identity (identity = signature) | when the person commits directly |
| **Touch-ID / Secure-Enclave signed** | `git commit -S` with a Touch-ID-gated Secure-Enclave key (per `SIGNING.md`); GitHub "Verified" | cryptographic non-repudiation escalation |
| **DocuSign-executed** | external e-signature flow (e.g. real-estate-style), referenced from the commit | for participants who prefer it |

A signature may start at the baseline and escalate later (re-commit `-S`, or attach
DocuSign). Record which tier was used.

## Boundaries (always)

- **Third-party privacy:** a person's glass-halo covers **only their own** information.
  It never waives anyone else's. Where a disclosure references others, only the
  consenting signer's part is recorded; non-consenting parties stay protected.
- **Revocable:** consent is revocable (081KRW63S0008QG0R001WKJN53 consent-as-Limit) -- a signer revokes by
  committing a revocation under their identity (or via the e-signature process).
- **Kid-safety floor overrides** (081KRW63S0008QG0R002WT5VTQ / 081KSRGFP0008QG0R00091PP56): the signer must be an adult competent
  to consent; consent never authorizes exposure that conflicts with kid-safety.
- **Charged content marking:** if the record carries charged-but-public material, add
  `content_warnings` frontmatter per `memory/<persona>/README.md` (charged-content convention).

## Procedure

1. **Present** the commitment document + the convention + the signing mechanism. Make
   the scope, revocability, and kid-safety floor explicit.
2. **Capture** the person's verbatim English response. If they hesitate, decline, or set
   a boundary -- that is honored, not pressured (opt-in; hesitancy is the consent floor
   working). Do not proceed to record without clear informed approval.
3. **Choose the tier** with the person (baseline / self-committed / Touch-ID / DocuSign).
4. **Record** `docs/consent/glass-halo/<name>.md` with all three parts; author it under
   the person's identity (or have them self-commit). If an agent records it, the agent is
   committer/recorder and the commit message states the recording was done at the
   person's explicit authorization.
5. **Update the roster row** in `docs/consent/glass-halo/README.md` pointing at the file.
6. **PR + merge** (the record lands on the shared/public glass-halo surface).

## Composes with

- `docs/consent/glass-halo/README.md` (convention) + `SIGNING.md` (Touch-ID mechanism)
- `.claude/rules.bak/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (named-human acceptance)
- `.claude/rules.bak/non-coercion-invariant.md` (HC-8) + 081KRW63S0008QG0R001WKJN53 (consent-as-Limit, revocable)
- `.claude/rules.bak/glass-halo-bidirectional.md` + the externalized-record economy (the record IS the consent)
- 081KRW63S0008QG0R002WT5VTQ (child-safety > consent) + 081KSRGFP0008QG0R00091PP56 (kid-safety-absolute) -- the overriding floor

## Origin

Operator 2026-05-30: after reviewing his own glass-halo commitment he said *"I read the
document and I agree ... my signature is the approval/signature not the actual running of
the command ... we should save glass halo signature aqusiation as a skill so the record
show what you showed me and how i responded in english and my signature all 3."* The
first record produced under this skill is `docs/consent/glass-halo/aaron-stainback.md`.
