/**
 * CLI binding-factor selection for persist/restore.
 * Default remains usbUuid. Optional --usb-iserial / --uefi-keyfile override.
 * Mutually exclusive extras. No TPM / Touch ID.
 *
 * PRESENCE MAY BE TRIMMED; MATERIAL MAY NOT.
 *
 * These are two different questions and conflating them loosened the device binding
 * for a day (#11016 -> this fix). "Was a factor supplied?" is an operator-input
 * question and a whitespace-only value answers no. "What bytes go into the KDF?" is a
 * cryptographic question and the answer is the operator's bytes, verbatim.
 *
 * When `material` was `.trim()`-ed, `--usb-uuid "<A> "` and `--usb-uuid "<A>"` derived
 * the SAME key, so a blob bound to one restored on the other. That is a near-miss
 * identity being silently accepted, which is exactly the oracle
 * `key-refusal-falsifier.test.ts` exists to forbid, and its
 * "identity A with trailing whitespace" case caught it on `main`.
 *
 * Nothing needed the trim: the sysfs probe already normalises at the source
 * (`trimOrNull` in usb-iserial-probe.ts, where the trailing newline is an artefact of
 * reading a sysfs attribute), and the keyfile path never went through a string at all.
 * Normalise where the artefact is introduced, never where the key is derived.
 */

import type { CredentialBindingFactorKind } from "./credential-binding-model.ts";
import { isUefiKeyfileError, keyfileBindingMaterial } from "./uefi-keyfile-esp.ts";

export type CliBindingSelection = {
  readonly factor: CredentialBindingFactorKind;
  readonly material: string;
};

export function selectCliBindingMaterial(input: {
  readonly usbUuid: string | null;
  readonly usbISerial: string | null;
  readonly uefiKeyfileBytes: Uint8Array | null;
}): CliBindingSelection | { readonly error: string } {
  const hasIserial = input.usbISerial !== null && input.usbISerial.trim().length > 0;
  const hasKeyfile = input.uefiKeyfileBytes !== null;
  if (hasIserial && hasKeyfile) {
    return { error: "--usb-iserial and --uefi-keyfile are mutually exclusive" };
  }
  if (hasKeyfile) {
    const material = keyfileBindingMaterial(input.uefiKeyfileBytes!);
    if (isUefiKeyfileError(material)) return { error: material.error };
    return { factor: "uefiKeyfile", material };
  }
  // Material is the operator's bytes verbatim -- see the header. The `.trim()` above is
  // a presence test only; it must never reach the value handed to the KDF.
  if (hasIserial) {
    return { factor: "usbISerial", material: input.usbISerial! };
  }
  if (input.usbUuid !== null && input.usbUuid.trim().length > 0) {
    return { factor: "usbUuid", material: input.usbUuid };
  }
  return { error: "binding factor required: --usb-uuid, --usb-iserial, or --uefi-keyfile" };
}
