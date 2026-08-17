/**
 * CLI binding-factor selection for persist/restore.
 * Default remains usbUuid. Optional --usb-iserial / --uefi-keyfile override.
 * Mutually exclusive extras. No TPM / Touch ID.
 *
 * BOUNDARY WHITESPACE IS REJECTED, NOT REWRITTEN AND NOT ACCEPTED.
 *
 * This function has been the site of three positions in one day, and the third is the
 * one that satisfies both concerns instead of trading them:
 *
 *   #11016  `material: input.usbUuid.trim()` -- silently REWRITE. `--usb-uuid "<A> "`
 *           and `--usb-uuid "<A>"` derived the same key.
 *   #11111  `material: input.usbUuid`        -- silently ACCEPT. Different keys, so the
 *           binding held, but an operator who bound with a stray space and later typed
 *           it without one was locked out of their own blob with no diagnosis.
 *   here    reject with an error             -- FAIL CLOSED, and say why.
 *
 * Why rewriting is wrong: this string is KDF input. Silently changing key material is
 * the "be lenient about operator input" move that `key-refusal-falsifier.test.ts` was
 * written to forbid, and it makes the accepted-input set larger than the identity set.
 *
 * Why bare acceptance is also wrong: it converts a typo into an unrecoverable footgun,
 * discovered later, at restore time, on a machine the operator may no longer have. That
 * is a real cost and the argument for trimming was right to weigh it.
 *
 * Rejecting pays neither cost. The operator is told immediately, at the moment the
 * mistake is made and while the input is still in front of them; nothing is written; no
 * key material is ever rewritten behind their back.
 *
 * WHY NOTHING LEGITIMATE IS REFUSED -- and this is the load-bearing check, not a
 * plausibility argument: a real binding value CANNOT carry boundary whitespace, because
 * every source canonicalizes at the point the artefact is introduced.
 *
 *   - FAT UUID:  `parseUuidFromDiskutilInfo` (zflash/lib.ts) trims diskutil's column
 *                padding AND then requires /^[0-9a-fA-F]{4}-[0-9a-fA-F]{4}$/, a total
 *                regex that cannot match a string with a space. Whitespace is not merely
 *                stripped there, it is unrepresentable downstream.
 *   - iSerial:   `trimOrNull` (usb-iserial-probe.ts) strips the trailing newline that is
 *                an artefact of reading a sysfs attribute.
 *   - keyfile:   bytes, never a string.
 *
 * So there is EXACTLY ONE canonicalization per source and it lives where the artefact is
 * born. The CLI trim was a second, redundant one sitting on top of the first -- which is
 * why removing it broke nothing real, and why re-adding it would buy nothing real either.
 * Boundary whitespace reaching this function means a hand-typed or mis-quoted value, and
 * the honest response to that is an error message.
 *
 * Guarded by `probe-canonicalization-is-the-single-authority` in
 * installer-binding-cli.test.ts: if a probe ever stops canonicalizing, that test fails
 * here rather than letting this rejection start refusing real devices.
 */

import type { CredentialBindingFactorKind } from "./credential-binding-model.ts";
import { isUefiKeyfileError, keyfileBindingMaterial } from "./uefi-keyfile-esp.ts";
import { USB_ISERIAL_SERIAL } from "./usb-iserial-probe.ts";

export type CliBindingSelection = {
  readonly factor: CredentialBindingFactorKind;
  readonly material: string;
};

/**
 * True when `value` has leading or trailing whitespace. Interior whitespace is NOT
 * checked: a USB iSerial may legitimately contain a space, and this function has no
 * business inventing an opinion about the middle of an identity. Only the boundary --
 * exactly the class the old `.trim()` was silently absorbing -- is refused.
 */
function hasBoundaryWhitespace(value: string): boolean {
  return value !== value.trim();
}

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
  if (hasIserial) {
    if (hasBoundaryWhitespace(input.usbISerial!)) {
      return {
        error:
          "--usb-iserial has leading or trailing whitespace; pass the serial exactly as the " +
          "device reports it (refusing rather than trimming, because this value is key material)",
      };
    }
    return { factor: "usbISerial", material: input.usbISerial! };
  }
  if (input.usbUuid !== null && input.usbUuid.trim().length > 0) {
    if (hasBoundaryWhitespace(input.usbUuid)) {
      return {
        error:
          "--usb-uuid has leading or trailing whitespace; pass the UUID exactly as diskutil " +
          "reports it (refusing rather than trimming, because this value is key material)",
      };
    }
    return { factor: "usbUuid", material: input.usbUuid };
  }
  return { error: "binding factor required: --usb-uuid, --usb-iserial, or --uefi-keyfile" };
}

export type InstallPersistBinding = {
  readonly factor: "usbUuid" | "usbISerial";
  readonly flag: "--usb-uuid" | "--usb-iserial";
  readonly material: string;
  readonly marker: string;
};

/**
 * Install-time persist factor. Default stays FAT UUID. ZETA_BIND_USB_ISERIAL=1
 * binds the probed iSerial only when the probe actually produced one.
 * Probe failure with the opt-in set falls back to UUID; it does not fail install
 * and it does not silently skip to an empty factor.
 */
export function selectInstallPersistBinding(input: {
  readonly usbUuid: string | null;
  readonly probedISerial: string | null;
  readonly bindUsbISerial: boolean;
}): InstallPersistBinding | { readonly error: string } {
  const probed =
    input.probedISerial !== null && input.probedISerial.length > 0 ? input.probedISerial : null;
  if (input.bindUsbISerial && probed !== null) {
    const selected = selectCliBindingMaterial({
      usbUuid: input.usbUuid,
      usbISerial: probed,
      uefiKeyfileBytes: null,
    });
    if ("error" in selected) return selected;
    if (selected.factor === "usbISerial") {
      return {
        factor: "usbISerial",
        flag: "--usb-iserial",
        material: selected.material,
        marker: USB_ISERIAL_SERIAL.persistOptInIserial,
      };
    }
  }
  const selected = selectCliBindingMaterial({
    usbUuid: input.usbUuid,
    usbISerial: null,
    uefiKeyfileBytes: null,
  });
  if ("error" in selected) return selected;
  return {
    factor: "usbUuid",
    flag: "--usb-uuid",
    material: selected.material,
    marker: input.bindUsbISerial
      ? USB_ISERIAL_SERIAL.persistOptInFallbackUuid
      : USB_ISERIAL_SERIAL.persistDefaultUuid,
  };
}
