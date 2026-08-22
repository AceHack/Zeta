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
  sessionBiometric,
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

// ── sessionBiometric — the ONE-FINGERPRINT primitive ──────────────────────────────────────

test("sessionBiometric: prompts the underlying door AT MOST ONCE, replays the decision", async () => {
  let calls = 0;
  const underlying: BiometricAuth = async () => {
    calls += 1;
    return { ok: true, platform: "macos-touchid" };
  };
  const s = sessionBiometric(underlying);
  // Five sub-ops all approve through the SAME session door.
  for (let i = 0; i < 5; i++) {
    const r = await s.door(`Approve: op ${i}`);
    expect(r.ok).toBe(true);
  }
  expect(calls).toBe(1); // the HUMAN was asked exactly once
  expect(s.underlyingCalls()).toBe(1);
  expect(s.decision()?.ok).toBe(true);
});

test("sessionBiometric FAIL-CLOSED: a declined first approval poisons the session (no retry-past-refusal)", async () => {
  let calls = 0;
  const underlying: BiometricAuth = async () => {
    calls += 1;
    return { ok: false, platform: "macos-touchid", reason: "declined" };
  };
  const s = sessionBiometric(underlying);
  const first = await s.door("Approve: first");
  expect(first.ok).toBe(false);
  // A later sub-op CANNOT force a fresh prompt to get past the refusal — it replays ok:false.
  const second = await s.door("Approve: sneaky retry with a different prompt");
  expect(second.ok).toBe(false);
  expect(calls).toBe(1); // still prompted only once — the refusal stands
  expect(s.underlyingCalls()).toBe(1);
});

test("sessionBiometric FAIL-CLOSED: no underlying door -> ok:false, prompted at most once", async () => {
  const s = sessionBiometric(undefined);
  const r1 = await s.door("Approve: x");
  const r2 = await s.door("Approve: y");
  expect(r1.ok).toBe(false);
  expect(r2.ok).toBe(false);
  expect(r1.platform).toBe("unsupported");
  expect(s.underlyingCalls()).toBe(1); // requireBiometric was consulted once, then cached
});

test("sessionBiometric: a never-called session is zero-approval (NOT a silent bypass)", () => {
  const underlying: BiometricAuth = async () => ({ ok: true, platform: "macos-touchid" });
  const s = sessionBiometric(underlying);
  // Nothing called the door — so nothing was approved (each gated op would fail-closed).
  expect(s.underlyingCalls()).toBe(0);
  expect(s.decision()).toBeUndefined();
});
