/**
 * The flash safety-rail bounds — ONE definition, imported by every host arm.
 *
 * These four numbers gate whether zflash will write an image to a block
 * device. They were previously defined twelve times across four files
 * (`verify.ts`, `flash-usb.ts`, `flash-usb-linux.ts`, `flash-usb-windows.ts`),
 * and each of those files carried a COMMENT asserting the copies agreed:
 * "one contract, three hosts", "mirror flash-usb.ts exactly", and — in
 * verify.ts — "Exported from here so [they] cannot drift apart", which was
 * not true, because the Linux and Windows arms defined their own.
 *
 * All twelve happened to hold the same values, so nothing was broken. That is
 * exactly what makes it worth removing: a prose assertion of an invariant with
 * no mechanism behind it reads as a guarantee and carries none, and the way it
 * would eventually fail is silent — one arm's floor raised, the other two left
 * behind, and a device that one host refuses and another writes.
 *
 * A single definition makes divergence impossible to express rather than
 * merely untested, so no drift check is needed here — there is nothing left
 * for two copies to disagree about.
 */

/** Smallest ISO zflash will write. Below this the file is not a Zeta installer. */
export const MIN_ISO_BYTES = 200 * 1024 * 1024;

/** Largest ISO zflash will write. Above this something has gone wrong upstream. */
export const MAX_ISO_BYTES = 8 * 1024 * 1024 * 1024;

/** Smallest target device. Below this the ISO cannot fit with room to grow. */
export const MIN_USB_BYTES = 4 * 1024 * 1024 * 1024;

/**
 * Largest target device. Above this the target is very likely an internal
 * disk rather than a removable stick — the bound is a blast-radius guard,
 * not a capability limit.
 */
export const MAX_USB_BYTES = 256 * 1024 * 1024 * 1024;
