/**
 * attestation-record.ts — the canonical form of a peer attestation, and the only
 * place that decides whether one is BOUND to a key.
 *
 * Work-item 081M0BTG2M7087G0R0011X5ESW. PURE: no fs, no git, no process, no clock —
 * the filesystem binding lives in `verify-attestation-events.ts`, exactly as
 * `hygiene/build-receipt.ts` splits from `hygiene/verify-build-receipt.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS WRONG — three verdict-for-evidence substitutions in one record
 * ---------------------------------------------------------------------------
 * An attestation event used to be a JSON object with an `attestor` string in it.
 * That string came from `process.env.ZETA_AGENT_ID ?? "alexa"`, overridable by
 * `--attestor`, and was copied straight into `by:`. Nothing bound it to anything.
 * So:
 *
 *   1. NO IDENTITY. Any process able to write into `docs/observe-events/` could
 *      mint an attestation from ANY persona. The `by` field was a self-claim
 *      wearing the costume of an attribution.
 *   2. NO EVIDENCE. The claim `heartbeat-genuine` was documented as "I verified
 *      these events are genuine". What the producer actually did was list a
 *      directory, `JSON.parse` each file, and check that `by`/`at` were strings.
 *      The record carried `eventCount` and a window — a COUNT, which is not an
 *      identification (`.claude/rules/numerology-vs-number-theory.md`) — so a
 *      later verifier holding the same events could not tell whether the
 *      attestation referred to them.
 *   3. NO DEDUP. `deriveAttestationId` existed and was correct, but the only
 *      check anyone ran was `^[0-9a-f]{32}\.json$` — a SHAPE check standing in
 *      for a VALUE check. The id therefore need not derive from anything, and one
 *      actor could write N self-attestations under N arbitrary ids, defeating the
 *      G-set idempotency the derivation exists to provide.
 *
 * This module fixes (2) and (3) outright and supplies the VERIFICATION half of
 * (1). It deliberately supplies no signing half — see "NO PRIVATE KEY" below.
 *
 * ---------------------------------------------------------------------------
 * EXACTLY WHAT A BOUND ATTESTATION PROVES — READ THIS BEFORE FOLDING ONE
 * ---------------------------------------------------------------------------
 * PROVES (cryptographically, ed25519 over SSHSIG):
 *   * the holder of a private key that the committed roster lists FOR THE
 *     CLAIMED ATTESTOR PERSONA produced these bytes, and
 *   * those bytes name this attestor, this attested peer, this window, this
 *     event count, this participant set, and the DIGEST of the exact event set
 *     attested. None of them can be edited without invalidating the signature.
 *
 * DOES NOT PROVE — and no field here may ever be read as proving it:
 *   * that the attested events are GENUINE, whatever that would mean. The
 *     producer reads them; it does not re-derive them, re-execute them, or check
 *     any signature on them. `claim` records that a peer SAW a set of events and
 *     says which set. That is a real fact and it is not a verification verdict.
 *   * that the attestor's key was not stolen. A signature relocates the secret;
 *     it does not make secrets unstealable (`observe/signed-stamp.ts` says the
 *     same thing for the same reason).
 *   * WHEN it was signed. SSHSIG carries no timestamp and this format adds none.
 *     The envelope's `at` is the writer's LOCAL wall clock and is deliberately
 *     OUTSIDE the signed bytes: the instant local time steers what the shared
 *     fold accepts, two peers with different clocks fold different evidence sets
 *     and diverge (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 *     The window bounds are inside, because they are properties of the SUBJECT.
 *
 * ---------------------------------------------------------------------------
 * CANONICALISATION — the signed bytes are NOT a JSON serialisation
 * ---------------------------------------------------------------------------
 * A signature over "the JSON of this record" is a signature over nothing: key
 * order, whitespace, unicode escaping, and number formatting are all free
 * variables, so two byte-strings that "are the same record" verify differently.
 *
 * So nothing here ever hashes or signs JSON. `attestationSigningBytes` builds an
 * explicit, ENUMERATED, LENGTH-PREFIXED concatenation of named fields in a fixed
 * order. Re-ordering the keys of the JSON file, re-indenting it, or round-tripping
 * it through a different serializer is STRUCTURALLY INCAPABLE of changing the
 * signed bytes, because the JSON is never an input — only the parsed field values
 * are. `attestation-record.test.ts` pins that with a hex golden vector and by
 * signing a shuffled/reindented parse of the same record.
 *
 * Length-prefixing is what makes the encoding INJECTIVE: without it, attestor
 * `"ab"` + attested `"c"` and attestor `"a"` + attested `"bc"` would share signed
 * bytes and a signature could be moved between them by re-splitting the boundary.
 * Same construction, same reason, as `hygiene/build-receipt.ts`,
 * `observe/signed-stamp.ts`, and `src/Core/MultiSignatureVerification.fs`.
 *
 * ---------------------------------------------------------------------------
 * NO PRIVATE KEY IS CREATED, HANDLED, OR REQUIRED BY THIS FEATURE
 * ---------------------------------------------------------------------------
 * This is the reading half only. Signing is done elsewhere, by whoever holds a
 * key, with the key never leaving their agent:
 *
 *   bun src/Core.TypeScript/observe/verify-attestation-events.ts message <event.json> > msg.bin
 *   ssh-keygen -Y sign -n zeta.attestation.v1 -f <key> msg.bin   # produces msg.bin.sig
 *   # then add to the event JSON:
 *   #   "signature": { "version": "1", "signer": "SHA256:…", "sshsig": "<one-line base64>" }
 *
 * `verifySshSig` is a pure in-process ed25519 verifier, so checking a claim needs
 * no `ssh-keygen` binary, no `allowed_signers` file, and no network.
 *
 * Anchors (Beacon): Bernstein, Duif, Lange, Schwabe & Yang, "High-speed
 * high-security signatures" (2012) — Ed25519; OpenSSH `PROTOCOL.sshsig` — the
 * signature envelope and its namespace domain separation; Merkle (1987) — a
 * digest naming a set; in-toto (Torres-Arias et al., USENIX Security 2019) — a
 * signed statement about what an actor observed, which this is the peer-to-peer
 * rung of. Goguen & Meseguer (1982) — noninterference: the roster and the
 * verifier are the only declared doors here.
 */

import { createHash } from "node:crypto";
import { findRosterEntry, sshString, verifySshSig, type RosterEntry, type SshSigFailure } from "../crypto/sshsig.ts";
import { pack, type SimulationEnvironment } from "../zeta-id/zeta-id.ts";
import {
  Category,
  Chromosome,
  IdVersion,
  LocationHint,
  Persona,
  type Milliseconds,
  type ZetaObservation,
} from "../zeta-id/types.ts";
import type { AttestationEvent } from "./attestation-event.ts";

// ═══ domains ═══════════════════════════════════════════════════════════════

/**
 * SSHSIG namespace. DELIBERATELY distinct from `git` (commit signing),
 * `zeta.build-receipt.v1`, and `zeta.phase-stamp.v1`.
 *
 * Without domain separation a signature collected for one protocol replays as an
 * attestation — an agent's ordinary signed commit would become a signed claim
 * that it witnessed peers it never saw. `verifySshSig` REQUIRES the expected
 * namespace and refuses on mismatch, which is what makes the field mean something.
 */
export const ATTESTATION_NAMESPACE = "zeta.attestation.v1";

/** Domain tag for the attested-set digest. Separate from the signing namespace on purpose. */
export const ATTESTED_SET_DOMAIN = "zeta.attested-events.v1";

/** Record format version. Inside the signed bytes, so it cannot be downgraded silently. */
export const ATTESTATION_RECORD_VERSION = "1";

/**
 * The CLOSED claim vocabulary. A record may NAME a claim, never DEFINE one — the
 * portable half of the closed-command-set design in
 * `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`. An open
 * vocabulary would let a signer attest `everything-is-fine`: true, signed, and
 * meaningless.
 *
 * `heartbeat-genuine` is the ONLY member, and its name overclaims: nothing
 * verifies genuineness (see "DOES NOT PROVE" above). The string is kept rather
 * than corrected because `.github/workflows/agent-reviewer.yml` writes it and 377
 * committed records carry it; renaming the wire value would split the corpus and
 * reach into another lane. What is corrected here is the DOCUMENTED MEANING and,
 * more to the point, the record now carries `attestedDigest` — so the claim names
 * the set it is about instead of gesturing at a count.
 */
export const ATTESTATION_CLAIMS: readonly string[] = ["heartbeat-genuine"];

// ═══ shapes ════════════════════════════════════════════════════════════════

/** `sha256:<64 lowercase hex>`. */
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
/** `SHA256:<43-char unpadded base64>`, as `ssh-keygen -lf` prints it. */
const FINGERPRINT_RE = /^SHA256:[A-Za-z0-9+/]{43}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const ZETA_ID_HEX_RE = /^[0-9a-f]{32}$/;
/**
 * Persona names. Lowercase ASCII, no slashes, no whitespace, bounded length.
 *
 * Constrained for two reasons, and the second one is not theoretical.
 *
 * 1. A persona name is a ROSTER KEY — matched against a committed directory name —
 *    and an unconstrained key is how a lookup turns into a traversal.
 * 2. IT IS THE CHEAP GUARD THAT WOULD HAVE CAUGHT THE LIVE POLLUTION. On
 *    `origin/main` today, six committed attestations name `/tmp/attest-<random>`
 *    as their ATTESTOR and six name one as their ATTESTED (eleven records in all,
 *    the sets overlap). Those are `mkdtempSync` fixture directories that reached
 *    the identity field of a durable, foldable record. No cryptography is needed
 *    to reject a filesystem path as a persona; a regex is enough, and there was
 *    not one anywhere.
 *
 * Every legitimate attestor in the live corpus — `alexa`, `otto`, `soraya`,
 * `society`, `otto-cli` — matches. Every polluted one does not, because `/` is
 * excluded.
 *
 * Exported so the PRODUCER can apply the same gate at write time
 * (`emit-attestation.ts`). A guard that only runs at read time lets the bad record
 * become history first, which is precisely what happened.
 */
export const PERSONA_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** True iff `name` is a well-formed persona name. Says nothing about whether it EXISTS. */
export function isPersonaName(name: string): boolean {
  return typeof name === "string" && PERSONA_NAME_RE.test(name);
}

const PERSONA_RE = PERSONA_NAME_RE;

/** The detached signature carried by a bound record. Public material only. */
export interface AttestationSignature {
  readonly version: string;
  /** `SHA256:<unpadded base64>` — the key the signer CLAIMS. Checked against the embedded key. */
  readonly signer: string;
  /** Single-line base64 SSHSIG blob (armor stripped). */
  readonly sshsig: string;
}

/**
 * The on-disk record. Same envelope every observe event uses, plus an optional
 * `signature`. `at` is present and is NOT signed — see the local-time note above.
 */
export interface AttestationRecord {
  readonly id: string;
  readonly at: string;
  readonly by: string;
  readonly kind: string;
  readonly attestation: AttestationEvent;
  readonly signature?: AttestationSignature;
}

// ═══ refusals ══════════════════════════════════════════════════════════════

/** Why a record was refused. Data, never a printed message. */
export type AttestationRefusalReason =
  | "unsupported-version"
  | "malformed-id"
  | "malformed-attestor"
  | "malformed-attested"
  | "self-attestation"
  | "envelope-attestor-mismatch"
  | "unknown-claim"
  | "malformed-window"
  | "window-inverted"
  | "malformed-event-count"
  | "attests-nothing"
  | "missing-digest"
  | "malformed-digest"
  | "malformed-participants"
  | "duplicate-participant"
  | "participant-is-subject"
  | "strength-mismatch"
  | "id-mismatch"
  | "digest-mismatch"
  | "malformed-signer"
  | "signer-mismatch"
  | "unknown-attestor"
  | "attestor-key-mismatch"
  | SshSigFailure;

/**
 * The verdict. THREE states, and there is deliberately no `ok` boolean: a caller
 * must not be able to `if (v.ok)` its way into folding an unattributed record.
 *
 *   `bound`   — structurally valid AND signed by a key the roster lists for this
 *               attestor persona. The only state that may enter a trust fold.
 *   `unbound` — structurally valid, carries no signature. This is what every
 *               record in the corpus is today. It is a SELF-CLAIM by an
 *               unauthenticated writer: reportable, never foldable.
 *   `refused` — something is wrong. Named, with the offending value.
 */
export type AttestationVerdict =
  | { readonly status: "bound"; readonly signer: string; readonly signerSource: string }
  | { readonly status: "unbound"; readonly why: "no-signature" }
  | { readonly status: "refused"; readonly reason: AttestationRefusalReason; readonly detail: string };

const refuse = (reason: AttestationRefusalReason, detail: string): AttestationVerdict => ({
  status: "refused",
  reason,
  detail,
});

/** True only for `bound`. The one place a fold should branch. */
export function isBound(v: AttestationVerdict): v is { status: "bound"; signer: string; signerSource: string } {
  return v.status === "bound";
}

// ═══ the attested-set digest — (a) the claim names what it attests ══════════

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * A length-prefixed, count-prefixed blob over a SET of strings.
 *
 * Nested prefixing rather than a joined separator: a separator inside a
 * length-prefixed field can be re-split (`["a,b"]` vs `["a","b"]` share bytes),
 * which is the same injectivity defect the outer prefixes exist to prevent.
 */
function setBlob(sorted: readonly string[]): Uint8Array {
  return concat([sshString(String(sorted.length)), ...sorted.map((s) => sshString(s))]);
}

/**
 * Deduplicate and sort ORDINALLY (codepoint order, not locale order).
 *
 * `.claude/rules/culture-invariant-by-default.md`: a locale-sensitive sort makes
 * the digest machine-dependent, so two honest peers holding the same event set
 * would compute different digests and each would read the other as lying. Event
 * ids here are lowercase hex or `society-<base36>` — ASCII, where UTF-16
 * code-unit order, UTF-8 byte order, and codepoint order all coincide — so this
 * sort cannot diverge between oracles even for the non-ASCII case.
 */
export function canonicalIdSet(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * `sha256:<hex>` over the sorted, deduplicated set of attested event ids.
 *
 * THIS is what makes the claim name its own subject. Before it, an attestation
 * carried `eventCount: 7` — and seven is a count, shared by every other set of
 * seven things, so a verifier holding the real events could not tell whether the
 * attestation was about them. With the digest, a peer recomputes over the set it
 * holds and gets identity or contradiction, never a shrug.
 *
 * Refuses the empty set: an attestation over nothing is the vacuity class, and it
 * would otherwise get a perfectly respectable-looking constant digest.
 */
export function attestedEventsDigest(ids: readonly string[]): string {
  const sorted = canonicalIdSet(ids);
  if (sorted.length === 0) throw new RangeError("attestedEventsDigest: refusing to digest an empty attested set");
  for (const id of sorted) {
    if (id.length === 0) throw new RangeError("attestedEventsDigest: an event id may not be empty");
  }
  const blob = concat([new TextEncoder().encode(ATTESTED_SET_DOMAIN), setBlob(sorted)]);
  return `sha256:${createHash("sha256").update(Buffer.from(blob)).digest("hex")}`;
}

/** True iff `record` attests exactly this set of event ids. The verifier a peer runs. */
export function attestationCoversEvents(attestation: AttestationEvent, ids: readonly string[]): boolean {
  const set = canonicalIdSet(ids);
  if (set.length === 0) return false;
  return attestation.attestedDigest === attestedEventsDigest(set);
}

// ═══ the derived id — (b) dedup that is real ═══════════════════════════════

/**
 * Derive the attestation's ZetaId. PURE in (attestor, attested, windowEnd) — no
 * clock, no CSPRNG. Distinct subjects give distinct ids; identical subjects give
 * the same id. Moved here from `emit-attestation.ts` unchanged in behaviour so
 * that the VERIFIER can recompute it without importing a CLI module.
 *
 * DERIVED mint, not MINTED — `docs/research/2026-08-14-zetaid-universal-pointer-
 * derived-vs-minted-declared-sort-fields-and-why-v3-is-not-needed.md` §6a. The
 * test there is "if two parties construct this independently, must they agree?"
 * For a dedup key the answer is yes. Discrimination is 80 bits: 48 of `timestamp`
 * (the window end — a stable property of the subject, which §6a-1 sanctions) plus
 * 32 of `randomness` carrying a SHA-256 digest of the subject tuple.
 *
 * WHY `attestedDigest` IS NOT AN INPUT, deliberately. The id is the DEDUP KEY —
 * the identity of the fact "attestor witnessed attested through this window". The
 * digest is the EVIDENCE POINTER — what the fact is about. Folding the digest into
 * the key would mean a re-scan that saw one more event produced a different id, so
 * re-running a tick would append a second overlapping attestation instead of
 * deduplicating: exactly the G-set idempotency (discipline #6) the derivation
 * exists to provide. The digest is covered by the SIGNATURE instead, which is
 * where tamper-evidence belongs.
 */
export function deriveAttestationId(attestor: string, attested: string, windowEnd: string): string {
  // Length-prefixed so ("ab","c") and ("a","bc") cannot digest to the same bytes.
  const subject = [attestor, attested, windowEnd].map((s) => `${s.length}:${s}`).join("|");
  const digest = createHash("sha256").update(subject, "utf8").digest();
  const rand = BigInt(digest.readUInt32BE(0));

  const windowMs = Date.parse(windowEnd);
  const keyEnv: SimulationEnvironment = { nextInt64: () => rand };
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    // The subject's own window end, not a mint clock: a timestamp that moved would
    // move the attestation's identity and break the dedup this id exists to provide.
    timestamp: (Number.isNaN(windowMs) ? 0 : windowMs) as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    // Same category as every other observe-event in this folder
    // (`event-sink-folder.ts` `mintObserveEventIdHex`) — an attestation is a
    // planning/workflow fact and sorts alongside its siblings.
    category: Category.WorkItem,
    authority: { type: "TrustedAgent" },
    persona: Persona.FireflyCoherence,
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  return pack(obs, keyEnv).toString(16).padStart(32, "0");
}

/**
 * Recompute the id from the record's OWN fields and compare.
 *
 * This is the check that was missing. `^[0-9a-f]{32}\.json$` is an ENCODING check
 * standing in for a VALUE check: it asks whether the name looks like an id, never
 * whether it IS this record's id. Under shape-only validation one actor can write
 * N self-attestations under N arbitrary hex names and every one of them passes,
 * which is precisely the defeat of the dedup the derivation was written to give.
 */
export function verifyAttestationId(record: { readonly id: string; readonly attestation: AttestationEvent }): boolean {
  const a = record.attestation;
  return record.id === deriveAttestationId(a.attestor, a.attested, a.windowEnd);
}

// ═══ canonical signing bytes — (c) the SSHSIG binding ══════════════════════

/**
 * Participants in canonical form: deduplicated, ordinally sorted, count-prefixed.
 * Sorting makes the signed form order-independent, so re-serializing a parsed
 * record reproduces the exact bytes that were signed regardless of writer order.
 */
export function canonicalParticipants(participants: readonly string[] | undefined): readonly string[] {
  return canonicalIdSet(participants ?? []);
}

/**
 * A non-negative safe integer as an invariant decimal string.
 *
 * Written out rather than reaching for `toString()` on a possibly-float, because
 * `1e21`, `-0`, and `1.0` all stringify to things a verifier on another runtime
 * may not reproduce. Anything that is not a plain non-negative integer throws
 * here rather than becoming ambiguous signed bytes.
 */
function invariantCount(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(`invariantCount: ${n} is not a non-negative safe integer`);
  return String(n);
}

/**
 * THE EXACT BYTES A SIGNER SIGNS. Enumerated fields, fixed order, length-prefixed.
 * No JSON, no whitespace, no key order — see "CANONICALISATION" in the header.
 *
 * `strength` is NOT here, and its absence is load-bearing: strength is DERIVED
 * from the participant set, and signing a derived field would let a signer inflate
 * the one number that gets folded into trust while every other field checked out.
 * The verifier RECOMPUTES it (`strength-mismatch`) instead of trusting it.
 *
 * `at` is not here either — it is the writer's local wall clock, and local time
 * must never enter the shared fold.
 */
export function attestationSigningBytes(claim: {
  readonly id: string;
  readonly attestor: string;
  readonly attested: string;
  readonly claim: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly eventCount: number;
  readonly attestedDigest: string;
  readonly simultaneousParticipants?: readonly string[];
  readonly signer: string;
}): Uint8Array {
  return concat([
    sshString(ATTESTATION_RECORD_VERSION),
    sshString(claim.id),
    sshString(claim.attestor),
    sshString(claim.attested),
    sshString(claim.claim),
    sshString(claim.windowStart),
    sshString(claim.windowEnd),
    sshString(invariantCount(claim.eventCount)),
    sshString(claim.attestedDigest),
    sshString(setBlob(canonicalParticipants(claim.simultaneousParticipants))),
    sshString(claim.signer),
  ]);
}

// ═══ roster: persona -> keys ═══════════════════════════════════════════════

/**
 * Which keys may speak AS which persona.
 *
 * A flat "is this key trusted at all" roster — which is what `build-receipt.ts`
 * needs, because a receipt names no persona — would not close defect (1). The
 * attestation's whole content is WHO witnessed whom, so the binding must be
 * NAME-KEYED: `otto`'s key signing a record whose attestor is `alexa` is refused
 * (`attestor-key-mismatch`), not accepted as "some trusted key signed something".
 *
 * Keys are read from the committed anchors (`maintainers/**\/ssh-pubkeys.txt`) —
 * the same public halves the SSH CA and git commit signing already use. No second
 * key registry is minted.
 */
export type PersonaKeyRoster = ReadonlyMap<string, readonly RosterEntry[]>;

// ═══ signature verification port ═══════════════════════════════════════════

/**
 * The verification port — hexagonal on purpose, and for two distinct reasons.
 *
 * 1. The scheme is swappable, so a broken cryptographic assumption (or a
 *    post-quantum migration) is a wiring change rather than a rewrite. Same shape
 *    and same reason as `observe/signed-stamp.ts`'s `SignatureScheme`.
 * 2. It is how the ACCEPT path is testable WITHOUT any private key existing. This
 *    feature creates and handles no secret, so no test here can produce a genuine
 *    signature over these canonical bytes; a stub verifier exercises the binding
 *    logic (persona match, signer match, id, digest, strength) end to end, while
 *    a REAL `ssh-keygen`-produced signature exercises the refusal paths — see the
 *    honesty note at the top of `attestation-record.test.ts`, which states plainly
 *    which half is covered by real cryptography and which is not.
 */
export interface SignatureVerifier {
  verify(
    sshsig: string,
    message: Uint8Array,
    namespace: string,
  ): { readonly ok: true; readonly fingerprint: string } | { readonly ok: false; readonly reason: SshSigFailure };
}

/** The production adapter: pure in-process ed25519 (`crypto/sshsig.ts`). */
export const sshsigVerifier: SignatureVerifier = { verify: verifySshSig };

export interface VerifyAttestationOptions {
  /** Persona -> the keys allowed to speak as that persona. */
  readonly roster: PersonaKeyRoster;
  /** Defaults to the real SSHSIG verifier. */
  readonly verifier?: SignatureVerifier;
}

// ═══ verification ══════════════════════════════════════════════════════════

/**
 * Verify one record. Every failure is a refusal naming the offending value;
 * nothing throws.
 *
 * ORDER IS DELIBERATE, in three bands:
 *   1. IDENTITY — who is speaking, about whom, alongside whom. First, because a
 *      record naming a participant that is not a persona is wrong in a way no
 *      later check can redeem, and because reporting it as (say) a missing digest
 *      would file an impersonation under "needs a migration".
 *   2. EVIDENCE — claim, window, count, digest, derived strength, derived id.
 *   3. ATTRIBUTION — the signature and the persona binding, last.
 *
 * All three bands run whether or not a signature is present, so an unsigned record
 * is still checked rather than waved through.
 */
export function verifyAttestationRecord(record: AttestationRecord, opts: VerifyAttestationOptions): AttestationVerdict {
  const a = record.attestation;

  if (!ZETA_ID_HEX_RE.test(record.id)) return refuse("malformed-id", record.id);
  if (!PERSONA_RE.test(a.attestor)) return refuse("malformed-attestor", a.attestor);
  if (!PERSONA_RE.test(a.attested)) return refuse("malformed-attested", a.attested);
  // You do not attest yourself. A self-attestation is strength minted from nothing.
  if (a.attestor === a.attested) return refuse("self-attestation", a.attestor);
  // The envelope's `by` is the field readers index on; if it disagrees with the
  // signed attestor the record says two different things about who spoke.
  if (record.by !== a.attestor) return refuse("envelope-attestor-mismatch", `by=${record.by} attestor=${a.attestor}`);

  const participants = a.simultaneousParticipants;
  if (participants !== undefined) {
    for (const p of participants) {
      if (!PERSONA_RE.test(p)) return refuse("malformed-participants", p);
      // A participant list naming the attestor or the attested would double-count
      // the pair into the simultaneity bonus.
      if (p === a.attestor || p === a.attested) return refuse("participant-is-subject", p);
    }
    if (new Set(participants).size !== participants.length) {
      return refuse("duplicate-participant", participants.join(","));
    }
  }

  if (!ATTESTATION_CLAIMS.includes(a.claim)) return refuse("unknown-claim", a.claim);

  const startMs = Date.parse(a.windowStart);
  const endMs = Date.parse(a.windowEnd);
  if (Number.isNaN(startMs)) return refuse("malformed-window", a.windowStart);
  if (Number.isNaN(endMs)) return refuse("malformed-window", a.windowEnd);
  if (endMs < startMs) return refuse("window-inverted", `${a.windowStart}..${a.windowEnd}`);

  if (!Number.isSafeInteger(a.eventCount) || a.eventCount < 0) {
    return refuse("malformed-event-count", String(a.eventCount));
  }
  if (a.eventCount === 0) return refuse("attests-nothing", "eventCount=0");

  // "written before the digest field existed" and "written with a corrupt digest"
  // are different facts and a reader triaging the corpus cares which: the first is
  // a migration, the second is a bug or an attack. Reporting both as one reason
  // would hide 377 legacy records inside a category that sounds like corruption.
  if (a.attestedDigest === undefined || a.attestedDigest === null) {
    return refuse("missing-digest", "record predates `attestedDigest` — it names no event set, so it is not evidence");
  }
  if (typeof a.attestedDigest !== "string" || !DIGEST_RE.test(a.attestedDigest)) {
    return refuse("malformed-digest", String(a.attestedDigest));
  }

  // Strength is derived, so it is recomputed rather than believed. This is the
  // single number a trust fold multiplies by; a record that misreports it is
  // refused even when everything else about it is well-formed.
  const expectedStrength = expectedStrengthFor(participants);
  if (!Object.is(a.strength, expectedStrength)) {
    return refuse("strength-mismatch", `record ${a.strength} != derived ${expectedStrength}`);
  }

  if (!verifyAttestationId(record)) {
    return refuse("id-mismatch", `${record.id} != ${deriveAttestationId(a.attestor, a.attested, a.windowEnd)}`);
  }

  const sig = record.signature;
  if (sig === undefined) return { status: "unbound", why: "no-signature" };

  if (sig.version !== ATTESTATION_RECORD_VERSION) return refuse("unsupported-version", sig.version);
  if (!FINGERPRINT_RE.test(sig.signer)) return refuse("malformed-signer", sig.signer);
  if (sig.sshsig.length === 0 || !BASE64_RE.test(sig.sshsig))
    return refuse("malformed-base64", sig.sshsig.slice(0, 24));

  // The persona binding, checked BEFORE the cryptography so that "this key may not
  // speak as this persona" is reported as itself and never disguised as a bad
  // signature. They are different facts and a reader may care which.
  const personaKeys = opts.roster.get(a.attestor);
  if (personaKeys === undefined || personaKeys.length === 0) return refuse("unknown-attestor", a.attestor);
  const entry = findRosterEntry(personaKeys, sig.signer);
  if (entry === null) return refuse("attestor-key-mismatch", `${sig.signer} is not a key of ${a.attestor}`);

  const message = attestationSigningBytes({
    id: record.id,
    attestor: a.attestor,
    attested: a.attested,
    claim: a.claim,
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    eventCount: a.eventCount,
    attestedDigest: a.attestedDigest,
    ...(participants !== undefined ? { simultaneousParticipants: participants } : {}),
    signer: sig.signer,
  });

  const verifier = opts.verifier ?? sshsigVerifier;
  const verified = verifier.verify(sig.sshsig, message, ATTESTATION_NAMESPACE);
  if (!verified.ok) return refuse(verified.reason, sig.signer);
  // The SSHSIG embeds the public key it was made with. If that key's fingerprint is
  // not the one the record claims, a real signature is being attributed to the wrong
  // identity — a distinct failure from a bad signature, and the one an attacker tries.
  if (verified.fingerprint !== sig.signer) {
    return refuse("signer-mismatch", `embedded ${verified.fingerprint} != claimed ${sig.signer}`);
  }

  return { status: "bound", signer: sig.signer, signerSource: entry.source };
}

/**
 * The strength a record with this participant set is entitled to.
 *
 * Kept here rather than imported from `attestation-event.ts` so the verifier does
 * not depend on the producer module (and so the dependency runs one way, allowing
 * `attestation-event.ts` to stay free of this file). `attestation-record.test.ts`
 * pins the two against each other, so a drift fails there instead of silently
 * refusing every honest record.
 */
export function expectedStrengthFor(participants: readonly string[] | undefined): number {
  const n = participants === undefined || participants.length === 0 ? 2 : participants.length + 2;
  if (n <= 2) return 1;
  return 1 + (Math.log2(n) - 1);
}
