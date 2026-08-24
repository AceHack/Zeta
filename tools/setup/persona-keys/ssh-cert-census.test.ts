// ssh-cert-census.ts — CHECKED against the tool it replaces, not asserted against itself.
//
// This module reads OpenSSH certificate fields off the wire so the CA trust-set closing bound can
// stand on a fact ("does an unexpired certificate still name this CA?") instead of a timer. A
// hand-rolled wire parser is worth exactly as much as its differential: every field asserted here is
// compared against `ssh-keygen -L` / `ssh-keygen -l` output for certificates signed by a REAL
// `ssh-keygen -s`. If the parser and OpenSSH ever disagree, this file goes red.
//
// ┌─ SANDBOX ────────────────────────────────────────────────────────────────────────────────────┐
// │ Every key and certificate is generated inside a mktemp dir and deleted after. No biometric    │
// │ door of any kind is imported. Nothing reads ~/.config/zeta. Private keys are generated (they  │
// │ must be, to sign) and are NEVER read, printed or asserted on — only public certs and public   │
// │ fingerprints cross an assertion.                                                              │
// └───────────────────────────────────────────────────────────────────────────────────────────────┘
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  censusOfCertificates,
  parseSshCertificate,
  sshPublicKeyFingerprint,
} from "./ssh-cert-census.ts";

/** Every subprocess runs with TZ=UTC so `ssh-keygen -L`'s LOCAL-time rendering and this file's
 *  formatting agree by construction. Without it the differential compares two clocks, not a parse
 *  — it failed exactly that way on first run (a 4-hour offset), which is the check working. */
function sh(cmd: string, args: readonly string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(cmd, [...args], { encoding: "utf8", env: { ...process.env, TZ: "UTC" } });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

interface Fixture {
  readonly dir: string;
  readonly caPubLine: string;
  readonly caFingerprint: string;
  readonly cleanup: () => void;
}

function keygen(dir: string, name: string, type: string, extra: readonly string[] = []): void {
  const r = sh("ssh-keygen", ["-q", "-t", type, ...extra, "-N", "", "-C", `zeta-test-${name}`, "-f", join(dir, name)]);
  expect(r.status).toBe(0);
}

function fixture(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), "zeta-census-"));
  keygen(dir, "ca", "ed25519");
  const caPubLine = readFileSync(join(dir, "ca.pub"), "utf8").trim();
  const l = sh("ssh-keygen", ["-l", "-f", join(dir, "ca.pub")]);
  expect(l.status).toBe(0);
  const caFingerprint = /SHA256:\S+/.exec(l.stdout)![0];
  return { dir, caPubLine, caFingerprint, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Sign `<name>.pub` into `<name>-cert.pub` with the fixture CA, returning the cert text. */
function signCert(
  fx: Fixture,
  name: string,
  opts: { readonly keyId: string; readonly principals: string; readonly validity: string },
): string {
  const r = sh("ssh-keygen", [
    "-q", "-s", join(fx.dir, "ca"), "-I", opts.keyId, "-n", opts.principals, "-V", opts.validity,
    join(fx.dir, `${name}.pub`),
  ]);
  expect(r.status).toBe(0);
  return readFileSync(join(fx.dir, `${name}-cert.pub`), "utf8").trim();
}

/** `ssh-keygen -L` as the oracle. Returns the fields this module claims to parse. */
function opensshView(certPath: string): {
  readonly signingCa: string;
  readonly keyId: string;
  readonly principals: readonly string[];
  readonly validFrom: string;
  readonly validTo: string;
} {
  const r = sh("ssh-keygen", ["-L", "-f", certPath]);
  expect(r.status).toBe(0);
  const out = r.stdout;
  const signingCa = /Signing CA:\s+\S+\s+(SHA256:\S+)/.exec(out)![1]!;
  const keyId = /Key ID:\s+"([^"]*)"/.exec(out)![1]!;
  const principalsBlock = /Principals:\s*\n((?:\s+\S+\n)+)/.exec(out);
  const principals = principalsBlock === null
    ? []
    : principalsBlock[1]!.split("\n").map((x) => x.trim()).filter((x) => x.length > 0);
  const valid = /Valid:\s+(.*)/.exec(out)![1]!;
  const fromTo = /from (\S+) to (\S+)/.exec(valid);
  return {
    signingCa,
    keyId,
    principals,
    validFrom: fromTo?.[1] ?? valid.trim(),
    validTo: fromTo?.[2] ?? valid.trim(),
  };
}

/** Format an epoch-second as OpenSSH prints it in `-L`, under the TZ=UTC the subprocess runs in. */
function opensshLocalTimestamp(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CX-1 — THE DIFFERENTIAL. Every field, against `ssh-keygen -L`, on a real signed certificate.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CX-1: parsed certificate fields agree with `ssh-keygen -L` field for field", () => {
  const fx = fixture();
  try {
    keygen(fx.dir, "dev", "ed25519");
    const certText = signCert(fx, "dev", { keyId: "some-machine", principals: "alice,bob", validity: "+52w" });
    const parsed = parseSshCertificate(certText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const oracle = opensshView(join(fx.dir, "dev-cert.pub"));
    expect(parsed.facts.signingCaFingerprint).toBe(oracle.signingCa);
    expect(parsed.facts.signingCaFingerprint).toBe(fx.caFingerprint); // ...and it IS the CA's own fp
    expect(parsed.facts.keyId).toBe(oracle.keyId);
    expect([...parsed.facts.principals]).toEqual([...oracle.principals]);
    // The timestamps, rendered exactly as OpenSSH renders them.
    expect(opensshLocalTimestamp(parsed.facts.validAfter)).toBe(oracle.validFrom);
    expect(opensshLocalTimestamp(parsed.facts.validBefore)).toBe(oracle.validTo);

    // DISCRIMINATION: a corrupted body must NOT parse. Without this the assertions above could be
    // satisfied by a parser that returns whatever the oracle happens to say.
    const fields = certText.split(/\s+/);
    const corrupted = `${fields[0]} ${fields[1]!.slice(0, 40)}`;
    expect(parseSshCertificate(corrupted).ok).toBe(false);
  } finally {
    fx.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CX-2 — the fingerprint function is byte-identical to `ssh-keygen -l`, across key types.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CX-2: sshPublicKeyFingerprint == `ssh-keygen -l` for ed25519, rsa and ecdsa public keys", () => {
  const fx = fixture();
  try {
    for (const [name, type, extra] of [
      ["k-ed", "ed25519", []],
      ["k-rsa", "rsa", ["-b", "2048"]],
      ["k-ec", "ecdsa", ["-b", "256"]],
    ] as const) {
      keygen(fx.dir, name, type, extra);
      const line = readFileSync(join(fx.dir, `${name}.pub`), "utf8").trim();
      const oracle = /SHA256:\S+/.exec(sh("ssh-keygen", ["-l", "-f", join(fx.dir, `${name}.pub`)]).stdout)![0];
      expect(sshPublicKeyFingerprint(line)).toBe(oracle);
    }
    // Non-key input is REFUSED rather than hashed into a trust set.
    expect(() => sshPublicKeyFingerprint("not a key")).toThrow();
    expect(() => sshPublicKeyFingerprint("")).toThrow();
  } finally {
    fx.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CX-3 — the SUBJECT-KEY FIELD TABLE. Each certificate key type places `serial` after a different
// number of subject fields; getting the count wrong yields plausible garbage, not an error. So
// every entry in the table that `ssh-keygen` can produce is signed for real and cross-checked.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CX-3: rsa and ecdsa certificate layouts parse correctly (the field-count table is checked)", () => {
  const fx = fixture();
  try {
    for (const [name, type, extra] of [
      ["s-rsa", "rsa", ["-b", "2048"]],
      ["s-ec256", "ecdsa", ["-b", "256"]],
      ["s-ec384", "ecdsa", ["-b", "384"]],
    ] as const) {
      keygen(fx.dir, name, type, extra);
      const certText = signCert(fx, name, { keyId: `id-${name}`, principals: "carol", validity: "+4w" });
      const parsed = parseSshCertificate(certText);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const oracle = opensshView(join(fx.dir, `${name}-cert.pub`));
      expect(parsed.facts.keyId).toBe(oracle.keyId); // wrong field count ⇒ garbage here
      expect(parsed.facts.signingCaFingerprint).toBe(oracle.signingCa);
      expect(opensshLocalTimestamp(parsed.facts.validBefore)).toBe(oracle.validTo);
    }
  } finally {
    fx.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CX-4 — FAIL-CLOSED. An unknown key type is REFUSED, never guessed at, because a wrong guess
// yields a wrong signing-CA fingerprint, and a wrong fingerprint in a closing bound evicts a CA
// that something still needs.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CX-4: an unknown certificate key type is refused, and the refusal names it", () => {
  const fx = fixture();
  try {
    keygen(fx.dir, "dev", "ed25519");
    const certText = signCert(fx, "dev", { keyId: "m", principals: "u", validity: "+1w" });
    const body = certText.split(/\s+/)[1]!;
    const bogus = parseSshCertificate(`ssh-future-cert-v99@openssh.com ${body}`);
    expect(bogus.ok).toBe(false);
    if (!bogus.ok) expect(bogus.reason).toContain("ssh-future-cert-v99@openssh.com");

    // A body that does not match its declared type is refused too (embedded type is checked).
    keygen(fx.dir, "rsadev", "rsa", ["-b", "2048"]);
    const rsaCert = signCert(fx, "rsadev", { keyId: "m", principals: "u", validity: "+1w" });
    const mismatched = parseSshCertificate(`ssh-ed25519-cert-v01@openssh.com ${rsaCert.split(/\s+/)[1]}`);
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) expect(mismatched.reason).toContain("type mismatch");
  } finally {
    fx.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CX-5 — THE CENSUS ITSELF: expiry decides, an unparseable certificate makes it INCOMPLETE, and a
// never-expiring certificate keeps its CA needed forever.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CX-5: the census counts only UNEXPIRED signers, and one unparseable cert makes it incomplete", () => {
  const fx = fixture();
  try {
    keygen(fx.dir, "live", "ed25519");
    keygen(fx.dir, "dead", "ed25519");
    keygen(fx.dir, "eternal", "ed25519");
    const live = signCert(fx, "live", { keyId: "live", principals: "u", validity: "+52w" });
    const dead = signCert(fx, "dead", { keyId: "dead", principals: "u", validity: "-52w:-1w" });
    const eternal = signCert(fx, "eternal", { keyId: "eternal", principals: "u", validity: "always:forever" });
    const now = Math.floor(Date.now() / 1000);

    // The EXPIRED certificate alone does not keep its CA needed...
    const onlyDead = censusOfCertificates([{ path: "dead", text: dead }], now);
    expect(onlyDead.complete).toBe(true);
    expect(onlyDead.certificatesFound).toBe(1);
    expect([...onlyDead.unexpiredSigners]).toEqual([]);

    // ...while the live one does. Same CA, same census code, opposite verdict — the expiry is
    // load-bearing, not decorative.
    const withLive = censusOfCertificates(
      [{ path: "dead", text: dead }, { path: "live", text: live }],
      now,
    );
    expect([...withLive.unexpiredSigners]).toEqual([fx.caFingerprint]);

    // A never-expiring certificate keeps its CA needed at any `now` we could be handed.
    const farFuture = censusOfCertificates([{ path: "eternal", text: eternal }], now + 100 * 365 * 24 * 3600);
    expect([...farFuture.unexpiredSigners]).toEqual([fx.caFingerprint]);

    // ONE unreadable certificate makes the whole census incomplete — and an incomplete census is
    // what blocks every drop in rotate.ts.
    const broken = censusOfCertificates(
      [{ path: "live", text: live }, { path: "junk", text: "" }],
      now,
    );
    expect(broken.complete).toBe(false);
    expect(broken.entries.filter((e) => !e.parsed).map((e) => e.path)).toEqual(["junk"]);
  } finally {
    fx.cleanup();
  }
});
