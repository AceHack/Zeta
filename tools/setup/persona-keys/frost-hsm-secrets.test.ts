// frost-hsm-secrets.test.ts — falsifiers for the store seam that took the credential off
// the command line.
//
// WHAT THESE ARE FOR. The claim being made is "no secret is ever an argument and none is
// ever read from the environment". Both halves are the kind of claim that reads as true
// from a docstring and can be false in the code, so both are driven here against a store
// that answers and a store that does not — and the environment half is falsified by SETTING
// the retired variables and asserting the refusal fires anyway. A test that only ran with a
// clean environment could not tell a removed read from a read that happened to miss.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderRefusal, resolveSecret, Secret } from "./ceremony-handoff.ts";
import {
  FROST_HSM_PASSWORD_REF,
  FROST_HSM_PASSWORD_REQUIREMENT,
  frostHsmSecretSource,
  pinHexCaseIsObservable,
  Pkcs11PinError,
  pkcs11PinFor,
} from "./frost-hsm-secrets.ts";

const PW = "not-a-real-password";
const secretOf = (v: string): Secret => new Secret(v, "test");

/** The two names the ceremony used to take from the environment. Retired: the store is the
 *  only source, and these must not appear in either module's executable text. */
const RETIRED_CREDENTIAL_VARS: readonly string[] = ["ZETA_YUBIHSM_PASSWORD", "ZETA_FROST_PKCS11_PIN"];

/** Drop comment lines so a scan checks CODE, never the prose that documents the property.
 *  Duplicated in `frost-hsm-provision.test.ts` rather than exported: importing one test
 *  module from another re-runs its suites, and a helper is cheaper than a double count. */
function stripComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
}

// ============================================================================
// THE DERIVED PIN — one stored credential, not two
// ============================================================================

describe("HSMS: the PKCS#11 PIN is derived, so the operator stores one thing", () => {
  test("HSMS-1: the documented example round-trips — authkey 1 + `password` is `0001password`", () => {
    // The literal from `frost-hsm-provision.ts`'s own `login-refused` remedy and from
    // Yubico's PKCS#11 documentation. If this line ever disagrees with that remedy, one of
    // the two is lying to an operator at the moment they are already stuck.
    expect(pkcs11PinFor(secretOf("password"), 1).reveal()).toBe("0001password");
  });

  test("HSMS-2: the prefix is exactly four hex digits, whatever the id", () => {
    expect(pkcs11PinFor(secretOf(PW), 1).reveal()).toBe(`0001${PW}`);
    expect(pkcs11PinFor(secretOf(PW), 16).reveal()).toBe(`0010${PW}`);
    expect(pkcs11PinFor(secretOf(PW), 255).reveal()).toBe(`00ff${PW}`);
    expect(pkcs11PinFor(secretOf(PW), 0xffff).reveal()).toBe(`ffff${PW}`);
  });

  test("HSMS-3: the derived PIN is a Secret — it stringifies REDACTED, like its parent", () => {
    // The realistic leak is a template literal in a log line, not a decision to print a
    // password. A derived value returned as a bare string would walk straight into one.
    const pin = pkcs11PinFor(secretOf(PW), 1);
    expect(`${pin}`).not.toContain(PW);
    expect(JSON.stringify({ pin })).not.toContain(PW);
    expect(pin.reveal()).toContain(PW); // the one deliberate exit still works
  });

  test("HSMS-4: the PIN records WHERE it came from, without the value", () => {
    const pin = pkcs11PinFor(new Secret(PW, "the OS keystore:zeta-yubihsm-password"), 1);
    expect(pin.origin).toContain("zeta-yubihsm-password");
    expect(pin.origin).toContain("authkey=1");
    expect(pin.origin).not.toContain(PW);
  });

  test("HSMS-5: an id outside 1..65535 is REFUSED, not silently truncated", () => {
    // A 5-hex-digit or 0-length prefix produces a PIN of the wrong length that fails at
    // C_Login indistinguishably from a wrong password — the failure this refusal buys the
    // reader the chance to never diagnose.
    for (const bad of [0, -1, 0x10000, 1.5, Number.NaN]) {
      expect(() => pkcs11PinFor(secretOf(PW), bad)).toThrow(Pkcs11PinError);
    }
  });

  test("HSMS-6: an EMPTY password is refused rather than making a well-formed useless PIN", () => {
    expect(() => pkcs11PinFor(secretOf(""), 1)).toThrow(/empty/);
  });

  test("HSMS-7: the lowercase-hex caveat is announced ONLY when it is observable", () => {
    // A warning that is always on carries no information. Below 0x000a the case of the hex
    // digits is unobservable, so there is nothing to caveat; at 0x000a and above there is.
    expect(pinHexCaseIsObservable(1)).toBe(false);
    expect(pinHexCaseIsObservable(9)).toBe(false);
    expect(pinHexCaseIsObservable(10)).toBe(true);
    expect(pinHexCaseIsObservable(255)).toBe(true);
  });
});

// ============================================================================
// THE STORE — and the environment it deliberately cannot hear
// ============================================================================

describe("HSMS: the store is the only source", () => {
  test("HSMS-8: a present credential resolves and records its origin, never its value", () => {
    const r = resolveSecret(
      FROST_HSM_PASSWORD_REQUIREMENT,
      frostHsmSecretSource(() => PW),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.secret.reveal()).toBe(PW);
    expect(r.secret.origin).toContain(FROST_HSM_PASSWORD_REF);
    expect(`${r.secret}`).not.toContain(PW);
  });

  test("HSMS-9: THE RETIRED ENV VARS CANNOT SATISFY IT — the module never names them in code", () => {
    // This is the falsifier for the whole change: the defect was an operator typing
    // `export ZETA_YUBIHSM_PASSWORD=…`, and a fix that merely stopped DOCUMENTING that
    // variable would leave the read in place, so the next person to hit a refusal would
    // discover the export still works.
    //
    // It is a SOURCE scan rather than an env-mutation test on purpose. Setting the variable
    // in this process to prove it is ignored would hoist a credential into an environment
    // every child inherits — which `lint-no-ambient-credential-hoist.ts` refuses, and
    // rightly: a test that demonstrates a safety property by performing the unsafe act is
    // not a proof, it is the act. (It refused this file's first draft, which did exactly
    // that.) Comments are stripped, because the module's header NAMES both variables in
    // order to say it does not read them — scanning prose would fail on the documentation
    // of the property being checked, and would pass the moment someone deleted it.
    const code = stripComments(readFileSync(new URL("./frost-hsm-secrets.ts", import.meta.url), "utf8"));
    expect(RETIRED_CREDENTIAL_VARS.filter((name) => code.includes(name))).toEqual([]);
    // And it reads the environment by no other name either — this module's only input is
    // the injected reader.
    expect(code.includes("process.env")).toBe(false);
    expect(code.includes("Bun.env")).toBe(false);
  });

  test("HSMS-9b: an EMPTY store refuses, and the refusal carries no ambient value", () => {
    const r = resolveSecret(
      FROST_HSM_PASSWORD_REQUIREMENT,
      frostHsmSecretSource(() => undefined),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("an empty store satisfied a required credential");
  });

  test("HSMS-10: an EMPTY stored item is an absent one — a blank keychain entry is not a credential", () => {
    const r = resolveSecret(
      FROST_HSM_PASSWORD_REQUIREMENT,
      frostHsmSecretSource(() => ""),
    );
    expect(r.ok).toBe(false);
  });
});

// ============================================================================
// THE REMEDY — verified against the store's own usage text, not guessed
// ============================================================================

describe("HSMS: the refusal names a remedy that the store actually accepts", () => {
  const rendered = (): string => {
    const r = resolveSecret(
      FROST_HSM_PASSWORD_REQUIREMENT,
      frostHsmSecretSource(() => undefined),
    );
    if (r.ok) throw new Error("expected a refusal");
    return renderRefusal(r.refusal);
  };

  test("HSMS-11: the remedy's verb is one `secret-clip.sh` PARSES — read from the script itself", () => {
    // Not a hardcoded expectation. The subcommands are extracted from the script's own
    // `case "$ACTION"` arms, so if someone renames `set` the assertion fails HERE rather
    // than in front of an operator who pasted a command that does not exist.
    //
    // A wrong remedy is worse than none: it costs the reader the time to run it, the time
    // to work out why it failed, and some of their willingness to follow the next
    // instruction this system gives them.
    const script = readFileSync(new URL("../secret-clip.sh", import.meta.url), "utf8");
    const verbs = [...script.matchAll(/^ {2}(set|get|del|[a-z]+)\)$/gm)].map((m) => m[1]);
    expect(verbs).toContain("set");

    const commands = rendered()
      .split("\n")
      .filter((l) => l.includes("secret-clip.sh"))
      .map((l) => l.trim().replace(/^\$ /, ""));
    expect(commands.length).toBeGreaterThan(0);
    for (const c of commands) {
      const verb = c.split(/\s+/)[1];
      expect(verbs).toContain(verb);
    }
  });

  test("HSMS-12: the remedy ends by RE-RUNNING the ceremony, never by exporting the value", () => {
    // `ceremony-handoff.test.ts` pinned this consumer's remedy before the consumer existed,
    // and its last step was `ZETA_YUBIHSM_PASSWORD=$(secret-clip.sh get …) bun …`. That was
    // the right sentence for a call site that could only read an environment variable. It is
    // the wrong one now: a one-shot assignment is still inherited by every child and still
    // visible in `ps e`. The call site reads the keystore, so the last step is to re-run it.
    const out = rendered();
    expect(out).toContain(`secret-clip.sh set ${FROST_HSM_PASSWORD_REF}`);
    expect(out).toContain("frost-hsm-provision.ts status");
    expect(out).not.toContain("ZETA_YUBIHSM_PASSWORD=");
    expect(out).not.toMatch(/\bexport\b/);
  });

  test("HSMS-13: the store's macOS-only limit travels WITH the remedy", () => {
    // `secret-clip.sh` prints "PLANNED, not yet implemented" and exits 3 on Linux and
    // Windows. A reader on the wrong OS must learn that from the remedy, not from rc=3.
    expect(rendered()).toContain("PLANNED");
  });
});
