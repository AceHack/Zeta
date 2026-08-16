import { describe, expect, it } from "bun:test";
import { selectCliBindingMaterial } from "./installer-binding-cli.ts";
import { UEFI_KEYFILE_BYTES } from "./uefi-keyfile-esp.ts";

describe("selectCliBindingMaterial", () => {
  it("defaults to usbUuid", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: "uuid-1",
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.material).toBe("uuid-1");
  });

  it("prefers usbISerial over uuid when set", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: "uuid-1",
      usbISerial: "ZETA-STICK-001",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbISerial");
    expect(selected.material).toBe("ZETA-STICK-001");
  });

  it("rejects iserial and keyfile together", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "AAA",
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });
    expect("error" in selected).toBe(true);
  });

  it("errors when no factor is present", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });
});

describe("binding material is the operator's bytes, verbatim", () => {
  // These are the fast falsifier for the loosening that reached main on 2026-08-16.
  // key-refusal-falsifier.test.ts already catches it end-to-end, but that test spawns two
  // CLIs and pays scrypt N=2^17 twice (~600ms), so it is the wrong place to find out.
  // Here it is a string comparison.
  //
  // The property under test is DISCRIMINATION, not formatting: two identities that differ
  // by any byte -- including a byte that looks like nothing -- must derive different keys.
  // Whitespace is the case that matters because "be lenient about operator input" is the
  // most plausible way someone reintroduces the trim in good faith.
  const uuid = "AAAAAAAA-1111-2222-3333-444444444444";

  it("does NOT trim a trailing space off usbUuid material", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: `${uuid} `,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.material).toBe(`${uuid} `);
  });

  it("a whitespace-differing usbUuid is a DIFFERENT binding, not the same one", () => {
    const bare = selectCliBindingMaterial({ usbUuid: uuid, usbISerial: null, uefiKeyfileBytes: null });
    const spaced = selectCliBindingMaterial({ usbUuid: ` ${uuid}`, usbISerial: null, uefiKeyfileBytes: null });
    expect("error" in bare).toBe(false);
    expect("error" in spaced).toBe(false);
    if ("error" in bare || "error" in spaced) return;
    expect(spaced.material).not.toBe(bare.material);
  });

  it("does NOT trim usbISerial material either", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "ZETA-STICK-001\n",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.material).toBe("ZETA-STICK-001\n");
  });

  it("still treats a whitespace-ONLY value as no factor at all", () => {
    // Presence may be trimmed: "   " carries no identity, it is a typo or an empty shell
    // variable, and failing closed there is right. This is the half of the old behaviour
    // that was correct, kept deliberately so the fix does not read as "trim is banned".
    const selected = selectCliBindingMaterial({
      usbUuid: "   ",
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });
});
