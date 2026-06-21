// Zeta NEW-FORK ONBOARDING ROUND-TRIP harness — the repeatable setup → (rotate) → teardown →
// re-setup lifecycle test (workitem 081KVM1TK3Z08QG0R0002959G6 §"clean re-onboarding"). Aaron
// (2026-06-21): *"make sure our blueprints have rotation/setup/teardown for all ports + flows,
// then test them a few times and get them right — this is the hardest part of onboarding, make
// it tight; it's basically a new fork setting up for the first time after a teardown."*
//
// WHAT IT PROVES — the lifecycle CONVERGES + is STABLE across repeated cycles, end-to-end, on the
// REAL setup-machine / ca / teardown modules (not re-implemented), so we can iterate to tight:
//   1. SETUP    — setupMachine realizes a CA + machine key + signs a cert (N+M: Key ID =
//                 machine-only, principal = user; NO user@machine composite).
//   2. VERIFY   — the generated state is complete + internally consistent on disk.
//   3. TEARDOWN — teardown (--confirm + biometric) wipes local private material + stages repo
//                 unregister; nothing left.
//   4. RE-SETUP — setup runs AGAIN on the now-clean sandbox: a full clean regeneration (the
//                 NEW-FORK first-time path), equivalent to cycle 1.
//   5. LOOP     — the setup→teardown→re-setup cycle runs N times; each converges to the same
//                 clean state (tight + stable; no drift, no leftover).
//   6. ROTATE   — exercises the ONE rotate path that exists (keyset.rotate: gapless dual-key set
//                 rotation) generate→rotate→verify. There is NO unified per-PORT rotate command
//                 (machine / CA / cert / cluster) — that gap is asserted + named here, NOT faked.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ──────────────────────────────────────────────────────────┐
// │ EVERY cycle runs ENTIRELY inside throwaway temp dirs: a temp HOME (mktemp) holds all PRIVATE │
// │ material (~/.config/zeta lives UNDER the temp home), a temp repoRoot holds all PUBLIC        │
// │ artifacts. The biometric door is a FAKE (no Touch ID / Hello). `gitRm` is a FAKE that        │
// │ unlinks UNDER the temp repoRoot only (NO real `git`, honors shared-checkout-is-view-only).   │
// │ Trust resolution is a FAKE (NO network). NOTHING touches the real ~/.config/zeta, real       │
// │ 1Password / `op`, real `git` on the real repo, or any real key. A test that would touch real │
// │ state is a FAIL. The keygen IS real ssh-keygen — but pointed wholly at the temp dirs via the │
// │ modules' own `home` / `repoRoot` knobs, so the round-trip proof is genuine yet contained.    │
// └────────────────────────────────────────────────────────────────────────────────────────────┘
//
// NO key-shaped literal appears in this file (the private-key header marker is SPLIT + assembled
// at runtime so a grep for it is EMPTY).
//
// Noninterference (manifesto §13): the only ambient influence into the real modules is through
// their injected effects bundles — so pointing every door at temp dirs + fakes fully contains the
// run. Idempotency (§12): the convergence assertion IS the idempotency proof (apply-the-cycle-N
// == apply-once effect — the same clean state each loop).
//
// Anchors (Beacon): the modules' own anchors hold (ed25519 device keys — Bernstein et al. 2011;
// OpenSSH user-CA certs `ssh-keygen -s` / `TrustedUserCAKeys`; secure erasure `shred(1)` / Gutmann
// 1996). Round-trip / setup-teardown-resetup convergence testing = the "clean re-onboarding" proof
// (idempotent provisioning, the Terraform/NixOS "destroy then apply ⇒ same state" discipline).
// Run: bun test onboarding-roundtrip.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setupMachine, type SetupMachineResult } from "./setup-machine.ts";
import { teardown, type TeardownResult, ZETA_LOCAL_DIRS, zetaLocalDirPath } from "./teardown.ts";
import { realEffects as machineRealFx } from "./machine.ts";
import { caPrivateKeyPath, caPublicKeyPath, certPath, realEffects as caRealFx } from "./ca.ts";
import { machinePubPath, deviceKeyPath } from "./machine.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { TeardownEffects } from "./teardown.ts";
import { freshKeyringSet, rotate, assertWellFormed, publicSet } from "./keyset.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

const USER = "tester";
const HOST = "roundtrip-host";

/** A throwaway sandbox: a temp HOME (all PRIVATE material lands under it) + a temp repoRoot (all
 *  PUBLIC artifacts). Both are mktemp dirs that NEVER coincide with the real ~/.config/zeta or
 *  the real repo. `assertContained` is the safety guard the whole harness leans on. */
interface Sandbox {
  readonly home: string;
  readonly repoRoot: string;
  readonly cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const home = mkdtempSync(join(tmpdir(), "zeta-rt-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-rt-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

/** SAFETY GUARD — assert a path lives strictly under the sandbox temp root. Any path the harness
 *  is about to read/assert MUST pass this; a path outside `tmpdir()` means we drifted toward real
 *  state and the test FAILS LOUD rather than silently touching it. */
function assertContained(sb: Sandbox, ...paths: string[]): void {
  const root = tmpdir();
  for (const p of paths) {
    expect(p.startsWith(root)).toBe(true);
    expect(p.startsWith(sb.home) || p.startsWith(sb.repoRoot)).toBe(true);
  }
}

/** A FAKE biometric door (no real Touch ID / Hello) — always approves; records every prompt so a
 *  cycle can assert the one-fingerprint property held (the human gate fired exactly once). */
function fakeBiometric(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid" };
  };
}

/** Build the REAL setup effects (real ssh-keygen via machine.ts / ca.ts realEffects) but with the
 *  hostname pinned + every path forced under the sandbox (the modules take `home`/`repoRoot`), a
 *  FAKE biometric session door, and a FAKE (no-network) trust resolver. The keygen is genuine; it
 *  is just aimed wholly at the temp dirs. */
function setupEffects(sessionDoor: BiometricAuth): OnboardEffects {
  const machine = { ...machineRealFx(), hostname: () => HOST };
  // No-network trust resolver: nothing to resolve, no fetch ever happens.
  const trust: GithubTrustEffects = {
    exists: () => false,
    readText: () => "",
    listDir: () => [],
    fetchKeys: async () => "",
    fetchGpg: async () => "",
  };
  const ca = caRealFx();
  return { machine, trust, ca, biometricAuth: sessionDoor };
}

/** FAKE teardown effects: presence + listFiles read the REAL temp filesystem (so the wipe is a
 *  genuine round-trip), `securelyRemove` is a plain unlink of the temp file (no `shred` shell-out),
 *  and `gitRm` UNLINKS under the temp repoRoot ONLY (NO real `git`, honors view-only). */
function teardownEffects(staged: { repoRoot: string; relPath: string }[]): TeardownEffects {
  return {
    exists: (p) => existsSync(p),
    listFiles: (dir) => {
      if (!existsSync(dir)) return [];
      const out: string[] = [];
      const walk = (d: string): void => {
        for (const name of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, name.name);
          if (name.isDirectory()) walk(full);
          else out.push(full);
        }
      };
      walk(dir);
      return out;
    },
    securelyRemove: (path) => {
      if (existsSync(path)) rmSync(path, { force: true });
      return !existsSync(path);
    },
    removeDir: (dir) => {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    },
    gitRm: (repoRoot, relPath) => {
      staged.push({ repoRoot, relPath });
      const full = join(repoRoot, relPath);
      if (existsSync(full)) rmSync(full, { force: true });
      return true; // staged (fake) — never shells real git, never pushes
    },
  };
}

/** Probe whether a CA private key already exists in the sandbox (drives the realize-CA-when-missing
 *  branch of setupMachine: false on a clean fork ⇒ realize one; true ⇒ reuse). Reads ONLY presence
 *  of a temp path. */
function caConfiguredInSandbox(sb: Sandbox): boolean {
  return existsSync(caPrivateKeyPath(sb.home));
}

// ── One SETUP cycle on a (possibly fresh) sandbox ─────────────────────────────────────────────
async function runSetup(sb: Sandbox): Promise<{ res: SetupMachineResult; prompts: string[] }> {
  const prompts: string[] = [];
  const session = sessionBiometric(fakeBiometric(prompts));
  const fx = setupEffects(session.door);
  const res = await setupMachine(fx, session, {
    user: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    caConfigured: caConfiguredInSandbox(sb), // clean fork ⇒ false ⇒ realize CA under one approval
  });
  return { res, prompts };
}

// ── One TEARDOWN on a sandbox ─────────────────────────────────────────────────────────────────
async function runTeardown(
  sb: Sandbox,
): Promise<{ res: TeardownResult; prompts: string[]; staged: { repoRoot: string; relPath: string }[] }> {
  const prompts: string[] = [];
  const staged: { repoRoot: string; relPath: string }[] = [];
  const fx = teardownEffects(staged);
  const res = await teardown(fx, {
    ca: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    dryRun: false,
    confirm: true,
    biometricAuth: fakeBiometric(prompts),
  });
  return { res, prompts, staged };
}

/** The artifact paths a complete N+M setup produces, all under the sandbox. */
function expectedPaths(sb: Sandbox) {
  const devPriv = deviceKeyPath(sb.home);
  const devPub = machinePubPath(sb.repoRoot, HOST);
  const caPriv = caPrivateKeyPath(sb.home);
  const caPub = caPublicKeyPath(sb.repoRoot, USER);
  const cert = certPath(devPub);
  return { devPriv, devPub, caPriv, caPub, cert };
}

/** ASSERT the sandbox holds a COMPLETE, internally-consistent N+M setup state (the VERIFY step).
 *  Returns the cert text so the loop can compare structural shape across cycles (NOT raw bytes —
 *  keys are random each cycle). */
function assertCompleteSetup(sb: Sandbox, res: SetupMachineResult): { keyId: string; principals: string } {
  const p = expectedPaths(sb);
  assertContained(sb, p.devPriv, p.devPub, p.caPriv, p.caPub, p.cert);

  // CA present (realized this cycle) — private local + public registered in the repo.
  expect(res.caRealized?.action).toBe("generated");
  expect(existsSync(p.caPriv)).toBe(true);
  expect(existsSync(p.caPub)).toBe(true);

  // Machine key present + registered.
  expect(res.onboard.machine.action).toBe("generated");
  expect(existsSync(p.devPriv)).toBe(true);
  expect(existsSync(p.devPub)).toBe(true);

  // Cert present + signed, and N+M correct: Key ID = machine-only (NO user@machine composite),
  // principal = the user. This is the #8926 / #8969 N+M (not N×M) invariant.
  expect(res.onboard.cert?.action).toBe("signed");
  const cert = res.onboard.cert;
  if (cert === undefined) throw new Error("cert missing after a complete setup");
  expect(cert.certId).toBe(HOST); // machine-only Key ID
  expect(cert.certId).not.toContain("@"); // never user@machine
  expect(cert.principals).toEqual([USER]); // user lives in the principal, not the Key ID
  expect(cert.principal).toBe(USER);
  expect(existsSync(p.cert)).toBe(true);

  // The machine key label is machine-only too (pure-key model).
  expect(res.onboard.machine.keyLabel).toBe(`${HOST} (zeta-machine)`);
  expect(res.onboard.machine.keyLabel).not.toContain("@");

  // One-fingerprint held: exactly one human approval covered keygen + realize-CA + cert-sign.
  expect(res.biometricApprovals).toBe(1);

  // No private-key bytes ever surfaced in the public result fields.
  const publicBlob = JSON.stringify({
    caRealized: { ...res.caRealized, caPublicKey: undefined },
    machine: { ...res.onboard.machine, publicKey: undefined, biometric: res.onboard.machine.biometric },
    cert: { ...res.onboard.cert, certText: undefined },
  });
  expect(publicBlob).not.toContain(PRIV_MARKER);

  return { keyId: cert.certId, principals: cert.principal };
}

/** ASSERT the sandbox is FULLY CLEAN after teardown — no local private dirs, no repo artifacts. */
function assertFullyClean(sb: Sandbox): void {
  const p = expectedPaths(sb);
  for (const dir of ZETA_LOCAL_DIRS) {
    expect(existsSync(zetaLocalDirPath(dir, sb.home))).toBe(false);
  }
  for (const path of [p.devPriv, p.devPub, p.caPriv, p.caPub, p.cert]) {
    expect(existsSync(path)).toBe(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1+2. SETUP generates a complete N+M state; VERIFY it is complete + internally consistent.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("SETUP (new fork): generates a complete N+M state (CA + machine key + cert), one approval", async () => {
  const sb = makeSandbox();
  try {
    const { res, prompts } = await runSetup(sb);
    expect(prompts.length).toBe(1); // one-fingerprint
    const shape = assertCompleteSetup(sb, res);
    expect(shape.keyId).toBe(HOST);
    expect(shape.principals).toBe(USER);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. TEARDOWN wipes the generated state — nothing left.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("TEARDOWN: confirmed + biometric wipes local private material + stages repo unregister; nothing left", async () => {
  const sb = makeSandbox();
  try {
    await runSetup(sb);
    const { res, prompts, staged } = await runTeardown(sb);
    expect(prompts.length).toBe(1); // one destructive approval
    expect(res.biometric?.ok).toBe(true);
    expect(res.hadWork).toBe(true);
    // Local private dirs that existed were wiped; repo public artifacts were staged for removal.
    expect(res.localWipe.some((l) => l.action === "wiped")).toBe(true);
    expect(res.repoUnregister.some((r) => r.action === "unregistered")).toBe(true);
    // Every staged git rm operated ONLY under the sandbox repoRoot (view-only honored).
    expect(staged.every((s) => s.repoRoot === sb.repoRoot)).toBe(true);
    assertContained(sb, ...staged.map((s) => join(s.repoRoot, s.relPath)));
    assertFullyClean(sb);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. RE-SETUP on the now-clean sandbox — full clean regeneration (the new-fork first-time path).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("RE-SETUP after teardown: full clean regeneration, equivalent to cycle 1 (new-fork path)", async () => {
  const sb = makeSandbox();
  try {
    const first = await runSetup(sb);
    const firstShape = assertCompleteSetup(sb, first.res);

    await runTeardown(sb);
    assertFullyClean(sb);
    expect(caConfiguredInSandbox(sb)).toBe(false); // truly a clean fork again

    const second = await runSetup(sb);
    const secondShape = assertCompleteSetup(sb, second.res);

    // Structurally equivalent (same Key ID, same principal, same N+M shape) — keys differ (random),
    // which is correct: a NEW fork mints fresh key material, not the old bytes.
    expect(secondShape).toEqual(firstShape);
    expect(second.res.caRealized?.action).toBe("generated"); // realized fresh, not reused
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 5. LOOP the setup→teardown→re-setup cycle N times — converges to the SAME clean state each loop.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("LOOP: N cycles of setup→teardown→re-setup converge identically (tight + stable, no drift)", async () => {
  const N = 3;
  const sb = makeSandbox();
  try {
    const shapes: { keyId: string; principals: string }[] = [];
    for (let i = 0; i < N; i++) {
      // SETUP — on a clean fork each iteration (teardown ran at the end of the previous one).
      expect(caConfiguredInSandbox(sb)).toBe(false);
      const { res } = await runSetup(sb);
      shapes.push(assertCompleteSetup(sb, res));

      // TEARDOWN — back to fully clean.
      const td = await runTeardown(sb);
      expect(td.res.biometric?.ok).toBe(true);
      assertFullyClean(sb);
    }
    // CONVERGENCE: every cycle produced the SAME N+M shape (no drift, no accumulation).
    for (const s of shapes) expect(s).toEqual(shapes[0]!);
    expect(shapes.length).toBe(N);

    // STABILITY: a final teardown on the already-clean sandbox is an idempotent no-op (no prompt).
    const finalTd = await runTeardown(sb);
    expect(finalTd.res.hadWork).toBe(false);
    expect(finalTd.prompts.length).toBe(0); // nothing destructive ⇒ no approval needed
    assertFullyClean(sb);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 6. ROTATE — exercise the ONE rotate path that exists (keyset.rotate); name the gaps for the rest.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("ROTATE (keyset): generate → rotate → verify — old retired, new active, overlap (>=2 always)", () => {
  // keyset.rotate is the ONLY real per-port rotate primitive in persona-keys today (gapless
  // dual-key set rotation). Exercise it deterministically (no fs, no network, pure).
  const before = freshKeyringSet(USER);
  assertWellFormed(before);
  expect(before.standby.length).toBeGreaterThanOrEqual(1);
  const oldActiveSeed = before.active.mnemonic;
  const promotedSeed = before.standby[0]!.mnemonic;

  // Provide the fresh standby seed explicitly (the only randomness) — DST-replayable rotation.
  const freshStandby = freshKeyringSet("seed-source").active.mnemonic;
  const after = rotate(before, freshStandby);
  assertWellFormed(after);

  // OLD active retired; the promoted standby is now active (byte-identical continuity, the overlap).
  expect(after.retired.some((s) => s.mnemonic === oldActiveSeed)).toBe(true);
  expect(after.active.mnemonic).toBe(promotedSeed);
  // OVERLAP / never-single: >=2 keys at all times (the retiring + the incoming both exist).
  expect(after.standby.length).toBeGreaterThanOrEqual(1);
  expect(1 + after.standby.length).toBeGreaterThanOrEqual(2);
  // Public projection carries no private seed material.
  const pub = JSON.stringify(publicSet(after));
  expect(pub).not.toContain(after.active.mnemonic);
});

test("ROTATE GAP (named, not faked): no unified per-PORT rotate command for machine/CA/cert/cluster", () => {
  // HONEST GAP REPORT (asserted as a test so it stays true / Otto can backlog it). The ONLY rotate
  // primitives that exist are: keyset.rotate (dual-key SET, exercised above) + keyring.sh rotate
  // (USER seed, bash). There is NO `rotate` for: the MACHINE device key, the CA key, a device CERT
  // (re-sign), or a CLUSTER trust root. setup-machine / ca / setup-cluster expose NO rotate verb.
  // We assert the ABSENCE rather than fake a rotate — building those commands is OUT of scope here.
  const setupMachineSrc = readFileSync(join(import.meta.dir, "setup-machine.ts"), "utf8");
  const caSrc = readFileSync(join(import.meta.dir, "ca.ts"), "utf8");
  const setupClusterSrc = readFileSync(join(import.meta.dir, "setup-cluster.ts"), "utf8");

  // None of the per-port modules export a rotate function (the gap).
  expect(/export\s+(async\s+)?function\s+rotate/.test(setupMachineSrc)).toBe(false);
  expect(/export\s+(async\s+)?function\s+rotate/.test(caSrc)).toBe(false);
  expect(/export\s+(async\s+)?function\s+rotate/.test(setupClusterSrc)).toBe(false);

  // The one place a real rotate primitive lives is keyset.ts (confirmed by the exercise above).
  const keysetSrc = readFileSync(join(import.meta.dir, "keyset.ts"), "utf8");
  expect(/export\s+function\s+rotate/.test(keysetSrc)).toBe(true);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SAFETY meta-assertion: every path the harness touched is under the temp root (sandbox-only).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("SANDBOX-ONLY: all generated/wiped paths live strictly under the temp root (never real state)", async () => {
  const sb = makeSandbox();
  try {
    const { res } = await runSetup(sb);
    const p = expectedPaths(sb);
    // Every artifact path is under tmpdir() AND under this sandbox's home/repoRoot.
    assertContained(sb, p.devPriv, p.devPub, p.caPriv, p.caPub, p.cert);
    // The real ~/.config/zeta default paths are NOT under our sandbox (we never used them).
    expect(deviceKeyPath().startsWith(sb.home)).toBe(false);
    expect(caPrivateKeyPath().startsWith(sb.home)).toBe(false);
    // The generated files are non-empty real keys (genuine round-trip), but contained.
    expect(statSync(p.devPriv).size).toBeGreaterThan(0);
    expect(statSync(p.caPriv).size).toBeGreaterThan(0);
    void res;
  } finally {
    sb.cleanup();
  }
});
