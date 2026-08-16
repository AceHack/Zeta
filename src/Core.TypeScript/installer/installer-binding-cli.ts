/**
 * CLI binding-factor selection for persist/restore.
 * Default remains usbUuid. Optional --usb-iserial / --uefi-keyfile override.
 * Mutually exclusive extras. No TPM / Touch ID.
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
  if (hasIserial) {
    return { factor: "usbISerial", material: input.usbISerial!.trim() };
  }
  if (input.usbUuid !== null && input.usbUuid.trim().length > 0) {
    return { factor: "usbUuid", material: input.usbUuid.trim() };
  }
  return { error: "binding factor required: --usb-uuid, --usb-iserial, or --uefi-keyfile" };
}
