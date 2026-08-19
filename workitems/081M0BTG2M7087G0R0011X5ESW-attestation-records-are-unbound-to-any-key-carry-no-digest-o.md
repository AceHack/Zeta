---
id: 081M0BTG2M7087G0R0011X5ESW
type: bug
state: backlog
priority: P2
slug: attestation-records-are-unbound-to-any-key-carry-no-digest-o
title: "attestation records are unbound to any key, carry no digest of what they attest, and their derived id is never recomputed"
created: 2026-08-19T01:34:43.847Z
depends_on: []
composes_with: [081M0BTTM85087G0R003X6TWCD]
---

# attestation records are unbound to any key, carry no digest of what they attest, and their derived id is never recomputed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0BTG2M7087G0R0011X5ESW-*.md` glob. -->

## The finding

Three verdict-for-evidence substitutions in one record, in
`src/Core.TypeScript/observe/emit-attestation.ts` and
`src/Core.TypeScript/observe/attestation-event.ts`.

1. **The attestor was a plain string.** `process.env.ZETA_AGENT_ID ?? "alexa"`,
   overridable by `--attestor`, copied straight into `by:`. Nothing bound it to a
   key, so any process able to write into `docs/observe-events/` could mint an
   attestation from any persona.
2. **The claim carried no evidence.** `claim: "heartbeat-genuine"` was documented
   as "I verified these events are genuine". What the producer did was list a
   directory, `JSON.parse`, and check that `by`/`at` were strings. The record
   carried `eventCount` and a window and no digest of the events attested, so a
   later verifier holding the same set could not tell whether the attestation
   referred to it. A count is not an identification.
3. **The derived id was never recomputed.** `deriveAttestationId` existed and was
   correct; the only check anyone ran was `^[0-9a-f]{32}\.json$` — a shape check
   standing in for a value check — so one actor could write N self-attestations
   under N arbitrary ids and defeat the G-set dedup the derivation exists to give.

## Relationship to PR #12243 / 081M0BTTM85087G0R003X6TWCD

That work bound `agent-reviewer.yml`'s approval claim to the events it approves,
and recorded honestly that its exemption for the workflow's own appended receipt
is **a shape match, not an authenticity check** — a producer can write those
bytes — naming the unforgeability gap rather than papering over it.

This work-item is the follow-on to exactly that gap, on the record side: a
canonical form, a digest that names the attested set, a recomputed id, and an
SSHSIG binding to a key the producer does not hold. The argument for why a shape
match is not authenticity is not re-derived here; it is made there.

## It is not hypothetical

Pointing the new verifier at the committed corpus found **eleven attestation
records whose attestor or participant is a filesystem path** —
`/tmp/attest-0rHTQr`, `/tmp/attest-4EC3oi`, `/tmp/attest-hqFnhO`: `mkdtempSync`
fixture directories leaked from this module's own end-to-end tests, written by a
real run and merged to `main` on 2026-08-17 (heartbeat batch #11689). Three
personas that do not exist and never could now permanently attest `alexa` and each
other, worth 3 distinct attestors, ~4.58 strength, and `hasTrioAttestation: true`
to any fold that reads them.

Accident, not attack — and to every check that existed, the same event. Worse than
a fixed fake name: `mkdtempSync` mints a FRESH path per run, so each run produces a
NEW apparent witness. That is a Sybil count anyone can mint for free, arrived at by
accident.

**Counts, reconciled** (verified against `origin/main` 3465e2fc57): **6** records
where `attestor` is a path, **6** where `attested` is a path, **2** where only a
`simultaneousParticipants` entry is — **11 distinct files**, the sets overlapping.
Both the "6" and the "11" are correct; they count different fields.

**One secondhand claim did NOT reproduce.** `src/Core.TypeScript/observe/self-claims.ts`
was reported to fold `distinctAttestors` from the attestor field. It does not:
`distinctAttestors` occurs only in `attestation-event.ts` and its own test, and
`self-claims.ts` contains no reference to attestations at all
(`git grep -n distinctAttestors origin/main`). The ranking below is therefore
unchanged, and is deliberately not inflated.

## Blast radius, stated honestly

No production code consumes `summarizeAttestations` today; only tests import it.
The CURRENT damage is a polluted event log, not a bypassed gate. It is worth
fixing now precisely because `totalStrength` / `distinctAttestors` /
`hasTrioAttestation` are built to be folded into trust later, and every field of
that summary was forgeable by one actor.

## The fix

- `attestation-record.ts` (new, pure) — `attestedEventsDigest` over the sorted,
  deduplicated id set; `verifyAttestationId` recomputing the derived id;
  `attestationSigningBytes` (enumerated, length-prefixed, never JSON); a
  persona-KEYED roster so a key may only speak as its own persona; three-state
  verdict (`bound` / `unbound` / `refused`) with no `ok` boolean to fall through.
- `verify-attestation-events.ts` (new, CLI) — recursive persona-roster discovery
  over `maintainers/**/ssh-pubkeys.txt`, record loading by `kind`, and a `message`
  subcommand that prints canonical bytes for `ssh-keygen -Y sign`.
- `attestation-event.ts` — `attestedDigest` required; `summarizeAttestations` now
  takes records paired with their binding verdict and folds BOUND ones only.
- `emit-attestation.ts` — computes the digest, self-checks its own derived id, says
  on every write that the record is UNBOUND, **refuses to run at all when
  `--attestor` is not a persona name** (fail closed), and **skips peers whose `by`
  is not a persona name** so a path never becomes an `attested` or a participant.
  That last pair is the guard that needed no cryptography and did not exist.

## What `distinctAttestors` must be recomputed from

COUNTS distinct attestor personas whose signature verified against a key committed
for THAT persona. The scarcity is key custody plus the roster — both held by other
parties. It MUST NEVER count distinct STRINGS: varying a string is free, which is
how three temp directories became three apparent witnesses. Written into the field's
doc comment so the wiring, when it happens, cannot be wired to the forgeable version.

## Proposed disposition of the 11 polluted records — NOT decided here

**Leave and annotate.** Not deleted, not rewritten. They are real recorded facts
about what this system did, and Memory Preservation (manifesto §5) applies to
embarrassing history too — the same call `audit-observe-event-filenames.ts`
`FROZEN_LEGACY_NAMES` made about the three hex-JSON filenames.

What is implemented: they are pinned by name in
`verify-attestation-events.test.ts` and asserted to be REFUSED, so they serve as
the falsifier for the persona gate. Nothing is mutated.

What is NOT implemented, deliberately: emitting retraction events. Retraction as a
recorded correction is the right shape and beats erasure, but writing nine or
eleven `-1` facts into the shared log is a decision about the ledger rather than a
fix to this defect, and it belongs to whoever owns that call.

## Deliberately NOT done

**No private key is created, handled, or required.** The signing step is designed
and stopped: `message` emits the bytes, a key holder signs them elsewhere. The
consequence is that the `bound` accept path is exercised with a stub verifier
while every signature REFUSAL path runs against a real `ssh-keygen -Y sign` blob;
that split is stated at the top of `attestation-record.test.ts` rather than
papered over.

Not wired into CI. The gate belongs in `.github/workflows/agent-reviewer.yml`,
which was being edited concurrently in another lane.

The 368 legacy records refuse as `missing-digest` and the 11 leaked-fixture ones as
`malformed-attestor` / `malformed-participants`. None are deleted — they are real
recorded facts (Memory Preservation, manifesto §5), pinned as the falsifier.
