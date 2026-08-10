import { describe, expect, test } from "bun:test";
import type { PhaseState } from "./phase-clock";
import {
  PHASE_STAMP_DOMAIN,
  canonicalBytes,
  stampSigningBytes,
  u32be,
  verifySignedStamp,
  type RosterEntry,
  type SignatureScheme,
  type SignedStamp,
} from "./signed-stamp";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const stamp = (phase: number, seed: number): PhaseState => ({
  phase,
  seed,
  lastAdvanceReason: "init",
  wallClockAt: "",
});

describe("byte-lock — the canonical encoding is fixed, and drift shows as a readable diff", () => {
  test("GOLDEN VECTOR: subject 'alice', phase 7, seed 0xdeadbeef", () => {
    // Hex-in-source per no-binary-in-proof-lineage: a change in EITHER language surfaces
    // here as a diff rather than as a silent verification failure for some inputs.
    //
    //   7a6574612e70686173652d7374616d702e7631  "zeta.phase-stamp.v1"
    //   00000005                                u32be len("alice")
    //   616c696365                              "alice"
    //   00000008                                u32be len(payload)
    //   00000007                                u32be phase = 7
    //   deadbeef                                u32be seed
    expect(hex(stampSigningBytes("alice", stamp(7, 0xdeadbeef)))).toBe(
      "7a6574612e70686173652d7374616d702e763100000005616c6963650000000800000007deadbeef",
    );
  });

  test("length prefixes are BIG-endian, asserted directly", () => {
    // The F# side writes these out byte by byte rather than via a platform helper, for
    // exactly this reason. A little-endian encoding would produce "01000000".
    expect(hex(u32be(1))).toBe("00000001");
    expect(hex(u32be(0xdeadbeef))).toBe("deadbeef");
  });

  test("u32be refuses out-of-range values instead of silently truncating", () => {
    expect(() => u32be(-1)).toThrow(/not a u32/);
    expect(() => u32be(0x1_0000_0000)).toThrow(/not a u32/);
    expect(() => u32be(1.5)).toThrow(/not a u32/);
  });
});

describe("injectivity — a signature cannot be moved between assertions", () => {
  test("no two distinct (scope, payload) pairs share signed bytes", () => {
    // The classic attack length-prefixing defeats: ("ab","c") vs ("a","bc").
    const a = canonicalBytes("d", "ab", new TextEncoder().encode("c"));
    const b = canonicalBytes("d", "a", new TextEncoder().encode("bc"));
    expect(hex(a)).not.toBe(hex(b));
  });

  test("different subjects, same stamp — different bytes", () => {
    const s = stamp(3, 99);
    expect(hex(stampSigningBytes("alice", s))).not.toBe(hex(stampSigningBytes("bob", s)));
  });

  test("same subject, different phase or seed — different bytes", () => {
    expect(hex(stampSigningBytes("a", stamp(3, 99)))).not.toBe(
      hex(stampSigningBytes("a", stamp(4, 99))),
    );
    expect(hex(stampSigningBytes("a", stamp(3, 99)))).not.toBe(
      hex(stampSigningBytes("a", stamp(3, 100))),
    );
  });
});

describe("domain separation — a signature means ONE thing", () => {
  test("the stamp domain differs from the multisig domain", () => {
    // Without this, a signature collected for one protocol replays as a stamp assertion.
    expect(PHASE_STAMP_DOMAIN).toBe("zeta.phase-stamp.v1");
    expect(PHASE_STAMP_DOMAIN).not.toBe("zeta.multisig.v1");
  });

  test("identical scope and payload under different domains produce different bytes", () => {
    const payload = new Uint8Array([1, 2, 3]);
    expect(hex(canonicalBytes("zeta.multisig.v1", "s", payload))).not.toBe(
      hex(canonicalBytes(PHASE_STAMP_DOMAIN, "s", payload)),
    );
  });
});

// A deterministic stand-in scheme. Not cryptography — it exercises the PORT, which is what
// this module owns. Real schemes are injected; this module holds no key material.
const toyScheme: SignatureScheme = {
  id: "toy-v1",
  verify: (publicKey, message, signature) => {
    const want = new Uint8Array(message.length);
    for (let i = 0; i < message.length; i++) want[i] = message[i]! ^ publicKey[i % publicKey.length]!;
    return hex(want) === hex(signature);
  },
};
const sign = (publicKey: Uint8Array, message: Uint8Array) => {
  const out = new Uint8Array(message.length);
  for (let i = 0; i < message.length; i++) out[i] = message[i]! ^ publicKey[i % publicKey.length]!;
  return out;
};

describe("verification against the verifier's OWN roster", () => {
  const key = new Uint8Array([0xa5, 0x5a, 0x0f]);
  const subject = "did:zeta:9f2a";
  const s = stamp(12, 0x1234);
  const signed = (): SignedStamp => ({
    subject,
    stamp: s,
    signer: "alice",
    scheme: "toy-v1",
    signature: sign(key, stampSigningBytes(subject, s)),
  });
  const roster: RosterEntry[] = [{ signer: "alice", scheme: "toy-v1", publicKey: key }];

  test("an honest signature verifies", () => {
    expect(verifySignedStamp([toyScheme], roster, signed()).kind).toBe("signature-verified");
  });

  test("a tampered stamp fails — the signature covers the CONTENT, not just the name", () => {
    const forged: SignedStamp = { ...signed(), stamp: stamp(12, 0x9999) };
    expect(verifySignedStamp([toyScheme], roster, forged).kind).toBe("signature-invalid");
  });

  test("moving a signature to a different subject fails", () => {
    const moved: SignedStamp = { ...signed(), subject: "someone-else" };
    expect(verifySignedStamp([toyScheme], roster, moved).kind).toBe("signature-invalid");
  });

  test("an unknown signer is reported AS SUCH, not blurred into invalid", () => {
    // Counting a fabricated identity as "merely failed to verify" would lose the
    // distinction between forgery and misconfiguration.
    const stranger: SignedStamp = { ...signed(), signer: "mallory" };
    expect(verifySignedStamp([toyScheme], roster, stranger).kind).toBe("signer-not-on-roster");
  });

  test("an unaccepted scheme is refused before any crypto is attempted", () => {
    const other: SignedStamp = { ...signed(), scheme: "pq-v9" };
    expect(verifySignedStamp([toyScheme], roster, other).kind).toBe("scheme-not-accepted");
  });

  test("HEADLINE: two verifiers with different rosters disagree, and both are correct", () => {
    // No global roster, exactly as KskAuthorization does it. A mandatory shared roster
    // would be the hub this trajectory exists to remove.
    const knows = verifySignedStamp([toyScheme], roster, signed());
    const doesNot = verifySignedStamp([toyScheme], [], signed());
    expect(knows.kind).toBe("signature-verified");
    expect(doesNot.kind).toBe("signer-not-on-roster");
  });

  test("verdicts are neutral facts — no Authentic/Forged in the type", () => {
    const json = JSON.stringify(verifySignedStamp([toyScheme], roster, signed())).toLowerCase();
    for (const forbidden of ["authentic", "forged", "trusted", "impostor"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  test("pure — same inputs, same verdict", () => {
    expect(verifySignedStamp([toyScheme], roster, signed())).toEqual(
      verifySignedStamp([toyScheme], roster, signed()),
    );
  });
});
