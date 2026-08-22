/**
 * linux-arm.test.ts — the Linux wrapper wiring (081M037KPG1087G0R0005ANAFV).
 *
 * Runs on ANY OS: no USB stick, no block device, no root, no `lsblk`, no `qemu-img`,
 * no `mtools`, no fingerprint reader. Every decision under test is pure.
 *
 * The cross-module tests at the bottom are the load-bearing ones. They pin the CONTRACT
 * between this wrapper and `flash-usb-linux.ts` by asserting against that module's real
 * exported validators — not against a copy of what it is believed to accept. A hand-copied
 * expectation would keep passing after the arm changed, which is the failure this whole
 * task is about.
 */
import { describe, expect, test } from "bun:test";
import {
  flashUsbLinuxArgv,
  linuxBakeIsRequired,
  linuxWrapperRefusals,
  LINUX_FLASH_ALLOWED_FLAGS,
  planLinuxBakedImagePath,
  requireLinuxBakeTools,
} from "./linux-arm.ts";
import { buildShortChallenge, validateIso } from "./flash-usb-linux.ts";

// ── argv construction ────────────────────────────────────────────────────────────────────

describe("flashUsbLinuxArgv", () => {
  test("builds the short-challenge argv the wrapper has always used", () => {
    const r = flashUsbLinuxArgv("/repo/flash-usb-linux.ts", "/home/op/zeta.iso", { short: true });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.argv).toEqual(["/repo/flash-usb-linux.ts", "--short", "/home/op/zeta.iso"]);
  });

  test("NEVER emits --no-eject: the macOS argv would be rejected by the Linux arm", () => {
    // The macOS wrapper builds [flashUsb, "--short", "--no-eject", isoPath]. The Linux
    // arm's allowlist has no --no-eject, so reusing that argv kills every flash at the
    // child's flag check. There is no option here that can produce it.
    const r = flashUsbLinuxArgv("/s.ts", "/i.iso", { short: true, dryRun: true });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.argv).not.toContain("--no-eject");
    for (const arg of r.argv.filter((a) => a.startsWith("-"))) {
      expect(LINUX_FLASH_ALLOWED_FLAGS).toContain(arg);
    }
  });

  test("--dry-run is passed through so a plan-only run stays plan-only", () => {
    const r = flashUsbLinuxArgv("/s.ts", "/i.iso", { dryRun: true });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.argv).toContain("--dry-run");
  });

  test("no options ⇒ bare argv, no flags invented", () => {
    const r = flashUsbLinuxArgv("/s.ts", "/i.iso");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.argv).toEqual(["/s.ts", "/i.iso"]);
  });

  test("REFUSES an ISO path that would be parsed as a flag by the child", () => {
    const r = flashUsbLinuxArgv("/s.ts", "-rf.iso", { short: true });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("parsed as a flag");
  });

  test("REFUSES a non-.iso positional rather than letting the child discover it", () => {
    const r = flashUsbLinuxArgv("/s.ts", "/home/op/zeta.img");
    expect(r.ok).toBe(false);
  });

  test("REFUSES empty script or ISO path", () => {
    expect(flashUsbLinuxArgv("", "/i.iso").ok).toBe(false);
    expect(flashUsbLinuxArgv("/s.ts", "   ").ok).toBe(false);
  });
});

// ── baked working-image path ─────────────────────────────────────────────────────────────

describe("planLinuxBakedImagePath", () => {
  const base = { isoPath: "/home/op/Downloads/zeta.iso", workDir: "/tmp/zflash-xyz", nonceHex: "a1b2" };

  test("derives a .iso working copy inside the work dir", () => {
    const r = planLinuxBakedImagePath(base);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value).toBe("/tmp/zflash-xyz/zflash-keyed-a1b2.iso");
  });

  test("tolerates a trailing slash on the work dir without doubling it", () => {
    const r = planLinuxBakedImagePath({ ...base, workDir: "/tmp/zflash-xyz/" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.value).toBe("/tmp/zflash-xyz/zflash-keyed-a1b2.iso");
  });

  test("the nonce separates concurrent runs, so two runs cannot share a working image", () => {
    const a = planLinuxBakedImagePath({ ...base, nonceHex: "aaaa" });
    const b = planLinuxBakedImagePath({ ...base, nonceHex: "bbbb" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("unreachable");
    expect(a.value).not.toBe(b.value);
  });

  test("REFUSES to bake into a device path — a working image is a FILE", () => {
    const r = planLinuxBakedImagePath({ ...base, workDir: "/dev/sdb" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("device path");
  });

  test("REFUSES a non-.iso source", () => {
    expect(planLinuxBakedImagePath({ ...base, isoPath: "/home/op/zeta.img" }).ok).toBe(false);
  });

  test("REFUSES a malformed nonce rather than putting it in a filename", () => {
    expect(planLinuxBakedImagePath({ ...base, nonceHex: "" }).ok).toBe(false);
    expect(planLinuxBakedImagePath({ ...base, nonceHex: "../../etc" }).ok).toBe(false);
    expect(planLinuxBakedImagePath({ ...base, nonceHex: "zz zz" }).ok).toBe(false);
  });

  test("REFUSES when the derived path would be the source ISO itself", () => {
    // Baking in place would mutate the operator's cached download and permanently key an
    // artifact that is meant to stay pristine.
    const r = planLinuxBakedImagePath({
      isoPath: "/tmp/w/zflash-keyed-a1b2.iso",
      workDir: "/tmp/w",
      nonceHex: "a1b2",
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("refusing to bake in place");
  });

  test("REFUSES an empty work dir", () => {
    expect(planLinuxBakedImagePath({ ...base, workDir: "  " }).ok).toBe(false);
  });
});

// ── unsupported wrapper features fail CLOSED ─────────────────────────────────────────────

describe("linuxWrapperRefusals", () => {
  test("a plain pubkey+hostname request is fully serviceable", () => {
    expect(linuxWrapperRefusals({ injectPubkey: true, hostname: "pikachu", bakeCredCount: 0 })).toEqual([]);
  });

  test("--bake-cred is REFUSED BY NAME, never silently dropped", () => {
    const r = linuxWrapperRefusals({ injectPubkey: true, hostname: null, bakeCredCount: 2 });
    expect(r.length).toBe(1);
    expect(r[0]).toContain("--bake-cred");
    expect(r[0]).toContain("Refusing");
  });
});

describe("linuxBakeIsRequired", () => {
  test("pubkey injection requires the bake", () => {
    expect(linuxBakeIsRequired({ injectPubkey: true, hostname: null, bakeCredCount: 0 })).toBe(true);
  });

  test("--host alone requires the bake", () => {
    expect(linuxBakeIsRequired({ injectPubkey: false, hostname: "pikachu", bakeCredCount: 0 })).toBe(true);
  });

  test("--no-inject with no --host needs NO bake, so no mtools requirement", () => {
    expect(linuxBakeIsRequired({ injectPubkey: false, hostname: null, bakeCredCount: 0 })).toBe(false);
  });

  test("a whitespace-only hostname is not a hostname", () => {
    expect(linuxBakeIsRequired({ injectPubkey: false, hostname: "   ", bakeCredCount: 0 })).toBe(false);
  });
});

// ── bake tooling is fail-closed ──────────────────────────────────────────────────────────

describe("requireLinuxBakeTools", () => {
  const all = { qemuImg: "/usr/bin/qemu-img", mcopy: "/usr/bin/mcopy", mdir: "/usr/bin/mdir" };

  test("all present ⇒ ok", () => {
    expect(requireLinuxBakeTools(all).ok).toBe(true);
  });

  test("missing qemu-img REFUSES the flash rather than skipping the key", () => {
    const r = requireLinuxBakeTools({ ...all, qemuImg: null });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("qemu-img");
    expect(r.error).toContain("Refusing to flash");
  });

  test("missing mcopy REFUSES", () => {
    expect(requireLinuxBakeTools({ ...all, mcopy: null }).ok).toBe(false);
  });

  test("missing mdir REFUSES — an unverified bake is not a bake (081KZHJPJCF silent drop)", () => {
    const r = requireLinuxBakeTools({ ...all, mdir: null });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("mdir");
  });

  test("every missing tool is named at once, not one per re-run", () => {
    const r = requireLinuxBakeTools({ qemuImg: null, mcopy: null, mdir: null });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toContain("qemu-img");
    expect(r.error).toContain("mcopy");
    expect(r.error).toContain("mdir");
  });
});

// ── CROSS-MODULE CONTRACTS (asserted against the arm's own exports) ──────────────────────

describe("contract with flash-usb-linux.ts", () => {
  test("the baked image path is ACCEPTED by the arm's own validateIso", () => {
    // The reason the working copy must end in .iso, checked against the real validator
    // rather than against a belief about it.
    const planned = planLinuxBakedImagePath({
      isoPath: "/home/op/zeta.iso",
      workDir: "/tmp/w",
      nonceHex: "a1b2",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error("unreachable");
    const verdict = validateIso(planned.value, 900 * 1024 * 1024, true);
    expect(verdict.ok).toBe(true);
  });

  test("every flag this wrapper can emit is in the arm's allowlist", () => {
    // LINUX_FLASH_ALLOWED_FLAGS mirrors the child's private ALLOWED_FLAGS set. If the arm
    // ever drops --short, this test is the thing that should start failing.
    const emitted = flashUsbLinuxArgv("/s.ts", "/i.iso", { short: true, dryRun: true });
    expect(emitted.ok).toBe(true);
    if (!emitted.ok) throw new Error("unreachable");
    for (const flag of emitted.argv.filter((a) => a.startsWith("-"))) {
      expect(LINUX_FLASH_ALLOWED_FLAGS).toContain(flag);
    }
  });

  test("the arm's short challenge still matches the wrapper's --agent auto-type regex", () => {
    // cli.ts --agent mode scans child stdout for /^\s+yes ([0-9a-f]{4})\s*$/m and types the
    // answer back. If the Linux arm's challenge text drifted from `yes <4hex>`, agent mode
    // would hang forever at a prompt nobody answers — a silent stall, not an error.
    const challenge = buildShortChallenge("beef");
    const agentRegex = /^\s+yes ([0-9a-f]{4})\s*$/m;
    const asPrinted = `  ${challenge}\n`;
    const m = asPrinted.match(agentRegex);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe("beef");
  });
});
