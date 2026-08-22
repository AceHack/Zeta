/**
 * attestation-record.test.ts — work-item 081M0BTG2M7087G0R0011X5ESW.
 *
 * ---------------------------------------------------------------------------
 * HONESTY NOTE — WHICH HALF IS COVERED BY REAL CRYPTOGRAPHY, AND WHICH IS NOT
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE CITING THIS FILE AS COVERAGE.
 *
 * This feature creates, handles, and requires NO private key — by constraint and
 * by design. A signature over these canonical bytes can therefore not be produced
 * anywhere in this repository, so the tests split:
 *
 *   REAL CRYPTOGRAPHY, no stub. Every refusal path that involves a signature is
 *   driven by an actual `ssh-keygen -Y sign` blob (the golden vector below, the
 *   same one `crypto/sshsig.test.ts` uses). That is what proves the cross-protocol
 *   replay guard is live: a genuine signature made for `zeta.build-receipt.v1` is
 *   REFUSED here with `namespace-mismatch`, not quietly accepted.
 *
 *   STUBBED. The ACCEPT path — `status: "bound"` — is reached with a stub
 *   `SignatureVerifier`, because reaching it honestly would require a private key.
 *   What the stub covers is everything AROUND the ed25519 check: the persona
 *   binding, the signer/embedded-key match, the id derivation, the digest, the
 *   strength recomputation, and the canonical bytes handed to the verifier. What
 *   it does NOT cover is that `verifySshSig` accepts a valid signature — and that
 *   is covered, thoroughly and against real OpenSSH output, in
 *   `crypto/sshsig.test.ts`, which is why this module delegates to it rather than
 *   reimplementing ed25519.
 *
 * So: the arithmetic of trust is tested, the protocol is tested next door, and the
 * one seam nobody here can exercise is named rather than papered over.
 */
import { describe, expect, test } from "bun:test";
import { parseRoster, sshFingerprint, parseSshPublicKeyLine, type RosterEntry } from "../crypto/sshsig";
import { simultaneousStrength, type AttestationEvent } from "./attestation-event";
import {
  ATTESTATION_NAMESPACE,
  attestationCoversEvents,
  attestationSigningBytes,
  attestedEventsDigest,
  canonicalIdSet,
  deriveAttestationId,
  expectedStrengthFor,
  isBound,
  isPersonaName,
  sshsigVerifier,
  verifyAttestationId,
  verifyAttestationRecord,
  type AttestationRecord,
  type PersonaKeyRoster,
  type SignatureVerifier,
} from "./attestation-record";

// ── the real OpenSSH artefacts, reused from `crypto/sshsig.test.ts` ──────────
//
// Produced 2026-08-17 by `ssh-keygen -Y sign -n zeta.build-receipt.v1 -f k msg`
// over the message "hello receipt", with an EPHEMERAL key. It is public material:
// a public key and a detached signature, nothing secret. It appears here to prove
// domain separation with a signature OpenSSH actually made, rather than with a
// string this file invented.
const GOLDEN_PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAkgsuJsQCYnktiBhVImV5Z5h2zRec5YUKnEauX+xXM receipt-test";
const GOLDEN_SIG =
  "U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgACSCy4mxAJieS2IGFUiZXlnmHb" +
  "NF5zlhQqcRq5f7FcwAAAAVemV0YS5idWlsZC1yZWNlaXB0LnYxAAAAAAAAAAZzaGE1MTIA" +
  "AABTAAAAC3NzaC1lZDI1NTE5AAAAQMZyGJUD9BlhQ3p2X5dFUk3ySuSXtzkrNgkThd9ypB" +
  "bErMSoVKyHW1WuTlq7lQHheJwpf/OjebIbwxYWkgDKJwg=";
const GOLDEN_FINGERPRINT = sshFingerprint(parseSshPublicKeyLine(GOLDEN_PUBKEY)?.blob ?? new Uint8Array());

const OTTO_KEYS: readonly RosterEntry[] = parseRoster(GOLDEN_PUBKEY, "test:otto");
const ROSTER: PersonaKeyRoster = new Map([["otto", OTTO_KEYS]]);

// ── a canonical, well-formed record ─────────────────────────────────────────

const WINDOW_START = "2026-08-09T19:12:28.050Z";
const WINDOW_END = "2026-08-09T19:42:28.050Z";
const EVENT_IDS = ["b0000000000000000000000000000002", "a0000000000000000000000000000001"];
const DIGEST = attestedEventsDigest(EVENT_IDS);

function attestation(over: Partial<AttestationEvent> = {}): AttestationEvent {
  return {
    attestor: "otto",
    attested: "alexa",
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    eventCount: 2,
    attestedDigest: DIGEST,
    claim: "heartbeat-genuine",
    strength: 1,
    ...over,
  };
}

function record(over: Partial<AttestationRecord> = {}, attOver: Partial<AttestationEvent> = {}): AttestationRecord {
  const a = attestation(attOver);
  return {
    id: deriveAttestationId(a.attestor, a.attested, a.windowEnd),
    at: "2026-08-09T19:43:00.000Z",
    by: a.attestor,
    kind: "attestation",
    attestation: a,
    ...over,
  };
}

/** Accepts anything, reporting the fingerprint it is told to. Never sees a key. */
const stubVerifier = (fingerprint: string): SignatureVerifier => ({
  verify: () => ({ ok: true, fingerprint }),
});

const signature = (over: Record<string, unknown> = {}) => ({
  version: "1",
  signer: GOLDEN_FINGERPRINT,
  sshsig: GOLDEN_SIG,
  ...over,
});

// ═══ (a) the digest — the claim names what it attests ══════════════════════

describe("attestedEventsDigest", () => {
  test("is order-independent — the same SET digests the same", () => {
    expect(attestedEventsDigest(["a", "b", "c"])).toBe(attestedEventsDigest(["c", "a", "b"]));
  });

  test("deduplicates — a set, not a multiset", () => {
    expect(attestedEventsDigest(["a", "b", "a"])).toBe(attestedEventsDigest(["a", "b"]));
  });

  test("DISCRIMINATES — the property `eventCount` never had", () => {
    // Same count. This is exactly the pair a count cannot separate, and separating
    // it is the entire reason this field exists.
    expect(attestedEventsDigest(["a", "b"])).not.toBe(attestedEventsDigest(["a", "c"]));
    expect(attestedEventsDigest(["a", "b"])).not.toBe(attestedEventsDigest(["a", "b", "c"]));
  });

  test("is INJECTIVE across element boundaries — no re-splitting", () => {
    // Without nested length-prefixing, ["ab","c"] and ["a","bc"] would flatten to the
    // same bytes and a digest could be moved between two different event sets.
    expect(attestedEventsDigest(["ab", "c"])).not.toBe(attestedEventsDigest(["a", "bc"]));
    // A separator-joined encoding would also collide these two.
    expect(attestedEventsDigest(["a,b"])).not.toBe(attestedEventsDigest(["a", "b"]));
  });

  test("refuses the empty set — an attestation over nothing is the vacuity class", () => {
    expect(() => attestedEventsDigest([])).toThrow(/empty attested set/);
    expect(() => attestedEventsDigest(["a", ""])).toThrow(/may not be empty/);
  });

  test("is pinned to a hex golden vector (text, per no-binary-in-proof-lineage)", () => {
    expect(DIGEST).toBe("sha256:246f8a1a55e3186ee2232655423e112ddb902aca62506c76b2bf9445065ec0d1");
  });

  test("sorts ORDINALLY, not by locale", () => {
    // A locale-sensitive sort makes the digest machine-dependent, so two honest peers
    // holding the same set would each read the other as lying.
    expect(canonicalIdSet(["B", "a", "A", "b"])).toEqual(["A", "B", "a", "b"]);
  });
});

describe("attestationCoversEvents", () => {
  test("accepts the set it was built over, in any order, with duplicates", () => {
    const a = attestation();
    expect(attestationCoversEvents(a, EVENT_IDS)).toBe(true);
    expect(attestationCoversEvents(a, [...EVENT_IDS].reverse())).toBe(true);
    expect(attestationCoversEvents(a, [...EVENT_IDS, ...EVENT_IDS])).toBe(true);
  });

  test("rejects a different set of the same size, a subset, and a superset", () => {
    const a = attestation();
    expect(attestationCoversEvents(a, ["a0000000000000000000000000000001", "c0000000000000000000000000000003"])).toBe(
      false,
    );
    expect(attestationCoversEvents(a, ["a0000000000000000000000000000001"])).toBe(false);
    expect(attestationCoversEvents(a, [...EVENT_IDS, "c0000000000000000000000000000003"])).toBe(false);
  });

  test("rejects the empty set rather than vacuously accepting it", () => {
    expect(attestationCoversEvents(attestation(), [])).toBe(false);
  });
});

// ═══ (b) the derived id — dedup that is real ══════════════════════════════

describe("verifyAttestationId", () => {
  test("accepts a record whose id derives from its own fields", () => {
    expect(verifyAttestationId(record())).toBe(true);
  });

  test("REJECTS an arbitrary 32-hex id — the check the shape regex could not make", () => {
    // `^[0-9a-f]{32}$` accepts this happily. It is the substitution that let one
    // actor write N self-attestations under N names and defeat G-set dedup.
    expect(verifyAttestationId(record({ id: "0123456789abcdef0123456789abcdef" }))).toBe(false);
  });

  test("REJECTS a record whose id was derived for a DIFFERENT subject", () => {
    // A real, well-formed, correctly-derived id — for someone else. Copying an id
    // from another record is the cheapest forgery and it must not survive.
    const stolen = deriveAttestationId("otto", "soraya", WINDOW_END);
    expect(stolen).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyAttestationId(record({ id: stolen }))).toBe(false);
  });

  test("does NOT depend on the attested digest — dedup survives a re-scan", () => {
    // Deliberate: the id is the dedup KEY (identity of the fact), the digest is the
    // evidence POINTER. Folding the digest into the key would mean a re-scan that saw
    // one more event appended a second overlapping attestation instead of deduping.
    const a = attestation({ attestedDigest: attestedEventsDigest(["z"]) });
    expect(deriveAttestationId(a.attestor, a.attested, a.windowEnd)).toBe(record().id);
  });
});

// ═══ (c) canonicalisation — the signed bytes are not a JSON serialisation ══

describe("attestationSigningBytes — canonical form", () => {
  const claim = {
    id: record().id,
    attestor: "otto",
    attested: "alexa",
    claim: "heartbeat-genuine",
    windowStart: WINDOW_START,
    windowEnd: WINDOW_END,
    eventCount: 2,
    attestedDigest: DIGEST,
    simultaneousParticipants: ["soraya", "ani"],
    signer: GOLDEN_FINGERPRINT,
  };
  const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

  test("hex golden vector — the exact bytes a signer signs", () => {
    // Text, diffable, DST-replayable (`.claude/rules/no-binary-in-proof-lineage.md`).
    // A drift in field order, prefixing, or participant sorting shows up here as a
    // readable diff rather than as signatures that mysteriously stop verifying.
    expect(hex(attestationSigningBytes(claim))).toBe(
      "0000000131000000203038306366663430363236363930313061303133303030383261626133383136000000046f7474" +
        "6f00000005616c657861000000116865617274626561742d67656e75696e6500000018323032362d30382d3039543139" +
        "3a31323a32382e3035305a00000018323032362d30382d30395431393a34323a32382e3035305a000000013200000047" +
        "7368613235363a3234366638613161353565333138366565323233323635353432336531313264646239303261636136" +
        "323530366337366232626639343435303635656330643100000016000000013200000003616e6900000006736f726179" +
        "61000000325348413235363a4c586e52676e72554f66693974726c4237356167664571316d417044785867726e67496c" +
        "4a3570774e5851",
    );
  });

  test("KEY ORDER AND WHITESPACE CANNOT CHANGE THE SIGNED BYTES", () => {
    // The requirement stated plainly: a signature over a non-canonical JSON
    // serialisation is a signature over nothing. Here the JSON is never an input —
    // only the parsed field VALUES are — so the property holds structurally rather
    // than by a canonicalisation pass someone has to remember to run.
    const compact = JSON.stringify(record());
    const shuffled = JSON.stringify(
      {
        attestation: {
          strength: 1,
          claim: "heartbeat-genuine",
          attestedDigest: DIGEST,
          eventCount: 2,
          windowEnd: WINDOW_END,
          windowStart: WINDOW_START,
          attested: "alexa",
          attestor: "otto",
        },
        kind: "attestation",
        by: "otto",
        at: "2026-08-09T19:43:00.000Z",
        id: record().id,
      },
      null,
      4,
    );
    expect(shuffled).not.toBe(compact); // the two texts really are different

    const bytesOf = (json: string): string => {
      const r = JSON.parse(json) as AttestationRecord;
      const a = r.attestation;
      return hex(
        attestationSigningBytes({
          id: r.id,
          attestor: a.attestor,
          attested: a.attested,
          claim: a.claim,
          windowStart: a.windowStart,
          windowEnd: a.windowEnd,
          eventCount: a.eventCount,
          attestedDigest: a.attestedDigest,
          signer: GOLDEN_FINGERPRINT,
        }),
      );
    };
    expect(bytesOf(shuffled)).toBe(bytesOf(compact));
  });

  test("participant ORDER does not change the bytes, but participant MEMBERSHIP does", () => {
    const a = hex(attestationSigningBytes({ ...claim, simultaneousParticipants: ["ani", "soraya"] }));
    const b = hex(attestationSigningBytes({ ...claim, simultaneousParticipants: ["soraya", "ani"] }));
    expect(a).toBe(b);
    expect(hex(attestationSigningBytes({ ...claim, simultaneousParticipants: ["soraya"] }))).not.toBe(a);
    // Absent and empty are the same claim; neither is the same as a non-empty one.
    const none = hex(attestationSigningBytes({ ...claim, simultaneousParticipants: [] }));
    const { simultaneousParticipants: _drop, ...withoutKey } = claim;
    expect(hex(attestationSigningBytes(withoutKey))).toBe(none);
    expect(none).not.toBe(a);
  });

  test("is INJECTIVE across field boundaries — a signature cannot be re-split", () => {
    // Without length prefixes, attestor "ab"/attested "c" and attestor "a"/attested
    // "bc" would share signed bytes and a signature would move between them.
    const x = hex(attestationSigningBytes({ ...claim, attestor: "ab", attested: "c" }));
    const y = hex(attestationSigningBytes({ ...claim, attestor: "a", attested: "bc" }));
    expect(x).not.toBe(y);
  });

  test("every field that IS signed changes the bytes", () => {
    const base = hex(attestationSigningBytes(claim));
    for (const mutated of [
      { ...claim, id: deriveAttestationId("otto", "soraya", WINDOW_END) },
      { ...claim, attestor: "mallory" },
      { ...claim, attested: "mallory" },
      { ...claim, windowStart: "2026-08-09T19:12:28.051Z" },
      { ...claim, windowEnd: "2026-08-09T19:42:28.051Z" },
      { ...claim, eventCount: 3 },
      { ...claim, attestedDigest: attestedEventsDigest(["different"]) },
      { ...claim, signer: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
    ]) {
      expect(hex(attestationSigningBytes(mutated))).not.toBe(base);
    }
  });

  test("refuses a non-integer event count rather than encoding it ambiguously", () => {
    // `1e21`, `-0`, and `1.5` do not stringify identically across runtimes, and
    // ambiguous signed bytes are worse than a throw.
    expect(() => attestationSigningBytes({ ...claim, eventCount: 1.5 })).toThrow(/non-negative safe integer/);
    expect(() => attestationSigningBytes({ ...claim, eventCount: -1 })).toThrow();
    expect(() => attestationSigningBytes({ ...claim, eventCount: 1e21 })).toThrow();
  });
});

// ═══ verification — the three verdicts ════════════════════════════════════

describe("verifyAttestationRecord", () => {
  test("a well-formed record with NO signature is UNBOUND, never a pass", () => {
    const v = verifyAttestationRecord(record(), { roster: ROSTER });
    expect(v.status).toBe("unbound");
    expect(isBound(v)).toBe(false);
    // The whole corpus is in this state today. It is reportable and unfoldable.
    if (v.status === "unbound") expect(v.why).toBe("no-signature");
  });

  test("BOUND when the signature verifies and the key belongs to the claimed persona", () => {
    // Stubbed ed25519 — see the honesty note at the top of this file.
    const v = verifyAttestationRecord(record({ signature: signature() }), {
      roster: ROSTER,
      verifier: stubVerifier(GOLDEN_FINGERPRINT),
    });
    expect(v.status).toBe("bound");
    if (isBound(v)) {
      expect(v.signer).toBe(GOLDEN_FINGERPRINT);
      // The verdict names its own evidence: which roster file vouched for the key.
      expect(v.signerSource).toBe("test:otto");
    }
  });

  test("REFUSES a key that is real but belongs to a DIFFERENT persona", () => {
    // THE FINDING, stated as a test. `otto`'s key signing a record whose attestor is
    // `alexa` is not "some trusted key signed something" — it is impersonation, and a
    // flat is-this-key-trusted roster (which is all a build receipt needs) would let
    // it through. The binding must be NAME-KEYED.
    const rosterAsAlexa: PersonaKeyRoster = new Map([
      ["alexa", OTTO_KEYS],
      ["otto", OTTO_KEYS],
    ]);
    const v = verifyAttestationRecord(
      record({ by: "alexa", signature: signature() }, { attestor: "alexa", attested: "otto" }),
      { roster: rosterAsAlexa, verifier: stubVerifier(GOLDEN_FINGERPRINT) },
    );
    // With the key listed for alexa it binds …
    expect(v.status).toBe("bound");

    // … and with the same key listed ONLY for otto it does not.
    const v2 = verifyAttestationRecord(
      record({ by: "alexa", signature: signature() }, { attestor: "alexa", attested: "otto" }),
      { roster: ROSTER, verifier: stubVerifier(GOLDEN_FINGERPRINT) },
    );
    expect(v2).toMatchObject({ status: "refused", reason: "unknown-attestor" });
  });

  test("REFUSES a trusted key that is not one of THIS persona's keys", () => {
    const otherKey = "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const v = verifyAttestationRecord(record({ signature: signature({ signer: otherKey }) }), {
      roster: ROSTER,
      verifier: stubVerifier(otherKey),
    });
    expect(v).toMatchObject({ status: "refused", reason: "attestor-key-mismatch" });
  });

  test("REFUSES a real signature attributed to the wrong fingerprint", () => {
    // The attack: take a valid signature, claim a different (rostered) identity made
    // it. `signer-mismatch` is a distinct fact from `bad-signature` and is reported
    // as itself.
    const v = verifyAttestationRecord(record({ signature: signature() }), {
      roster: ROSTER,
      verifier: stubVerifier("SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"),
    });
    expect(v).toMatchObject({ status: "refused", reason: "signer-mismatch" });
  });

  test("REFUSES a GENUINE OpenSSH signature made for another namespace — real crypto", () => {
    // No stub here. `GOLDEN_SIG` is a real `ssh-keygen -Y sign` blob under
    // `zeta.build-receipt.v1`. Cross-protocol replay is exactly what SSHSIG's
    // namespace field exists to stop, and this proves the guard is wired.
    const v = verifyAttestationRecord(record({ signature: signature() }), {
      roster: ROSTER,
      verifier: sshsigVerifier,
    });
    expect(v).toMatchObject({ status: "refused", reason: "namespace-mismatch" });
    expect(ATTESTATION_NAMESPACE).not.toBe("zeta.build-receipt.v1");
  });

  test("REFUSES a corrupt signature blob — real crypto, no stub", () => {
    const v = verifyAttestationRecord(record({ signature: signature({ sshsig: "bm90LWEtc2lnbmF0dXJl" }) }), {
      roster: ROSTER,
      verifier: sshsigVerifier,
    });
    expect(v.status).toBe("refused");
  });

  test("structural refusals are checked even when unsigned — an unsigned record is not waved through", () => {
    const cases: readonly [string, AttestationRecord][] = [
      ["malformed-id", record({ id: "not-an-id" })],
      ["self-attestation", record({ by: "otto" }, { attested: "otto" })],
      ["envelope-attestor-mismatch", record({ by: "mallory" })],
      ["unknown-claim", record({}, { claim: "everything-is-fine" as AttestationEvent["claim"] })],
      ["malformed-window", record({}, { windowStart: "yesterday" })],
      ["malformed-event-count", record({}, { eventCount: 2.5 })],
      ["attests-nothing", record({}, { eventCount: 0 })],
      ["malformed-digest", record({}, { attestedDigest: "sha256:short" })],
      ["malformed-attestor", record({ by: "../../etc" }, { attestor: "../../etc" })],
    ];
    for (const [reason, r] of cases) {
      expect(verifyAttestationRecord(r, { roster: ROSTER })).toMatchObject({ status: "refused", reason });
    }
  });

  test("REFUSES an inverted window", () => {
    const r = record({}, { windowStart: WINDOW_END, windowEnd: WINDOW_START });
    // Re-derive the id so the refusal under test is the window, not the id.
    const fixed: AttestationRecord = { ...r, id: deriveAttestationId("otto", "alexa", WINDOW_START) };
    expect(verifyAttestationRecord(fixed, { roster: ROSTER })).toMatchObject({
      status: "refused",
      reason: "window-inverted",
    });
  });

  test("REFUSES an id that does not derive — the shape-for-value substitution", () => {
    expect(
      verifyAttestationRecord(record({ id: "0123456789abcdef0123456789abcdef" }), { roster: ROSTER }),
    ).toMatchObject({ status: "refused", reason: "id-mismatch" });
  });

  test("REFUSES inflated strength — the one number a trust fold multiplies by", () => {
    // Strength is DERIVED, so it is recomputed rather than believed. It is also
    // deliberately outside the signed bytes: signing a derived field would let a
    // signer inflate it while every other field checked out.
    expect(verifyAttestationRecord(record({}, { strength: 99 }), { roster: ROSTER })).toMatchObject({
      status: "refused",
      reason: "strength-mismatch",
    });
  });

  test("REFUSES a padded or self-including participant list", () => {
    const trio = (participants: readonly string[]) =>
      record({}, { simultaneousParticipants: participants, strength: simultaneousStrength(participants.length + 2) });
    expect(verifyAttestationRecord(trio(["soraya", "soraya"]), { roster: ROSTER })).toMatchObject({
      status: "refused",
      reason: "duplicate-participant",
    });
    expect(verifyAttestationRecord(trio(["alexa"]), { roster: ROSTER })).toMatchObject({
      status: "refused",
      reason: "participant-is-subject",
    });
    expect(verifyAttestationRecord(trio(["otto"]), { roster: ROSTER })).toMatchObject({
      status: "refused",
      reason: "participant-is-subject",
    });
    // A legitimate trio still passes structurally.
    expect(verifyAttestationRecord(trio(["soraya"]), { roster: ROSTER }).status).toBe("unbound");
  });
});

describe("expectedStrengthFor agrees with the producer's own formula", () => {
  test("for the pairwise, trio, quad and octet cases", () => {
    // Pinned against `attestation-event.ts` so a drift on either side fails HERE
    // rather than silently refusing every honest record as `strength-mismatch`.
    expect(expectedStrengthFor(undefined)).toBe(simultaneousStrength(2));
    expect(expectedStrengthFor([])).toBe(simultaneousStrength(2));
    expect(expectedStrengthFor(["a"])).toBe(simultaneousStrength(3));
    expect(expectedStrengthFor(["a", "b"])).toBe(simultaneousStrength(4));
    expect(expectedStrengthFor(["a", "b", "c", "d", "e", "f"])).toBe(simultaneousStrength(8));
  });
});

describe("isPersonaName — the cheap guard, stated on its own", () => {
  test("accepts every legitimate attestor in the live corpus", () => {
    for (const ok of ["alexa", "otto", "soraya", "society", "otto-cli", "ani", "amara", "a"]) {
      expect(isPersonaName(ok)).toBe(true);
    }
  });

  test("REJECTS the values that actually reached main", () => {
    // Six committed attestations on `origin/main` (3465e2fc57) carry these as their
    // ATTESTOR; six carry one as their ATTESTED. They are `mkdtempSync` fixture
    // directories. No cryptography is needed to know a filesystem path is not an
    // identity — and a fresh path per run means each reads as a NEW distinct
    // witness, which is a Sybil count anyone can mint for free.
    for (const bad of ["/tmp/attest-0rHTQr", "/tmp/attest-4EC3oi", "/tmp/attest-hqFnhO"]) {
      expect(isPersonaName(bad)).toBe(false);
    }
  });

  test("REJECTS the neighbouring bad shapes too", () => {
    for (const bad of ["", " ", "Otto", "otto ", "../../etc/passwd", "a".repeat(65), "-otto", "otto\nalexa"]) {
      expect(isPersonaName(bad)).toBe(false);
    }
  });

  test("says nothing about whether the persona EXISTS — shape is not existence", () => {
    // A well-formed name nobody has ever heard of passes here and is refused by the
    // ROSTER (`unknown-attestor`). Conflating the two would make a regex look like
    // an identity provider, which is the substitution this whole work-item is about.
    expect(isPersonaName("nobody-has-this-name")).toBe(true);
  });
});
