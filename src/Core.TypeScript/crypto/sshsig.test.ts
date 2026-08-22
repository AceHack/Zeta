import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  armor,
  findRosterEntry,
  parseRoster,
  parseSshPublicKeyLine,
  parseSshSig,
  sshFingerprint,
  sshString,
  u32be,
  unarmor,
  verifySshSig,
} from "./sshsig.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

// ---------------------------------------------------------------------------
// GOLDEN VECTOR — produced by REAL `ssh-keygen -Y sign`, not by this code.
// ---------------------------------------------------------------------------
// Generated 2026-08-17 with an ephemeral key (OpenSSH on darwin 25.5.0):
//
//   ssh-keygen -t ed25519 -N "" -C receipt-test -f k
//   printf 'hello receipt' > msg
//   ssh-keygen -Y sign -n zeta.build-receipt.v1 -f k msg
//
// This is what makes the anchor CHECKED rather than cited: the verifier below is
// a from-scratch reimplementation of PROTOCOL.sshsig, and the only thing that
// proves it reimplemented the right protocol is that it accepts bytes OpenSSH
// produced. A test that signed with this module and verified with this module
// would pass just as happily on a private format of its own invention.
//
// Text-only per no-binary-in-proof-lineage: the signature is base64 in source,
// so a drift in either implementation shows up as a readable diff.
const GOLDEN_PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAkgsuJsQCYnktiBhVImV5Z5h2zRec5YUKnEauX+xXM receipt-test";
const GOLDEN_SIG =
  "U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgACSCy4mxAJieS2IGFUiZXlnmHb" +
  "NF5zlhQqcRq5f7FcwAAAAVemV0YS5idWlsZC1yZWNlaXB0LnYxAAAAAAAAAAZzaGE1MTIA" +
  "AABTAAAAC3NzaC1lZDI1NTE5AAAAQMZyGJUD9BlhQ3p2X5dFUk3ySuSXtzkrNgkThd9ypB" +
  "bErMSoVKyHW1WuTlq7lQHheJwpf/OjebIbwxYWkgDKJwg=";
const GOLDEN_MESSAGE = new TextEncoder().encode("hello receipt");
const GOLDEN_NAMESPACE = "zeta.build-receipt.v1";

describe("wire primitives", () => {
  test("u32be is big-endian and refuses out-of-range values", () => {
    expect(hex(u32be(1))).toBe("00000001");
    expect(hex(u32be(0xdeadbeef))).toBe("deadbeef");
    expect(() => u32be(-1)).toThrow(/not a u32/);
    expect(() => u32be(0x1_0000_0000)).toThrow(/not a u32/);
  });

  test("sshString is length-prefixed, so the encoding is injective", () => {
    expect(hex(sshString("abc"))).toBe("00000003616263");
    // The property that matters: ("aa","b") and ("a","ab") cannot collide.
    const a = hex(sshString("aa")) + hex(sshString("b"));
    const b = hex(sshString("a")) + hex(sshString("ab"));
    expect(a).not.toBe(b);
  });
});

describe("public keys and fingerprints", () => {
  test("fingerprint of the COMMITTED aaron key equals the fingerprint committed beside it", () => {
    // Cross-check against real repo data, not a fixture: maintainers/aaron/ssh-pubkeys.txt
    // and maintainers/aaron/keyring-public.json were written independently of this code,
    // and `ssh-keygen -lf` prints the same string.
    const line = readFileSync(join(REPO_ROOT, "maintainers", "aaron", "ssh-pubkeys.txt"), "utf8");
    const parsed = parseSshPublicKeyLine(line.split("\n")[0] ?? "");
    expect(parsed).not.toBeNull();
    const keyring = JSON.parse(readFileSync(join(REPO_ROOT, "maintainers", "aaron", "keyring-public.json"), "utf8")) as {
      ssh_fingerprint: string;
    };
    expect(sshFingerprint(parsed?.blob ?? new Uint8Array())).toBe(keyring.ssh_fingerprint);
  });

  test("a truncated or non-ed25519 key line is refused, not silently accepted", () => {
    expect(parseSshPublicKeyLine("ssh-rsa AAAAB3NzaC1yc2E= someone@host")).toBeNull();
    expect(parseSshPublicKeyLine("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAk truncated")).toBeNull();
    expect(parseSshPublicKeyLine("# a comment")).toBeNull();
    expect(parseSshPublicKeyLine("")).toBeNull();
  });

  test("a roster is parsed from authorized_keys text and looked up by exact fingerprint", () => {
    const roster = parseRoster(`# comment\n${GOLDEN_PUBKEY}\n`, "test-roster");
    expect(roster.length).toBe(1);
    const fp = roster[0]?.fingerprint ?? "";
    expect(findRosterEntry(roster, fp)?.source).toBe("test-roster");
    // No prefix matching: a truncated fingerprint must not match.
    expect(findRosterEntry(roster, fp.slice(0, 20))).toBeNull();
  });
});

describe("SSHSIG verification against real ssh-keygen output", () => {
  test("the golden signature verifies", () => {
    const r = verifySshSig(GOLDEN_SIG, GOLDEN_MESSAGE, GOLDEN_NAMESPACE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fingerprint).toBe(sshFingerprint(parseSshPublicKeyLine(GOLDEN_PUBKEY)?.blob ?? new Uint8Array()));
  });

  test("armored and unarmored forms verify identically", () => {
    expect(verifySshSig(armor(GOLDEN_SIG), GOLDEN_MESSAGE, GOLDEN_NAMESPACE).ok).toBe(true);
    expect(unarmor(armor(GOLDEN_SIG))).toBe(GOLDEN_SIG);
  });

  test("ONE FLIPPED MESSAGE BYTE is refused", () => {
    const tampered = new TextEncoder().encode("hello receipu");
    expect(verifySshSig(GOLDEN_SIG, tampered, GOLDEN_NAMESPACE)).toEqual({ ok: false, reason: "bad-signature" });
  });

  test("a message that is a PREFIX of the signed one is refused", () => {
    expect(verifySshSig(GOLDEN_SIG, new TextEncoder().encode("hello"), GOLDEN_NAMESPACE).ok).toBe(false);
  });

  test("NAMESPACE MISMATCH is refused — this is the cross-protocol replay guard", () => {
    // The same bytes, signed for git commit signing, must not count as an attestation.
    expect(verifySshSig(GOLDEN_SIG, GOLDEN_MESSAGE, "git")).toEqual({ ok: false, reason: "namespace-mismatch" });
  });

  test("a flipped signature byte is refused", () => {
    const raw = Buffer.from(GOLDEN_SIG, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0x01;
    expect(verifySshSig(raw.toString("base64"), GOLDEN_MESSAGE, GOLDEN_NAMESPACE)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  test("a flipped PUBLIC KEY byte is refused (the key is inside the signed envelope)", () => {
    const raw = Buffer.from(GOLDEN_SIG, "base64");
    raw[20] = (raw[20] ?? 0) ^ 0x01; // inside the embedded publickey string
    const r = verifySshSig(raw.toString("base64"), GOLDEN_MESSAGE, GOLDEN_NAMESPACE);
    expect(r.ok).toBe(false);
  });
});

describe("structural refusals — each parse failure has its own reason", () => {
  const blob = (build: (b: Buffer) => Buffer) => build(Buffer.from(GOLDEN_SIG, "base64")).toString("base64");

  test("bad magic", () => {
    expect(parseSshSig(blob((b) => Buffer.concat([Buffer.from("XSHSIG"), b.subarray(6)])))).toEqual({
      ok: false,
      reason: "bad-magic",
    });
  });

  test("unsupported version", () => {
    expect(
      parseSshSig(
        blob((b) => {
          const c = Buffer.from(b);
          c[9] = 2;
          return c;
        }),
      ),
    ).toEqual({ ok: false, reason: "unsupported-version" });
  });

  test("truncated", () => {
    expect(parseSshSig(blob((b) => b.subarray(0, 40)))).toEqual({ ok: false, reason: "truncated" });
  });

  test("trailing bytes", () => {
    expect(parseSshSig(blob((b) => Buffer.concat([b, Buffer.from([0])])))).toEqual({
      ok: false,
      reason: "trailing-bytes",
    });
  });

  test("not base64 at all", () => {
    expect(parseSshSig("not a signature!!").ok).toBe(false);
    expect(parseSshSig("").ok).toBe(false);
  });
});
