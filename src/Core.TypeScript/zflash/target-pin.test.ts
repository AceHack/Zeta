// src/Core.TypeScript/zflash/target-pin.test.ts
//
// Falsifiers for "the target is stated, never discovered". No hardware.

import { describe, expect, test } from "bun:test";

import {
  describePin,
  pinToExpectFlags,
  selectPinnedTarget,
  usbCandidates,
  type UsbCandidate,
} from "./target-pin.ts";

const STICK: UsbCandidate = {
  devicePath: "/dev/disk6",
  sizeBytes: 123979431936,
  mediaName: "USB 3.2.1 FD",
  busProtocol: "USB",
  internal: false,
};
const PHONE: UsbCandidate = {
  devicePath: "/dev/disk7",
  sizeBytes: 255_000_000_000,
  mediaName: "iPhone",
  busProtocol: "USB",
  internal: false,
};
const INTERNAL_SSD: UsbCandidate = {
  devicePath: "/dev/disk0",
  sizeBytes: 2_000_398_934_016,
  mediaName: "APPLE SSD",
  busProtocol: "USB",
  internal: true,
};
const NOTHING_STATED = { devicePath: null, sizeBytes: null, mediaName: null };

describe("the candidate filter", () => {
  test("an INTERNAL disk reporting BusProtocol USB is never a candidate", () => {
    expect(usbCandidates([INTERNAL_SSD, STICK]).map((c) => c.devicePath)).toEqual([
      "/dev/disk6",
    ]);
  });

  test("a Thunderbolt enclosure is not a USB candidate", () => {
    const tb: UsbCandidate = { ...STICK, devicePath: "/dev/disk8", busProtocol: "Thunderbolt" };
    expect(usbCandidates([tb])).toHaveLength(0);
  });

  test("USB-C counts, because the flasher accepts it too", () => {
    expect(usbCandidates([{ ...STICK, busProtocol: "USB-C" }])).toHaveLength(1);
  });
});

describe("selecting a pin", () => {
  test("exactly one stick, nothing stated -> a pin naming all three fields", () => {
    const r = selectPinnedTarget([STICK], NOTHING_STATED);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.pin).toEqual({
      devicePath: "/dev/disk6",
      sizeBytes: 123979431936,
      mediaName: "USB 3.2.1 FD",
    });
  });

  test("no USB attached -> refusal, not an empty pin", () => {
    const r = selectPinnedTarget([INTERNAL_SSD], NOTHING_STATED);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("no-usb");
  });

  test("THE PHONE CASE: two sticks and nothing stated -> refuse to choose", () => {
    const r = selectPinnedTarget([STICK, PHONE], NOTHING_STATED);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("ambiguous");
    expect(r.error).toContain("/dev/disk6");
    expect(r.error).toContain("/dev/disk7");
  });

  test("two attached but ONE named -> the named one wins, unambiguously", () => {
    const r = selectPinnedTarget([STICK, PHONE], {
      devicePath: "/dev/disk6",
      sizeBytes: null,
      mediaName: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.pin.devicePath).toBe("/dev/disk6");
  });

  test(
    "A TYPO MUST NOT RETARGET THE WRITE: naming a device that is not attached " +
      "refuses, even when exactly one stick is present",
    () => {
      const r = selectPinnedTarget([STICK], {
        devicePath: "/dev/disk5",
        sizeBytes: null,
        mediaName: null,
      });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.reason).toBe("expectation-mismatch");
    },
  );

  test("stated size that disagrees -> refusal", () => {
    const r = selectPinnedTarget([STICK], {
      devicePath: null,
      sizeBytes: 64_000_000_000,
      mediaName: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("expectation-mismatch");
    expect(r.error).toContain("sizeBytes");
  });

  test("stated model that disagrees -> refusal, ordinal comparison", () => {
    const r = selectPinnedTarget([STICK], {
      devicePath: null,
      sizeBytes: null,
      mediaName: "usb 3.2.1 fd",
    });
    expect(r.ok).toBe(false);
  });
});

describe("the pin as argv", () => {
  test("all three --expect-* flags are emitted, so the flasher cannot be unpinned", () => {
    const r = selectPinnedTarget([STICK], NOTHING_STATED);
    if (!r.ok) throw new Error(r.error);
    expect([...pinToExpectFlags(r.pin)]).toEqual([
      "--expect-device=/dev/disk6",
      "--expect-size=123979431936",
      "--expect-model=USB 3.2.1 FD",
    ]);
  });

  test("a model with spaces needs no quoting -- argv array, never a shell string", () => {
    const r = selectPinnedTarget([STICK], NOTHING_STATED);
    if (!r.ok) throw new Error(r.error);
    const model = pinToExpectFlags(r.pin).find((f) => f.startsWith("--expect-model="));
    expect(model).toBe("--expect-model=USB 3.2.1 FD");
    expect(model).not.toContain(String.fromCharCode(34));
  });

  test("the operator is shown every field that is about to be pinned", () => {
    const r = selectPinnedTarget([STICK], NOTHING_STATED);
    if (!r.ok) throw new Error(r.error);
    const text = describePin(r.pin);
    expect(text).toContain("/dev/disk6");
    expect(text).toContain("123979431936");
    expect(text).toContain("USB 3.2.1 FD");
  });
});
