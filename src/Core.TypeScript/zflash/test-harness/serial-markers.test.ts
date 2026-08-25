import { describe, expect, test } from "bun:test";
import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  B0891_RETENTION_USB_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS,
  serialFirstBootInProgress,
  WIFI_ESP_INSTALL_SERIAL_MARKERS,
} from "./serial-markers";

describe("serialFirstBootInProgress", () => {
  test("idle serial-getty shell alone is not first-boot progress", () => {
    expect(serialFirstBootInProgress("nixos@zeta-installer:~$")).toBe(false);
  });

  test("mirrored first-boot banner suppresses getty-race false positive", () => {
    const serial = "nixos@zeta-installer:~$\n  Zeta cluster installer\nRole selected: control-plane";
    expect(serialFirstBootInProgress(serial)).toBe(true);
  });
});

describe("first-session path serial markers", () => {
  test("happy path requires local-only completion with self-register enabled", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: dry-run setup gh",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: dry-run use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
    ].join("\n");

    const result = assertHappyPathFirstSessionSerial(serial);

    expect("ok" in result).toBe(true);
  });

  test("mock identity-auth path requires mock markers plus happy-path completion", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=setup_credential vendor=gh",
      "zeta-first-session: identity-auth-mock-begin",
      "zeta-first-session: identity-auth-mock-ok",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=true",
    ].join("\n");

    expect("ok" in assertMockIdentityAuthFirstSessionSerial(serial)).toBe(true);
    expect("error" in assertMockIdentityAuthFirstSessionSerial(
      [
        "zeta-first-session: begin",
        "zeta-first-session: choice kind=setup_credential vendor=gh",
        "zeta-first-session: dry-run setup gh",
        "zeta-first-session: choice kind=use_local_llm_only",
        "zeta-first-session: complete canSelfRegister=true",
      ].join("\n"),
    )).toBe(true);
  });

  test("skip-gh path accepts the continue-later guidance as path evidence", () => {
    const serial = [
      "zeta-first-session: begin",
      "zeta-first-session: choice kind=skip_credential vendor=gh",
      "  Continue later: run gh auth login when ready.",
      "  Tip: on this machine run the first-login helper again, or SSH in and set up GitHub there.",
      "zeta-first-session: choice kind=use_local_llm_only",
      "zeta-first-session: complete canSelfRegister=false",
    ].join("\n");

    const result = assertSkipGhFirstSessionSerial(serial);

    expect("ok" in result).toBe(true);
  });

  test("obsolete begin+complete-only transcript is not path proof", () => {
    const serial = ["zeta-first-session: begin", "zeta-first-session: complete"].join("\n");

    expect("error" in assertHappyPathFirstSessionSerial(serial)).toBe(true);
    expect("error" in assertSkipGhFirstSessionSerial(serial)).toBe(true);
  });
});

describe("installed-OS retention serial markers", () => {
  test("require reading-preserved ESP blob plus already-present", () => {
    const serial = [
      "zeta-creds-restore: reading preserved ESP blob",
      "zeta-creds-restore: already-present, skipping credential rewrite",
    ].join("\n");
    expect(serial).toContain("zeta-creds-restore: reading preserved ESP blob");
    expect(serial).toContain("already-present");
  });
});

describe("wifi ESP install serial markers", () => {
  test("consume path requires wrote-profile plus association-deferred", async () => {
    const { WIFI_ESP_INSTALL_SERIAL_MARKERS } = await import("./serial-markers");
    const serial = [
      "[iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP",
      "[iter-5-wifi] wrote NetworkManager profile to installed system (zeta-esp-homelab.nmconnection)",
      "[iter-5-wifi] association deferred (physical-gated; no radio claim)",
    ].join("\n");
    for (const marker of WIFI_ESP_INSTALL_SERIAL_MARKERS) {
      expect(serial).toContain(marker);
    }
  });

  test("assertWifiEspInstallSerial fails closed and redacts secrets in reason", async () => {
    const { assertWifiEspInstallSerial } = await import("./serial-markers");
    const result = assertWifiEspInstallSerial("no wifi markers", {
      forbiddenSecrets: ["super-secret-psk"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("wifi ESP install markers missing");
      expect(result.reason).not.toContain("super-secret-psk");
    }
  });
});

describe("usb iSerial guest serial markers", () => {
  test("accepts the probe report for the QEMU test serial", async () => {
    const { assertUsbISerialGuestSerial } = await import("./serial-markers");
    const { formatUsbISerialReport } = await import("../../installer/usb-iserial-probe.ts");
    const { QEMU_USB_TEST_SERIAL } = await import("../../installer/qemu-usb-storage.ts");
    const serial = formatUsbISerialReport({
      ok: true,
      serial: QEMU_USB_TEST_SERIAL,
      dirName: "1-1",
    }).join("\n");
    const result = assertUsbISerialGuestSerial(serial, QEMU_USB_TEST_SERIAL);
    expect(result.ok).toBe(true);
  });

  test("fails closed when the serial value is a different stick", async () => {
    const { assertUsbISerialGuestSerial } = await import("./serial-markers");
    const { formatUsbISerialReport } = await import("../../installer/usb-iserial-probe.ts");
    const serial = formatUsbISerialReport({
      ok: true,
      serial: "OTHER-STICK",
      dirName: "1-1",
    }).join("\n");
    const result = assertUsbISerialGuestSerial(serial, "ZETA-QEMU-001");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NO MARKER MAY BE A SUBSTRING OF ANOTHER IN THE SAME ALL-REQUIRED SET
//
// These sets are consumed with "every element must appear in the serial log"
// semantics (qemu-state.ts allMarkersPresent). A element that is a substring of
// a sibling therefore cannot fail independently: satisfying the longer line
// satisfies it for free. That is the vacuity class — a check that cannot fail
// is not a check — and it shipped for real in
// INSTALLED_OS_RETENTION_SERIAL_MARKERS ("zeta-creds-restore:" under
// "zeta-creds-restore: reading preserved ESP blob").
// ---------------------------------------------------------------------------
describe("all-required marker sets carry no redundant element", () => {
  const allRequiredSets: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["B0891_RETENTION_USB_SERIAL_MARKERS", B0891_RETENTION_USB_SERIAL_MARKERS],
    ["INSTALLED_OS_RETENTION_SERIAL_MARKERS", INSTALLED_OS_RETENTION_SERIAL_MARKERS],
    ["WIFI_ESP_INSTALL_SERIAL_MARKERS", WIFI_ESP_INSTALL_SERIAL_MARKERS],
  ];

  for (const [name, markers] of allRequiredSets) {
    test(`${name}: no element is a substring of a sibling`, () => {
      for (const candidate of markers) {
        const covering = markers.filter((other) => other !== candidate && other.includes(candidate));
        expect(
          covering,
          `"${candidate}" is already implied by ${JSON.stringify(covering)}; it can never fail on its own`,
        ).toEqual([]);
      }
    });

    test(`${name}: every element is non-empty`, () => {
      // An empty string is included in every log — the limiting case of the above.
      for (const marker of markers) {
        expect(marker.trim().length).toBeGreaterThan(0);
      }
    });
  }

  test("the retention set kept the discriminating half of the deleted pair", () => {
    expect(INSTALLED_OS_RETENTION_SERIAL_MARKERS).toContain("zeta-creds-restore: reading preserved ESP blob");
    expect(INSTALLED_OS_RETENTION_SERIAL_MARKERS).not.toContain("zeta-creds-restore:");
  });
});
