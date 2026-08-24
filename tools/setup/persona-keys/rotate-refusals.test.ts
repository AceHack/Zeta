// Zeta PER-PORT rotate — THE REFUSALS, and three defects the happy path hides.
//
// `rotate.test.ts` proves the rotation WORKS. This file asks the other question: does it
// REFUSE when it should, and does the safety property it advertises survive being applied
// twice? A rotation that proceeds when it should refuse is the dangerous defect; a safety
// property that holds at N=1 and fails at N=2 is the same defect wearing a green test.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ──────────────────────────────────────────────────────┐
// │ EVERY test runs ENTIRELY inside throwaway temp dirs (mktemp HOME + mktemp repoRoot).   │
// │ The biometric door is ALWAYS a FAKE — `realBiometric()` is never imported here, so no  │
// │ Touch ID prompt, no `sudo`, no /etc/pam.d read can occur from this file. NOTHING       │
// │ touches ~/.config/zeta, 1Password, real `git`, or any real key. `ssh-keygen` runs for  │
// │ real but is aimed wholly at the temp dirs. NO SECRET VALUE IS READ, PRINTED OR         │
// │ ASSERTED ON — every key is compared by SHA256 FINGERPRINT ONLY.                        │
// └────────────────────────────────────────────────────────────────────────────────────────┘
//
// ── WHAT IS PROVEN HERE (each test carries its own differential arm) ─────────────────────
//   RR-1  absent biometric door ⇒ fail-closed          (arm: same call WITH a door rotates)
//   RR-2  ONE approval covers all three ports          (arm: underlying-door call count)
//   RR-3  a declined approval halts the run; a poisoned session replays without re-prompting
//   RR-4  FIXED (was P0) — ∅-blast-radius holds at N=1 AND N=2 (arm: N=1 vs N=2, same assert)
//   RR-5  FIXED (was P1) — the readout MEASURES the guarantee; the line differs when the truth does
//   RR-6  FIXED (was P1) — retired keys are generational; rotate #2 preserves rotate #1's
//   RR-7  an unrecognised port is REFUSED WHOLE — nothing rotates, nothing stages, no prompt
//   RR-7b the ONE prompt names the ports PERFORMED, not the ports requested (the consent property)
//   RR-8  apply-N: rotate is NOT idempotent across runs BY DESIGN; the key is standby-presence
//
// ── THE DEFECT PINS ARE SELF-CLEANING, AND THREE OF THEM HAVE NOW CLEANED ────────────────
// RR-4 / RR-5 / RR-6 / RR-7 were written to assert that the defect IS PRESENT, so that a fix could
// not land while a test still claimed the broken behaviour was correct. ALL FOUR HAVE NOW FIRED.
// On 2026-08-23 Nazar fixed the first three; each went RED exactly as designed and is INVERTED
// below — the same scenario, the same two arms, now asserting the repaired property. The fix and
// the closing bound it required are proven in `rotate-ca-closing-bound.test.ts` (CB-1..CB-8).
//
// RR-7 was deliberately left LIVE in that round: a different defect class (dispatch closure, a
// type-level change to `planPort`/`rotatePort`) with no interaction with the trust-set arithmetic,
// and folding it into a trust-correctness fix would have made both harder to review. It was closed
// on 2026-08-24, went red on the same run that fixed it, and is inverted in place below alongside a
// new RR-7b for the consent half. None of the four was deleted: the inversion IS the record that
// the pin fired, and a deleted pin leaves no evidence that it ever did.
//
// ── WHAT THIS FILE CANNOT TEST (loudly, per the honest-limit discipline) ─────────────────
// Printed at run time by RR-9 as well as stated here, because a limitation only in a comment
// is a limitation nobody reads:
//   * A REAL biometric. `macTouchIdAuth` needs a human finger on a sensor and a `sudo`
//     transaction. Everything here injects a fake door, so what is proven is that the CALLER
//     honours the door's verdict — never that a real Touch ID happened. `biometric.ts`
//     `claimsBiometric()` is the repo's own statement of that gap.
//   * A REAL HSM / PIV token. `open-authenticated-hsm-session` and
//     `provision-or-reconfigure-hardware-token` are `biometric-ceremony` in `ceremony-gate.ts`
//     and cannot be exercised without the physical device.
//   * A REAL sshd. Certificate acceptance is asserted by the rule sshd applies — a cert
//     verifies iff its signing-CA fingerprint is in `TrustedUserCAKeys` — which is the same
//     oracle `rotate.ts`'s own header uses. It is not a live `ssh` handshake.
//   * The LIVE estate. Nothing here rotates, revokes or re-issues any real key. The manual
//     procedure for the live path is `tools/setup/persona-keys/ONBOARDING-RUNBOOK.md` plus the
//     `--dry-run` default of `rotate-cli.ts`; it is a ceremony, not an agent action.
//
// Run: bun test rotate-refusals.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { setupMachine } from "./setup-machine.ts";
import { realEffects as machineRealFx, deviceKeyPath, machinePubPath } from "./machine.ts";
import { caPrivateKeyPath, certPath, realEffects as caRealFx } from "./ca.ts";
import { trustedUserCaKeysPath } from "./setup-cluster.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import {
  rotate,
  formatRotate,
  ROTATE_PORTS,
  retiredCaKeyPath,
  retiredKeyPathForGeneration,
  retiredMachineKeyPath,
  standbyMachineKeyPath,
  type RotateEffects,
  type RotatePort,
  type RotateResult,
} from "./rotate.ts";

const USER = "tester";
const HOST = "refusal-host";

// ── sandbox ──────────────────────────────────────────────────────────────────────────────

interface Sandbox {
  readonly home: string;
  readonly repoRoot: string;
  readonly cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const home = mkdtempSync(join(tmpdir(), "zeta-rr-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-rr-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

/** Every asserted path MUST be under the sandbox. Drift toward real state ⇒ FAIL LOUD. */
function assertContained(sb: Sandbox, ...paths: string[]): void {
  for (const p of paths) {
    expect(p.startsWith(tmpdir())).toBe(true);
    expect(p.startsWith(sb.home) || p.startsWith(sb.repoRoot)).toBe(true);
  }
}

/** A FAKE approving door. Records prompts so a test can count the human-facing approvals. */
function approving(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid", factor: "biometric" };
  };
}

/** A FAKE declining door. */
function declining(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: false, platform: "macos-touchid", reason: "test decline" };
  };
}

function rotateEffects(staged: { repoRoot: string; relPath: string }[]): RotateEffects {
  const machine = machineRealFx();
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, c);
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    genEd25519: (keyPath, comment) => machine.genEd25519(keyPath, comment),
    movePrivate: (from, to) => {
      for (const suffix of ["", ".pub"]) {
        const src = from + suffix;
        const dst = to + suffix;
        if (existsSync(src)) {
          mkdirSync(dirname(dst), { recursive: true });
          renameSync(src, dst);
        }
      }
    },
    ca: caRealFx(),
    // NEVER shells real git, NEVER pushes — records the path and returns "staged".
    stageRepoWrite: (repoRoot, relPath) => {
      staged.push({ repoRoot, relPath });
      return true;
    },
  };
}

/** Provision a COMPLETE N+M setup (CA + machine key + cert) through the REAL setup path. */
async function provision(sb: Sandbox): Promise<void> {
  const session = sessionBiometric(approving([]));
  const trust: GithubTrustEffects = {
    exists: () => false,
    readText: () => "",
    listDir: () => [],
    fetchKeys: async () => "",
    fetchGpg: async () => "",
  };
  const fx: OnboardEffects = {
    machine: { ...machineRealFx(), hostname: () => HOST },
    trust,
    ca: caRealFx(),
    biometricAuth: session.door,
  };
  const res = await setupMachine(fx, session, {
    user: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    caConfigured: false,
  });
  expect(res.onboard.cert?.action).toBe("signed");
  expect(existsSync(caPrivateKeyPath(sb.home))).toBe(true);
  expect(existsSync(deviceKeyPath(sb.home))).toBe(true);
}

// ── fingerprint helpers — PUBLIC halves only, never a secret byte ─────────────────────────

function pubFingerprint(pubPath: string): string {
  const r = spawnSync("ssh-keygen", ["-l", "-f", pubPath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  const m = /SHA256:\S+/.exec(r.stdout);
  expect(m).not.toBeNull();
  return m![0];
}

/** Fingerprint a single pubkey LINE by writing it under the sandbox and running ssh-keygen. */
function fingerprintOfPubLine(line: string, sb: Sandbox): string {
  const tmp = join(sb.home, ".rr-fp-probe.pub");
  writeFileSync(tmp, line.trim() + "\n");
  const fp = pubFingerprint(tmp);
  rmSync(tmp, { force: true });
  return fp;
}

/** The set sshd would consult: every CA fingerprint in `TrustedUserCAKeys`. */
function trustedCaFingerprints(sb: Sandbox): string[] {
  return readFileSync(trustedUserCaKeysPath(sb.repoRoot, USER), "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0 && !l.trimStart().startsWith("#"))
    .map((l) => fingerprintOfPubLine(l, sb));
}

/** The rule sshd applies: a cert verifies iff its signing CA is in the trusted set. */
function certSigningCaFingerprint(certFilePath: string): string {
  const r = spawnSync("ssh-keygen", ["-L", "-f", certFilePath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  const m = /Signing CA:\s+\S+\s+(SHA256:\S+)/.exec(r.stdout);
  expect(m).not.toBeNull();
  return m![1]!;
}

interface RunOpts {
  readonly ports?: readonly RotatePort[];
  readonly door?: BiometricAuth | undefined;
  readonly wireDoor?: boolean;
}

async function runRotate(
  sb: Sandbox,
  o: RunOpts = {},
): Promise<{ res: Awaited<ReturnType<typeof rotate>>; staged: { repoRoot: string; relPath: string }[] }> {
  const staged: { repoRoot: string; relPath: string }[] = [];
  const res = await rotate(rotateEffects(staged), {
    user: USER,
    ca: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    ports: o.ports ?? ROTATE_PORTS,
    dryRun: false,
    confirm: true,
    // `wireDoor:false` OMITS the key entirely — the "operator forgot to wire the gate" case.
    ...(o.wireDoor === false ? {} : { biometricAuth: o.door ?? approving([]) }),
  });
  return { res, staged };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-1 — FAIL-CLOSED ON AN ABSENT DOOR. `rotate.test.ts` covers a door that DECLINES; this is
// the different path where no door was wired at all. Both arms run in one test, so the
// assertion cannot pass vacuously: no-door must skip, with-door must rotate.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-1: a confirmed rotation with NO biometric door wired rotates nothing (and WITH one, it does)", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const caBefore = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");

    // ARM A — the gate was never wired. Fail-closed.
    const a = await runRotate(sb, { wireDoor: false });
    expect(a.res.hadWork).toBe(true);
    expect(a.res.biometric?.ok).toBe(false);
    expect(a.res.biometric?.platform).toBe("unsupported");
    for (const port of ROTATE_PORTS) {
      expect(a.res.rotations.find((x) => x.port === port)?.action).toBe("skipped-biometric");
    }
    expect(a.staged.length).toBe(0);
    // Nothing moved on disk: the Active CA is byte-for-byte the same key.
    expect(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub")).toBe(caBefore);
    expect(existsSync(standbyMachineKeyPath(sb.home))).toBe(false);

    // ARM B — the SAME call with a door wired DOES rotate. This is what makes ARM A a check.
    const b = await runRotate(sb, { ports: ["ca-key"] });
    expect(b.res.biometric?.ok).toBe(true);
    expect(b.res.rotations.find((x) => x.port === "ca-key")?.action).toBe("rotated");
    expect(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub")).not.toBe(caBefore);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-2 — ONE FINGERPRINT FOR THE WHOLE ROTATION. `rotate.test.ts` asserts this for a single
// port; the property that matters is that it holds across ALL THREE, including the device-cert
// re-sign which is itself a gated sub-op riding the same session door.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-2: one approval covers all three ports — the underlying human door is called exactly once", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const prompts: string[] = [];
    const session = sessionBiometric(approving(prompts));
    const staged: { repoRoot: string; relPath: string }[] = [];
    const res = await rotate(rotateEffects(staged), {
      user: USER,
      ca: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      ports: ROTATE_PORTS,
      dryRun: false,
      confirm: true,
      biometricAuth: session.door,
    });

    // All three ports actually did work — otherwise "one prompt" would be trivially true.
    expect(res.rotations.length).toBe(3);
    for (const r of res.rotations) expect(["rotated", "in-overlap"]).toContain(r.action);
    expect(staged.length).toBeGreaterThan(0);

    // THE INVARIANT: the human-facing door fired once, not once per port, not once per sub-op.
    expect(session.underlyingCalls()).toBe(1);
    expect(prompts.length).toBe(1);
    // ...and the one prompt NAMES what is being approved, including the ports.
    for (const port of ROTATE_PORTS) expect(prompts[0]).toContain(port);
    expect(prompts[0]).toContain(HOST);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-3 — A REFUSAL HALTS THE RUN, AND A POISONED SESSION STAYS POISONED.
//
// HONEST SCOPE, measured rather than assumed. The first arm proves the top-level halt: a
// declined approval stops the run before ANY port is touched. It does NOT exercise session
// poisoning of the device-cert sub-op, because `rotate()` returns before that sub-op is
// reached — deleting the session cache entirely leaves this arm GREEN (verified by mutation:
// removing `if (cached !== undefined) return cached` from `sessionBiometric` does not fail
// it; what does fail it is `rotate()` ignoring the verdict). Claiming the cache was under
// test here would have been a passing assertion mistaken for a verification.
//
// So the second arm exercises the replay directly: a session already declined ONCE is handed
// to `rotate()`, which must receive the cached refusal WITHOUT a second human dialog.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-3: a declined approval halts the run, and an already-declined session replays without re-prompting", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const certBefore = readFileSync(certFile, "utf8");

    const prompts: string[] = [];
    const session = sessionBiometric(declining(prompts));
    const staged: { repoRoot: string; relPath: string }[] = [];
    const res = await rotate(rotateEffects(staged), {
      user: USER,
      ca: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      ports: ROTATE_PORTS,
      dryRun: false,
      confirm: true,
      biometricAuth: session.door,
    });

    expect(res.biometric?.ok).toBe(false);
    for (const port of ROTATE_PORTS) {
      expect(res.rotations.find((x) => x.port === port)?.action).toBe("skipped-biometric");
    }
    // ONE refusal, never a second dialog to get past it.
    expect(session.underlyingCalls()).toBe(1);
    expect(prompts.length).toBe(1);
    // Nothing staged, and the cert on disk is unchanged (not merely "not re-signed").
    expect(staged.length).toBe(0);
    expect(readFileSync(certFile, "utf8")).toBe(certBefore);
    expect(existsSync(standbyMachineKeyPath(sb.home))).toBe(false);

    // ── ARM 2: THE REPLAY. A session declined ONCE, before rotate() is even called. rotate()
    // must get the cached refusal and the human must not see a second dialog. ──────────────
    const p2: string[] = [];
    const poisoned = sessionBiometric(declining(p2));
    const first = await poisoned.door("some earlier gated op");
    expect(first.ok).toBe(false);
    expect(poisoned.underlyingCalls()).toBe(1);

    const staged2: { repoRoot: string; relPath: string }[] = [];
    const replayed = await rotate(rotateEffects(staged2), {
      user: USER,
      ca: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      ports: ROTATE_PORTS,
      dryRun: false,
      confirm: true,
      biometricAuth: poisoned.door,
    });
    expect(replayed.biometric?.ok).toBe(false);
    expect(staged2.length).toBe(0);
    // STILL one underlying call: the refusal was replayed, never re-asked.
    expect(poisoned.underlyingCalls()).toBe(1);
    expect(p2.length).toBe(1);

    // ── ARM 3: the same suite WITH an approving door does stage and does move the cert — so
    // the assertions above are discriminating, not describing a run that never got started. ──
    const ok = await runRotate(sb, { ports: ROTATE_PORTS });
    expect(ok.staged.length).toBeGreaterThan(0);
    expect(readFileSync(certFile, "utf8")).not.toBe(certBefore);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-4 — WAS A DEFECT PIN (P0), NOW THE REPAIRED PROPERTY. Fixed 2026-08-23 by Nazar.
//
// `rotate.ts`'s stated WHY-IT-IS-SAFE is ∅-blast-radius: a device cert verifies iff its signing-CA
// fingerprint is in `TrustedUserCAKeys`, so a rotation is safe exactly when the trusted set AFTER
// is a SUPERSET of the set BEFORE. `rotateCaKey` used to write the set as literally
// `[currentActive, new]` — never unioning with the CA lines already in the file — so rotation #1
// gave `[CA1, CA2]` (correct) and rotation #2 gave `[CA2, CA3]`, evicting CA1 while the cert it
// signed was well inside its validity window. This test asserted that eviction; it now asserts its
// absence, with the SAME assertion made after rotation #1 and rotation #2.
//
// The closing bound the union required (a CA may still LEAVE, but only via `--finalize`, only on
// certificate-census evidence, only with an approval that names it) is proven in
// `rotate-ca-closing-bound.test.ts`. Union without a closing bound would have traded this P0 for a
// slower one: every retired CA a permanent trust root.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-4 FIXED: the CA overlap holds at N=1 AND at N=2 — a still-valid cert's signer is never dropped", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    // The thing protected: a cert signed by CA1, well inside its validity window.
    const protectedBy = certSigningCaFingerprint(certFile);
    const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(protectedBy).toBe(ca1);

    // ── ROTATION #1 — the property holds. ─────────────────────────────────────────────────────
    const r1 = await runRotate(sb, { ports: ["ca-key"] });
    expect(r1.res.rotations.find((x) => x.port === "ca-key")?.action).toBe("rotated");
    const ca2 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(ca2).not.toBe(ca1);
    const after1 = trustedCaFingerprints(sb);
    expect(after1).toContain(ca1); // the retiring CA, still trusted
    expect(after1).toContain(ca2); // the new signer
    expect(after1).toContain(protectedBy); // ∅-blast-radius: the cert still verifies

    // ── ROTATION #2 — the IDENTICAL property STILL HOLDS. This is the line that used to fail. ──
    const r2 = await runRotate(sb, { ports: ["ca-key"] });
    expect(r2.res.rotations.find((x) => x.port === "ca-key")?.action).toBe("rotated");
    const ca3 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    const after2 = trustedCaFingerprints(sb);

    expect(after2).toContain(ca1); // <- the eviction this pin was written for
    expect(after2).toContain(ca2);
    expect(after2).toContain(ca3);
    expect(after2).toContain(protectedBy);
    expect(after2.length).toBe(3); // the whole overlap, not "the two most recent"
    // Every CA trusted after rotation #1 is still trusted after rotation #2.
    for (const fp of after1) expect(after2).toContain(fp);

    // ...and the run MEASURED it rather than asserting it: the readout's claim comes from here.
    const trust = r2.res.rotations.find((x) => x.port === "ca-key")?.trust;
    expect(trust?.supersetOfBefore).toBe(true);
    expect([...(trust?.dropped ?? [])]).toEqual([]);

    assertContained(sb, certFile, trustedUserCaKeysPath(sb.repoRoot, USER));
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-5 — WAS A DEFECT PIN (P1), NOW THE REPAIRED PROPERTY. `formatRotate` used to print the
// ∅-blast-radius guarantee on EVERY approved run, byte-identically, including the run that
// falsified it. An assertion that cannot be false is not an assertion, and on an operator surface
// it is the specific thing Aaron named as the obstacle to human-AI trust.
//
// The line is now COMPUTED from the measured `TrustSetDelta`. The discrimination that used to
// expose the defect — comparing the line across two runs with different truth values — is the same
// comparison that now proves the repair, so this test kept its shape and flipped its expectation.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-5 FIXED: the readout states the MEASURED guarantee, and says something different when it does not hold", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const protectedBy = certSigningCaFingerprint(certFile);

    const first = await runRotate(sb, { ports: ["ca-key"] });
    const second = await runRotate(sb, { ports: ["ca-key"] });
    const readout = formatRotate(second.res);

    // The claim is stated as a MEASUREMENT...
    expect(readout).toContain("∅-blast-radius VERIFIED (measured, not asserted)");
    expect(readout).toContain("0 dropped");
    // ...on a run after which the protected cert's signer IS still trusted. Both facts, one run.
    expect(trustedCaFingerprints(sb)).toContain(protectedBy);

    // DISCRIMINATION 1 — the line is NOT a constant. It carries this run's counts, so the same
    // guarantee on a different run reads differently. (Byte-identical was the defect.)
    const guaranteeLine = (str: string): string =>
      str.split("\n").find((l) => l.includes("∅-blast-radius")) ?? "";
    expect(guaranteeLine(formatRotate(first.res)).length).toBeGreaterThan(0);
    expect(guaranteeLine(formatRotate(first.res))).not.toBe(guaranteeLine(readout));

    // DISCRIMINATION 2 — a run that did NOT touch the trust set makes NO claim about it. The old
    // line printed on every approved run, including ones that never opened the trust file.
    const machineOnly = await runRotate(sb, { ports: ["machine-key"] });
    expect(formatRotate(machineOnly.res)).not.toContain("∅-blast-radius");

    // DISCRIMINATION 3 — the NOT-ESTABLISHED wording exists and is reachable, so "VERIFIED" is a
    // choice between two outcomes rather than the only string the function can emit.
    expect(formatRotate(second.res)).not.toContain("NOT ESTABLISHED");
    const narrowed: RotateResult = {
      ...second.res,
      rotations: second.res.rotations.map((r) =>
        r.trust === undefined
          ? r
          : { ...r, trust: { ...r.trust, dropped: ["SHA256:pretend"], supersetOfBefore: false } },
      ),
    };
    expect(formatRotate(narrowed)).toContain("∅-blast-radius NOT ESTABLISHED");
    expect(formatRotate(narrowed)).toContain("SHA256:pretend");
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-6 — WAS A DEFECT PIN (P1), NOW THE REPAIRED PROPERTY. `retiredCaKeyPath` /
// `retiredMachineKeyPath` were FIXED single slots and `movePrivate` renamed onto them, so rotation
// #2 destroyed rotation #1's retired private key — irreversibly, unattended, with no ceremony,
// while `ceremony-gate.ts` classifies `export-or-destroy-key` as `biometric-ceremony` and manifesto
// §5 forbids an identity transition silently destroying memory.
//
// Retirement now allocates the FIRST FREE generation (`…previous`, `…previous.2`, …) and REFUSES
// once the archive is full rather than choosing which key to destroy. The refusal path is unit-
// tested in `rotate-ca-closing-bound.test.ts` CB-8; this test keeps the original two-rotation
// scenario and asserts that generation 1 survived it.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-6 FIXED: retired keys are generational — rotation #2 preserves rotation #1's retired key", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const ca1 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    const mk1 = pubFingerprint(deviceKeyPath(sb.home) + ".pub");

    await runRotate(sb, { ports: ["ca-key", "machine-key"] });
    // After #1 the generation-1 slots hold the ORIGINAL keys.
    expect(pubFingerprint(retiredCaKeyPath(sb.home) + ".pub")).toBe(ca1);
    expect(pubFingerprint(retiredMachineKeyPath(sb.home) + ".pub")).toBe(mk1);
    const ca2 = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    const mk2 = pubFingerprint(deviceKeyPath(sb.home) + ".pub");

    const second = await runRotate(sb, { ports: ["ca-key", "machine-key"] });

    // THE REPAIR: generation 1 is STILL THERE (this is what used to be overwritten)...
    expect(pubFingerprint(retiredCaKeyPath(sb.home) + ".pub")).toBe(ca1);
    expect(pubFingerprint(retiredMachineKeyPath(sb.home) + ".pub")).toBe(mk1);
    // ...and generation 2 landed in its own slot, which the result NAMES rather than implying.
    const caGen2 = retiredKeyPathForGeneration(retiredCaKeyPath(sb.home), 2);
    const mkGen2 = retiredKeyPathForGeneration(retiredMachineKeyPath(sb.home), 2);
    expect(pubFingerprint(caGen2 + ".pub")).toBe(ca2);
    expect(pubFingerprint(mkGen2 + ".pub")).toBe(mk2);
    expect(second.res.rotations.find((r) => r.port === "ca-key")?.retiredArtifactPath).toBe(caGen2);
    expect(second.res.rotations.find((r) => r.port === "machine-key")?.retiredArtifactPath).toBe(mkGen2);
    // Four distinct retired keys on disk after two rotations — nothing was destroyed to make room.
    expect(new Set([ca1, ca2, mk1, mk2]).size).toBe(4);

    assertContained(sb, retiredCaKeyPath(sb.home), retiredMachineKeyPath(sb.home), caGen2, mkGen2);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-7 — INVERTED 2026-08-24 (the pin fired). It asserted the LIVE defect: an unrecognised port
// was not refused, it was silently dispatched to `device-cert`, reported `rotated`, staged for a
// PR, and approved by a prompt naming the port that did NOT move. Fixing the defect turned this
// test RED exactly as a self-cleaning pin should, and it is inverted here rather than deleted —
// same scenario, same two arms, now asserting the repaired property.
//
// WHAT THE FIX IS. Two guards that are complements, not substitutes:
//   * TYPE — `planPort` and `rotatePort` are now `default`-less switches (the shape
//     `ceremony-gate.ts` `ceremonyRequirementFor` already earns), so a new `RotatePort` member is a
//     compile error until it is classified. `PortPlan` is discriminated per port and each handler
//     takes only its own member, so wiring a case to the wrong handler is a compile error too —
//     exhaustiveness alone does NOT catch that, and it is the same wrong-port rotation by a
//     different route. Neither property is testable from here: a type error is not a runtime
//     observation, so the discrimination proof for it is in the PR body, not in this file.
//   * VALUE — a roster check inside `rotate()` (not in two copies in two CLIs) refuses a value cast
//     into the union. That is the half this test CAN observe, and the half it pins.
//
// Discrimination is still the two arms: a RECOGNISED port rotates the CA, an UNRECOGNISED one now
// rotates NOTHING AT ALL. Different inputs, different outcomes — it cannot pass by accident. Arm C
// pins the consent property directly: the prompt names what is PERFORMED, not what was REQUESTED.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-7 FIXED: an unrecognised port is REFUSED whole — nothing rotates, nothing stages, nobody is prompted", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const caBefore = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const certBefore = readFileSync(certFile, "utf8");

    // ARM A — a RECOGNISED port. Unchanged from the defect version: the CA moves.
    const good = await runRotate(sb, { ports: ["ca-key"] });
    expect(good.res.rotations.map((r) => r.port)).toEqual(["ca-key"]);
    expect(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub")).not.toBe(caBefore);
    const caAfterGood = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(certBefore.length).toBeGreaterThan(0);

    // ARM B — an UNRECOGNISED port. A hyphen/underscore typo, or a value cast into the union by a
    // programmatic caller. It USED to rotate the device cert and report success.
    const certBeforeB = readFileSync(certFile, "utf8");
    const prompts: string[] = [];
    const staged: { repoRoot: string; relPath: string }[] = [];
    let refusal: unknown;
    try {
      await rotate(rotateEffects(staged), {
        user: USER,
        ca: USER,
        repoRoot: sb.repoRoot,
        home: sb.home,
        hostname: HOST,
        ports: ["ca_key" as RotatePort],
        dryRun: false,
        confirm: true,
        biometricAuth: sessionBiometric(approving(prompts)).door,
      });
    } catch (e) {
      refusal = e;
    }

    // THE REPAIRED PROPERTY. Refused, by name, before anything happened.
    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as Error).message).toContain("ca_key");
    expect((refusal as Error).message).toContain("machine-key, device-cert, ca-key");

    // The CA the operator asked for did not move — but neither did anything ELSE. That second half
    // is the fix: under the defect the cert moved instead, which is what made "rotated" a lie.
    expect(pubFingerprint(caPrivateKeyPath(sb.home) + ".pub")).toBe(caAfterGood);
    expect(readFileSync(certFile, "utf8")).toBe(certBeforeB);
    expect(staged.length).toBe(0);

    // And NO prompt was raised. The refusal is BEFORE the gate, so a human is never asked to
    // approve an act the mechanism cannot name. Under the defect this fired once, naming `ca_key`
    // while `device-cert` was performed.
    expect(prompts.length).toBe(0);

    // A dry run is refused on the same input too — the readout is a claim about what WOULD happen,
    // and "would rotate device-cert" for a requested `ca_key` is the same lie without the writes.
    let dryRefusal: unknown;
    try {
      await rotate(rotateEffects([]), {
        user: USER,
        ca: USER,
        repoRoot: sb.repoRoot,
        home: sb.home,
        hostname: HOST,
        ports: ["ca_key" as RotatePort],
        dryRun: true,
      });
    } catch (e) {
      dryRefusal = e;
    }
    expect(dryRefusal).toBeInstanceOf(Error);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-7b — THE CONSENT PROPERTY, ON ITS OWN. RR-7's arm B proves an unnameable port raises no
// prompt. This proves the positive form for ports that ARE recognised: the ONE prompt names the
// ports that will actually be rotated, not the ports that were requested.
//
// The two lists differ whenever a requested port is not set up on this host. The old prompt was
// rendered from `opts.ports` (the REQUEST) and said "machine-key, device-cert, ca-key" while only
// machine-key moved. It is now rendered from the same classified plans the dispatcher consumes.
//
// Discrimination: ARM A is a host missing its CA (requested 3, performs 1) and ARM B is a complete
// host (requested 3, performs 3). Same request, different prompts, each matching what was done —
// so a prompt that just echoed the request would fail arm A, and one that named a fixed list would
// fail arm B.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-7b: the ONE biometric prompt names the ports PERFORMED, never the ports requested", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);

    // ARM A — remove the CA private key. `ca-key` and `device-cert` both become absent (the cert
    // re-sign needs a CA to sign with), so of the three requested only `machine-key` can rotate.
    const caPriv = caPrivateKeyPath(sb.home);
    const parked = join(sb.home, "ca-priv.parked");
    renameSync(caPriv, parked);

    const promptsA: string[] = [];
    const a = await runRotate(sb, { ports: ROTATE_PORTS, door: approving(promptsA) });
    const performedA = a.res.rotations.filter((r) => r.action === "rotated").map((r) => r.port);
    expect(performedA).toEqual(["machine-key"]);
    expect(promptsA.length).toBe(1);
    // Names what it did.
    expect(promptsA[0]).toContain("machine-key");
    // Does NOT name what it did not do, though both were REQUESTED.
    expect(promptsA[0]).not.toContain("ca-key");
    expect(promptsA[0]).not.toContain("device-cert");
    expect([...a.res.ports] as string[]).toEqual([...ROTATE_PORTS] as string[]); // the request is still reported

    // ARM B — restore the CA. Now all three are present, so all three are named.
    renameSync(parked, caPriv);
    const promptsB: string[] = [];
    const b = await runRotate(sb, { ports: ROTATE_PORTS, door: approving(promptsB) });
    const performedB = b.res.rotations.filter((r) => r.action === "rotated").map((r) => r.port);
    expect(new Set(performedB)).toEqual(new Set(ROTATE_PORTS));
    expect(promptsB.length).toBe(1);
    for (const port of ROTATE_PORTS) {
      expect(promptsB[0]).toContain(port);
    }
    // The two prompts differ — the discrimination. A prompt echoing the request would be identical.
    expect(promptsA[0]).not.toBe(promptsB[0]);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-8 — APPLY-N, NAMED HONESTLY. Discipline #6 asks apply-N == apply-once EFFECT, "or name the
// non-idempotence". `rotate` is deliberately NOT idempotent across whole runs: each confirmed run
// is a FRESH rotation. The idempotency key is the STANDBY's presence — a run that finds a standby
// RESUMES that overlap instead of minting a second. This pins both halves so neither can be
// mistaken for the other later.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-8: rotate is NOT idempotent across runs BY DESIGN — the idempotency key is standby-presence", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);

    // ── NOT idempotent across runs: apply-3 yields three DISTINCT Active machine keys. ──
    const seen: string[] = [pubFingerprint(deviceKeyPath(sb.home) + ".pub")];
    for (let i = 0; i < 3; i++) {
      const r = await runRotate(sb, { ports: ["machine-key"] });
      expect(r.res.rotations[0]!.action).toBe("rotated");
      seen.push(pubFingerprint(deviceKeyPath(sb.home) + ".pub"));
    }
    expect(new Set(seen).size).toBe(4); // original + 3 rotations, all different

    // ── Idempotent ON THE KEY: with a standby present, a re-run RESUMES rather than re-mints. ──
    const fx = rotateEffects([]);
    fx.mkdirp(dirname(standbyMachineKeyPath(sb.home)));
    fx.genEd25519(standbyMachineKeyPath(sb.home), `${HOST} (zeta-machine)`);
    const stagedStandby = pubFingerprint(standbyMachineKeyPath(sb.home) + ".pub");

    const resume = await runRotate(sb, { ports: ["machine-key"] });
    expect(resume.res.rotations[0]!.action).toBe("in-overlap");
    // The promoted Active IS the pre-staged standby — no second standby was minted.
    expect(pubFingerprint(deviceKeyPath(sb.home) + ".pub")).toBe(stagedStandby);
    // Discrimination: the immediately preceding run (no standby) minted a NEW key instead.
    expect(stagedStandby).not.toBe(seen[seen.length - 1]);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// RR-9 — THE HONEST LIMIT, PRINTED. A limitation that lives only in a comment is a limitation
// nobody reads, so this emits it on every run. It is not a vacuous test: it ASSERTS the
// containment that makes the limitation true — this suite never reaches a real door.
// ══════════════════════════════════════════════════════════════════════════════════════════
test("RR-9: what this suite CANNOT prove — asserted by construction and printed on every run", () => {
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  // The claim "no real door can fire from this file" is CHECKED, not asserted. Only the IMPORT
  // statements are inspected — prose mentioning a symbol is not a call site, and checking the
  // whole file would fail on this very comment.
  const imports = source.split("\n").filter((l) => l.startsWith("import ")).join("\n");
  expect(imports).toContain("sessionBiometric");
  // The real doors and every surface that could reach `sudo` / /etc/pam.d are NOT imported.
  for (const forbidden of ["realBiometric", "macTouchIdAuth", "realSudoGateEffects", "analyzeSudoAuthChain"]) {
    expect(imports).not.toContain(forbidden);
  }
  // Every door this file constructs is a fake returning a literal verdict.
  expect(source).toContain("platform: \"macos-touchid\"");

  process.stdout.write(
    [
      "",
      "  ┌─ NOT PROVEN BY THIS SUITE (live material / physical device required) ───────────┐",
      "  │ 1. A REAL biometric. Every door here is a fake; what is proven is that the      │",
      "  │    CALLER honours the door's verdict, never that a finger touched a sensor.     │",
      "  │    See biometric.ts `claimsBiometric()` — on a stock macOS sudo stack a         │",
      "  │    fingerprint, a smart-card PIN and a password are indistinguishable, so even  │",
      "  │    a live run reports factor `unattributed`, not `biometric`.                   │",
      "  │    MANUAL: run the rotate CLI with --confirm on a host whose /etc/pam.d/sudo    │",
      "  │    has pam_tid.so as the ONLY satisfier, and confirm the readout says           │",
      "  │    `factor established: biometric`. Nothing here can substitute for that.       │",
      "  │ 2. A REAL HSM / PIV token. `open-authenticated-hsm-session` and                 │",
      "  │    `provision-or-reconfigure-hardware-token` are biometric-ceremony in          │",
      "  │    ceremony-gate.ts and need the physical device.                               │",
      "  │ 3. A REAL sshd handshake. Cert acceptance is asserted by the rule sshd applies  │",
      "  │    (signing-CA fingerprint present in TrustedUserCAKeys), not by connecting.    │",
      "  │ 4. THE LIVE ESTATE. Nothing here rotates, revokes or re-issues any real key.    │",
      "  │    The live path is a ceremony, not an agent action: the rotate CLI defaults to │",
      "  │    a dry run, and the operator procedure is ONBOARDING-RUNBOOK.md.              │",
      "  └─────────────────────────────────────────────────────────────────────────────────┘",
      "",
    ].join("\n"),
  );
});
