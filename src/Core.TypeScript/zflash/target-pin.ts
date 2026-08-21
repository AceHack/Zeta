// src/Core.TypeScript/zflash/target-pin.ts
//
// Choosing a flash target -- as a VALUE the operator can see and a wrapper can
// state, rather than as a decision buried in a destructive script.
//
// The principle this module exists to encode:
//
//   A tool that selects "the external disk" is one plugged-in phone away from
//   destroying it. The target must never be discovered dynamically.
//
// "Never discovered" cannot mean "never enumerated" -- something has to list
// the disks. It means the enumeration produces a PIN that is then stated to
// the destructive step, shown to the operator on the way, and checked again at
// the moment of the write. Discovery becomes a proposal; the pin is the claim.
//
// Everything below the adapter at the bottom is PURE, so every refusal is
// exercised with no hardware attached.

/** One candidate as diskutil describes it. */
export interface UsbCandidate {
  readonly devicePath: string;
  readonly sizeBytes: number;
  readonly mediaName: string;
  readonly busProtocol: string;
  readonly internal: boolean;
}

/** What the operator said, if anything. null means "did not say". */
export interface StatedExpectation {
  readonly devicePath: string | null;
  readonly sizeBytes: number | null;
  readonly mediaName: string | null;
}

/** The three fields flash-usb.ts requires as --expect-* before it will write. */
export interface TargetPin {
  readonly devicePath: string;
  readonly sizeBytes: number;
  readonly mediaName: string;
}

export type PinFailure = "no-usb" | "ambiguous" | "expectation-mismatch";

export type PinResult =
  | { readonly ok: true; readonly pin: TargetPin }
  | { readonly ok: false; readonly reason: PinFailure; readonly error: string };

/**
 * USB, external, and nothing else.
 *
 * Kept separate from the selection below so the filter itself is testable: an
 * internal disk that reports BusProtocol USB (they exist) must never appear in
 * the candidate set, and that is a claim worth being able to falsify.
 */
export function usbCandidates(all: readonly UsbCandidate[]): readonly UsbCandidate[] {
  return all.filter(
    (c) => (c.busProtocol === "USB" || c.busProtocol === "USB-C") && !c.internal,
  );
}

/**
 * Resolve the enumerated disks plus whatever the operator stated into one pin.
 *
 * Order matters and is deliberate:
 *
 *   1. filter to USB + external
 *   2. if the operator named a device, keep only that one -- a name that
 *      matches nothing is a REFUSAL, never a fallback to "the only stick".
 *      Falling back there would mean a typo silently retargets the write.
 *   3. zero candidates -> refuse; more than one -> refuse rather than choose.
 *   4. check the size/model the operator stated against what was found.
 *
 * Step 4 is the one that catches the case this module is named for: the
 * operator meant the 124 GB stick, a phone enumerated first, and the sizes
 * disagree.
 */
export function selectPinnedTarget(
  all: readonly UsbCandidate[],
  stated: StatedExpectation,
): PinResult {
  let pool = usbCandidates(all);
  if (stated.devicePath !== null) {
    const named = pool.filter((c) => c.devicePath === stated.devicePath);
    if (named.length === 0) {
      return {
        ok: false,
        reason: "expectation-mismatch",
        error:
          "you named " +
          stated.devicePath +
          ", and it is not among the external USB devices attached" +
          (pool.length === 0
            ? " (none are)."
            : ": " + pool.map((c) => c.devicePath).join(", ")),
      };
    }
    pool = named;
  }
  if (pool.length === 0) {
    return {
      ok: false,
      reason: "no-usb",
      error:
        "no external USB device found. Plug in the target stick and re-run; if it" +
        " is already plugged in, give the OS a few seconds.",
    };
  }
  if (pool.length > 1) {
    return {
      ok: false,
      reason: "ambiguous",
      error:
        "refusing to pick one of " +
        String(pool.length) +
        " attached USB devices:\n" +
        pool
          .map(
            (c) =>
              "  " + c.devicePath + "  " + String(c.sizeBytes) + " bytes  " + c.mediaName,
          )
          .join("\n") +
        "\nUnplug all but the target, or name it with --expect-device=/dev/diskN.",
    };
  }
  const only = pool[0];
  if (only === undefined) {
    return { ok: false, reason: "no-usb", error: "internal: empty pool after length check" };
  }
  const mismatches: string[] = [];
  if (stated.sizeBytes !== null && stated.sizeBytes !== only.sizeBytes) {
    mismatches.push(
      "  sizeBytes: you said " + String(stated.sizeBytes) + ", found " + String(only.sizeBytes),
    );
  }
  if (stated.mediaName !== null && stated.mediaName !== only.mediaName) {
    mismatches.push("  mediaName: you said " + stated.mediaName + ", found " + only.mediaName);
  }
  if (mismatches.length > 0) {
    return {
      ok: false,
      reason: "expectation-mismatch",
      error:
        "the device found is NOT the device you described -- refusing.\n" +
        mismatches.join("\n"),
    };
  }
  return {
    ok: true,
    pin: {
      devicePath: only.devicePath,
      sizeBytes: only.sizeBytes,
      mediaName: only.mediaName,
    },
  };
}

/**
 * The pin, as the argv flash-usb.ts requires before it will write.
 *
 * argv-array form throughout, so a model name with spaces needs no quoting and
 * no shell is involved.
 */
export function pinToExpectFlags(pin: TargetPin): readonly string[] {
  return [
    "--expect-device=" + pin.devicePath,
    "--expect-size=" + String(pin.sizeBytes),
    "--expect-model=" + pin.mediaName,
  ];
}

/** What the operator is shown before the pin is passed on. */
export function describePin(pin: TargetPin): string {
  return (
    "Target pinned before the flasher is invoked:\n" +
    "  device: " + pin.devicePath + "\n" +
    "  size:   " + String(pin.sizeBytes) + " bytes\n" +
    "  model:  " + pin.mediaName + "\n" +
    "These three are passed to the flasher as --expect-*, and it refuses to write\n" +
    "if the disk it finds is not this one. Nothing downstream re-discovers a target.\n"
  );
}

// =====================================================================
// ADAPTER -- the only part that touches the machine
// =====================================================================
//
// MEASURED vs DESIGNED-BUT-UNRUN:
//
//   MEASURED (target-pin.test.ts, no hardware): usbCandidates,
//     selectPinnedTarget with every refusal branch, pinToExpectFlags,
//     describePin.
//
//   DESIGNED BUT UNRUN: enumerateUsbCandidatesViaDiskutil below. It shells out
//     to diskutil + plutil and maps the plist onto UsbCandidate. It is kept
//     free of decisions for exactly that reason -- every decision above it is
//     pure, and the unrun part is a field mapping.
//
// The field mapping is not arbitrary: mediaName and sizeBytes MUST be read the
// same way flash-usb.ts readIdentity reads them, or the pin this module states
// would never match the identity that module observes, and the new refusal
// would fire on every correct flash.

import { execFileSync } from "node:child_process";

function plistToJson(plistXml: string): unknown {
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
    input: plistXml,
    encoding: "utf8",
  });
  return JSON.parse(json);
}

export function enumerateUsbCandidatesViaDiskutil(): readonly UsbCandidate[] {
  const listXml = execFileSync("diskutil", ["list", "-plist", "external", "physical"], {
    encoding: "utf8",
  });
  const list = plistToJson(listXml) as {
    AllDisksAndPartitions?: { DeviceIdentifier: string }[];
  };
  const out: UsbCandidate[] = [];
  for (const d of list.AllDisksAndPartitions ?? []) {
    const devicePath = "/dev/" + d.DeviceIdentifier;
    if (!/^\/dev\/disk\d+$/.test(devicePath)) continue;
    const infoXml = execFileSync("diskutil", ["info", "-plist", devicePath], {
      encoding: "utf8",
    });
    const info = plistToJson(infoXml) as Record<string, unknown>;
    out.push({
      devicePath,
      sizeBytes: Number(info.TotalSize ?? 0),
      mediaName: String(info.MediaName ?? info.IORegistryEntryName ?? "?"),
      busProtocol: String(info.BusProtocol ?? ""),
      internal: info.Internal === true,
    });
  }
  return out;
}
