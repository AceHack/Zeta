/**
 * frost-hsm-secrets.ts — the STORE SEAM for the YubiHSM ceremony.
 *
 * ============================================================================
 * WHAT THIS EXISTS TO FIX — THE HUMAN WAS THE SECRET TRANSPORT
 * ============================================================================
 *
 * `frost-hsm-provision.ts` shipped correct (PR #15564) and the invocation an agent had to
 * hand an operator was this:
 *
 *     export ZETA_YUBIHSM_PASSWORD=<secret>
 *     export ZETA_FROST_PKCS11_PIN=0001<secret>
 *     bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply
 *
 * Aaron, 2026-08-26, refusing exactly that: *"i can touch to test if you bring up touch and
 * test how to make it human AI safe without random bash command — our zflash is close to
 * this."*
 *
 * Two separate defects live in those three lines:
 *
 *  1. THE CREDENTIAL IS ON A COMMAND LINE. It lands in shell history, in `ps e` for the life
 *     of every child process, and in any scrollback or screen share. `docs/SHELL-DEPRECATION-
 *     SEQUENCE.md` already measured this class as `argv-secret`.
 *  2. THE HUMAN IS THE TRANSPORT. `docs/protocols/ai-human-secure-handoff.md` §3.1 says the
 *     agent never holds the secret and it is resolved from a store at use time. An operator
 *     typing an export is doing the agent's forbidden job on the agent's behalf, which
 *     satisfies the letter of the invariant and voids its point.
 *
 * This module is the store seam that removes both: the ceremony reads its one credential
 * from the OS keystore by NAME, and the name is the only thing that ever appears on a
 * command line.
 *
 * ============================================================================
 * WHAT ZFLASH DOES THAT THIS DID NOT — the pattern Aaron named, adopted not reinvented
 * ============================================================================
 *
 * `.claude/skills/agent-runtime-and-persistence/blueprints/zflash-overview.md` documents the
 * shipped `zeta flash usb` shape, and the reason he called it close is its ARGUMENT LIST:
 *
 *     $ zeta flash usb
 *     ISO: ~/Downloads/zeta-installer-25.11.iso (1.70 GiB)
 *     USB: /dev/disk6 (115 GiB, USB 3.2.1 FD)
 *     *** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
 *     type: yes a3f9
 *
 * Zero arguments. Everything the act needs is DISCOVERED (newest ISO, newest removable
 * device), DISPLAYED, and then approved with a short typed nonce plus Touch ID through
 * pam_tid. Nothing sensitive is ever typed, because nothing sensitive is ever an input.
 *
 * Three of those four properties transfer here and are implemented — discovery of the PKCS#11
 * module and the connector config (`frost-hsm-provision.ts`), a displayed fully-specified
 * plan, and the Touch ID gate (`biometric.ts`, the same `pam_tid` door zflash uses). The
 * fourth, the typed nonce, is DELIBERATELY NOT COPIED: zflash's nonce guards an irreversible
 * destruction of a disk the operator might have misidentified, and this ceremony's device is
 * fixed by the plan and its act adds one object. Adding a second consent surface where the
 * brief already carries the whole act would fork the thing the human reads, which is the
 * drift `ceremony-brief.ts` exists to prevent.
 *
 * WHAT ZFLASH DOES NOT DO, STATED SO THE COMPARISON IS HONEST: `zflash-creds.md` is the
 * credential half of that lane and it is `status: placeholder` — its `--bake-cred
 * <name>=keychain:<account>` source-URI syntax is DESIGNED AND NOT IMPLEMENTED (`--bake-cred`
 * appears in no `.ts` in the repo). So zflash did not already solve credential resolution and
 * there was nothing to adopt there; what it solved, and what is adopted above, is the
 * INVOCATION SHAPE.
 *
 * ============================================================================
 * ONE STORED SECRET, NOT TWO
 * ============================================================================
 *
 * The two exports at the top of this file are not two secrets. The PKCS#11 PIN for a YubiHSM
 * is the 4-hex-digit auth-key id concatenated with the device password — stated in
 * `frost-hsm-provision.ts`'s own header, printed in its `login-refused` remedy, and measured
 * on the device 2026-08-26. So the store holds the PASSWORD and the PIN is DERIVED, which
 * halves what an operator has to keep and removes the class of failure where the two drift.
 */

import { readGenericPassword } from "../../../src/Core.TypeScript/secrets/keychain-macos.ts";
import { keychainSecretSource, Secret, type SecretRequirement, type SecretSource } from "./ceremony-handoff.ts";

/**
 * The keystore item name the ceremony reads. A flat `zeta-*` label, the convention every
 * other item in this repo's keychain already follows (`zeta-op-service-account`,
 * `zeta-op-aaron`, …).
 *
 * This string IS the operator-facing interface: it is what appears in the refusal's remedy,
 * what they pass to `secret-clip.sh set`, and the only part of the credential that is ever
 * allowed on a command line.
 */
export const FROST_HSM_PASSWORD_REF = "zeta-yubihsm-password";

/** The one credential the ceremony declares. Purpose text lands in the refusal, so it is
 *  written for the reader who has several credentials and needs to know which is missing. */
export const FROST_HSM_PASSWORD_REQUIREMENT: SecretRequirement = {
  ref: FROST_HSM_PASSWORD_REF,
  purpose: "the YubiHSM device password (the `-p` argument to yubihsm-shell, and the tail of the PKCS#11 PIN)",
};

/**
 * The store, with a remedy that ends where the operator started.
 *
 * ── WHY THE `thenAlso` STEP IS A RE-RUN AND NOT AN EXPORT ────────────────────────────
 *
 * `ceremony-handoff.test.ts` pinned this consumer's remedy before the consumer existed, and
 * its final step read:
 *
 *     ZETA_YUBIHSM_PASSWORD=$(tools/setup/secret-clip.sh get zeta-yubihsm-password) bun …
 *
 * That was the right sentence for a call site that could only read an environment variable —
 * a migration crutch, and the test says so. It is the WRONG sentence now: a one-shot
 * assignment is still inherited by every child of that command and still visible in `ps e`,
 * and it still routes the value through the operator's shell. The call site reads the
 * keystore itself, so the remedy's last step is simply to run the ceremony again.
 */
export function frostHsmSecretSource(read: (service: string) => string | undefined): SecretSource {
  return keychainSecretSource({
    read,
    thenAlso: () => [
      {
        why: "re-run the ceremony — it reads the keystore itself, so nothing is exported and nothing is typed",
        command: "bun tools/setup/persona-keys/frost-hsm-provision.ts status",
      },
    ],
  });
}

/**
 * The real keystore reader. Separated from `frostHsmSecretSource` so every test can describe
 * a host with the item present or absent without touching the login Keychain, and so this
 * module carries no hard dependency on the macOS-only path (§13 noninterference).
 *
 * `readGenericPassword` reports HOW it was served in `via`. Today every item in this
 * keychain carries an ACL naming only `security(1)`, so the read falls back to the deputy —
 * reported, never silent (workitem 081M01028VF087G0R001W0VD0B).
 */
export function realKeystoreRead(): (service: string) => string | undefined {
  return (service) => {
    const r = readGenericPassword(service);
    return r.ok ? r.secret : undefined;
  };
}

/** Thrown when a PIN cannot be derived. A defect in the caller's arguments, never in the
 *  operator's environment — so it is distinct from a `Refusal`, which is the operator's. */
export class Pkcs11PinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pkcs11PinError";
  }
}

/**
 * Derive the PKCS#11 PIN from the device password and the auth-key id.
 *
 * Yubico's PKCS#11 module takes the PIN as `<4-hex-digit auth key id><password>`; auth key 1
 * with password `password` is `0001password`. MEASURED 2026-08-26 on this device (firmware
 * 2.4.1, serial 39160506): `-p 0001password` authenticates through PKCS#11 and
 * `--authkey 1 -p password` authenticates through `yubihsm-shell`, and the two spellings are
 * not interchangeable between the tools.
 *
 * UNVERIFIED, AND SAID OUT LOUD RATHER THAN ASSUMED: the hex digits are emitted LOWERCASE,
 * which is unobservable for the default auth key 1 (`0001`) and every id below 0x000a. No id
 * with a digit above 9 has been exercised against this module, so a caller using one is
 * relying on the module parsing hex case-insensitively — likely, and not measured here.
 * `frost-hsm-provision.ts` prints that caveat in its readout when the id calls for it.
 *
 * Returns a `Secret`, not a string: the derived PIN is exactly as sensitive as the password
 * it contains, and handing back a bare string would put it into the first log line or crash
 * dump that stringified an options object.
 */
export function pkcs11PinFor(password: Secret, authKeyId: number): Secret {
  if (!Number.isInteger(authKeyId) || authKeyId < 1 || authKeyId > 0xffff) {
    throw new Pkcs11PinError(
      `frost-hsm-secrets: auth key id ${String(authKeyId)} is not a YubiHSM object id. Object ids are ` +
        "integers in 1..65535 and the PIN encodes one as exactly four hex digits; anything else would " +
        "produce a PIN of the wrong length that fails at login with no indication of why.",
    );
  }
  if (password.isEmpty) {
    throw new Pkcs11PinError(
      "frost-hsm-secrets: the device password is empty, so the derived PIN would be four hex digits and " +
        "nothing else. Refusing to build it: an empty credential that is syntactically well-formed is the " +
        "worst kind, because it fails at login looking like a wrong password rather than like an absent one.",
    );
  }
  return new Secret(
    `${authKeyId.toString(16).padStart(4, "0")}${password.reveal()}`,
    `derived(pkcs11-pin authkey=${String(authKeyId)}) from ${password.origin}`,
  );
}

/** True when the derived PIN's hex digits reach into the a–f range, i.e. when the lowercase
 *  choice documented above becomes observable and therefore a claim rather than a formality.
 *  Exported so the CLI can print the caveat exactly when it applies, and stay quiet when it
 *  does not — a warning that is always on carries no information. */
export function pinHexCaseIsObservable(authKeyId: number): boolean {
  return /[a-f]/.test(authKeyId.toString(16).padStart(4, "0"));
}
