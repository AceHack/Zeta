// biometric.ts conformance — the SHARED operator-approval gate that ca.ts / machine.ts /
// publish.ts all run their sensitive ops through. EVERY test uses a FAKE door (no real Touch
// ID / Windows Hello, no `sudo`, no network). Proves: the platform detector; `requireBiometric`
// is FAIL-CLOSED when no door is injected (the "agent forgot to wire the gate" case) and
// delegates to the door otherwise; a result NEVER carries a secret.
// Run: bun test biometric.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import {
  detectBiometricPlatform,
  requireBiometric,
  type BiometricAuth,
  type BiometricResult,
} from "./biometric.ts";

test("detectBiometricPlatform: darwin→touchid, win32→hello, else→unsupported", () => {
  expect(detectBiometricPlatform("darwin")).toBe("macos-touchid");
  expect(detectBiometricPlatform("win32")).toBe("windows-hello");
  expect(detectBiometricPlatform("linux")).toBe("unsupported");
});

test("requireBiometric: NO door provided -> ok:false, unsupported (FAIL-CLOSED by default)", async () => {
  const r = await requireBiometric(undefined, "Approve: anything");
  expect(r.ok).toBe(false);
  expect(r.platform).toBe("unsupported");
  expect(r.reason).toContain("fail-closed");
});

test("requireBiometric: delegates to the injected door + forwards the prompt", async () => {
  const prompts: string[] = [];
  const door: BiometricAuth = async (prompt) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid" };
  };
  const r = await requireBiometric(door, "Approve: generate device key for mymac");
  expect(r.ok).toBe(true);
  expect(prompts).toEqual(["Approve: generate device key for mymac"]);
});

test("requireBiometric: a declining door yields ok:false (the gate honors the operator)", async () => {
  const door: BiometricAuth = async () => ({ ok: false, platform: "macos-touchid", reason: "declined" });
  const r = await requireBiometric(door, "Approve: sign cert");
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("declined");
});

test("a BiometricResult NEVER carries a secret — it is approval-only", async () => {
  const door: BiometricAuth = async () => ({ ok: true, platform: "macos-touchid" });
  const r: BiometricResult = await requireBiometric(door, "Approve: x");
  // The shape has only ok / platform / reason — assert no key/seed-bearing field leaked in.
  const blob = JSON.stringify(r);
  expect(blob).not.toContain("ssh-ed25519");
  // Split so this test file contains no contiguous private-key header literal.
  expect(blob).not.toContain("PRIVATE" + " " + "KEY");
  expect(Object.keys(r).sort()).toEqual(["ok", "platform"]);
});
