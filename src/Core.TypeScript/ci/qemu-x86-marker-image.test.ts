import { describe, expect, it } from "bun:test";
import {
  buildBootSector,
  buildMarkerImage,
  CODE_LENGTH,
  IMAGE_BYTES,
  markerTextFor,
  MARKER_STAGES,
  SECTOR_BYTES,
  SIGNATURE_OFFSET,
  STAGE_LINES,
  type MarkerStage,
} from "./qemu-x86-marker-image.ts";
import { furthestBootStage, type BootStage } from "./qemu-boot-test.ts";

// This fixture is hand-assembled machine code, so the risk is not that
// it is wrong in a way a reader notices — it is that a byte shifts and
// the sector still boots into something. These tests re-derive every
// offset from the layout rather than restating the bytes, so an edit
// that moves the message or the loop fails here instead of producing a
// guest that hangs with no output and looks exactly like the bug this
// fixture exists to detect.

const LOAD_ADDRESS = 0x7c00;

describe("boot sector — the MBR contract", () => {
  it("is exactly one sector", () => {
    expect(buildBootSector("x").length).toBe(SECTOR_BYTES);
  });

  it("carries the 0x55AA boot signature the firmware checks", () => {
    const s = buildBootSector("x");
    expect(s[SIGNATURE_OFFSET]).toBe(0x55);
    expect(s[SIGNATURE_OFFSET + 1]).toBe(0xaa);
  });

  it("points SI at the message, load-address relative", () => {
    const s = buildBootSector("HELLO");
    // `mov si, imm16` is BE lo hi at offset 6.
    expect(s[6]).toBe(0xbe);
    const si = s[7]! | (s[8]! << 8);
    expect(si).toBe(LOAD_ADDRESS + CODE_LENGTH);
    // …and the message really is at that offset.
    expect(Buffer.from(s.slice(CODE_LENGTH, CODE_LENGTH + 5)).toString("ascii")).toBe("HELLO");
  });

  it("NUL-terminates the message — the emit loop's only stop condition", () => {
    const s = buildBootSector("AB");
    expect(s[CODE_LENGTH + 2]).toBe(0x00);
  });

  it("targets COM1's transmit-holding register", () => {
    const s = buildBootSector("x");
    expect(s[9]).toBe(0xba); // mov dx, imm16
    expect(s[10]! | (s[11]! << 8)).toBe(0x03f8);
  });

  it("branches land on the halt and back on the emit loop", () => {
    const s = buildBootSector("x");
    // jz rel8 at 15..16 -> next instruction (17) + rel
    expect(s[15]).toBe(0x74);
    expect(17 + s[16]!).toBe(20); // the hlt
    expect(s[20]).toBe(0xf4); // hlt
    // jmp rel8 at 18..19 -> next instruction (20) + signed rel
    expect(s[18]).toBe(0xeb);
    const back = s[19]! > 0x7f ? s[19]! - 0x100 : s[19]!;
    expect(20 + back).toBe(12); // the lodsb
  });

  it("refuses a message that would overrun the signature", () => {
    expect(() => buildBootSector("x".repeat(SIGNATURE_OFFSET))).toThrow("room for");
  });
});

describe("marker text — each stage emits its own rung and every rung below", () => {
  const expected: readonly [MarkerStage, BootStage][] = [
    ["bootloader", "bootloader"],
    ["kernel", "kernel"],
    ["userspace", "userspace"],
    ["login", "login"],
  ];

  for (const [stage, rung] of expected) {
    it(`stage=${stage} makes the harness read \`${rung}\``, () => {
      expect(furthestBootStage(markerTextFor(stage))).toBe(rung);
    });
  }

  it("stage=none emits nothing at all", () => {
    expect(markerTextFor("none")).toBe("");
    expect(furthestBootStage(markerTextFor("none"))).toBe("none");
  });

  it("is a strict prefix chain — a higher stage contains every lower one", () => {
    expect(markerTextFor("login")).toContain(markerTextFor("kernel"));
    expect(markerTextFor("kernel")).toContain(markerTextFor("bootloader"));
  });

  // A synthetic transcript that could be mistaken for a real NixOS boot
  // in an incident post-mortem would be a worse bug than any it catches.
  it("self-labels as synthetic wherever the harness's grammar allows", () => {
    for (const { stage, line } of STAGE_LINES) {
      if (stage === "userspace" || stage === "login") continue; // matched verbatim
      expect(line.toLowerCase()).toContain("fixture");
    }
  });

  it("never trips a failure marker — these images must not fake a break", () => {
    expect(markerTextFor("login")).not.toContain("No bootable device");
    expect(markerTextFor("login")).not.toContain("Kernel panic");
  });
});

describe("images", () => {
  it("are padded well past a bare sector", () => {
    for (const stage of MARKER_STAGES) {
      expect(buildMarkerImage(stage).length).toBe(IMAGE_BYTES);
    }
  });

  // THE BOOT-FAILED FIXTURE. Its whole job is to be refused by the
  // firmware, which only happens if the signature is absent.
  it("stage=none has NO boot signature, so the firmware must refuse it", () => {
    const img = buildMarkerImage("none");
    expect(img[SIGNATURE_OFFSET]).toBe(0x00);
    expect(img[SIGNATURE_OFFSET + 1]).toBe(0x00);
    expect(img.every((b) => b === 0)).toBe(true);
  });

  it("every other stage is bootable", () => {
    for (const stage of MARKER_STAGES.filter((s) => s !== "none")) {
      const img = buildMarkerImage(stage);
      expect(img[SIGNATURE_OFFSET]).toBe(0x55);
      expect(img[SIGNATURE_OFFSET + 1]).toBe(0xaa);
    }
  });
});
