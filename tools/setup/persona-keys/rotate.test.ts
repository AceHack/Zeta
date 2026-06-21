// Zeta PER-PORT rotate — conformance + ∅-blast-radius proof (workitem 081KVP2M1QS008QG0R000JSXE1E).
// Proves the overlap-window lifecycle for each port: machine key, device cert, CA key.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ──────────────────────────────────────────────────────────────┐
// │ EVERY test runs ENTIRELY inside throwaway temp dirs: a temp HOME (mktemp) holds all PRIVATE     │
// │ material (~/.config/zeta under it), a temp repoRoot holds all PUBLIC artifacts. The biometric   │
// │ door is a FAKE (no Touch ID / Hello). `stageRepoWrite` is a FAKE that touches NOTHING outside   │
// │ the temp repoRoot (NO real `git`, honors shared-checkout-is-view-only). NOTHING touches the     │
// │ real ~/.config/zeta, real 1Password / `op`, real `git`, or any real key. A test that would      │
// │ touch real state is a FAIL. The keygen + sign ARE real ssh-keygen — pointed wholly at the temp  │
// │ dirs via the modules' own `home`/`repoRoot` knobs, so the rotation proof is genuine yet          │
// │ contained. The ∅-blast-radius check uses real `ssh-keygen -L` on contained certs.               │
// └────────────────────────────────────────────────────────────────────────────────────────────────┘
//
// NO key-shaped literal appears in this file (the private-key header marker is SPLIT at runtime so a
// grep for it is EMPTY).
// Run: bun test rotate.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { setupMachine } from "./setup-machine.ts";
import { realEffects as machineRealFx, deviceKeyPath, machinePubPath } from "./machine.ts";
import {
  caPrivateKeyPath,
  caPublicKeyPath,
  certPath,
  realEffects as caRealFx,
} from "./ca.ts";
import { trustedUserCaKeysPath } from "./setup-cluster.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import {
  rotate,
  ROTATE_PORTS,
  standbyMachineKeyPath,
  standbyCaKeyPath,
  retiredMachineKeyPath,
  type RotateEffects,
  type RotateResult,
  type RotatePort,
} from "./rotate.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

const USER = "tester";
const HOST = "rotate-host";

interface Sandbox {
  readonly home: string;
  readonly repoRoot: string;
  readonly cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const home = mkdtempSync(join(tmpdir(), "zeta-rot-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-rot-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

/** SAFETY GUARD — every path the test reads/asserts MUST live strictly under the sandbox temp root.
 *  A path outside `tmpdir()` means we drifted toward real state → FAIL LOUD. */
function assertContained(sb: Sandbox, ...paths: string[]): void {
  const root = tmpdir();
  for (const p of paths) {
    expect(p.startsWith(root)).toBe(true);
    expect(p.startsWith(sb.home) || p.startsWith(sb.repoRoot)).toBe(true);
  }
}

/** A FAKE biometric door — always approves; records every prompt so a test can assert the
 *  one-fingerprint property (the human gate fired exactly once per rotation). */
function fakeBiometric(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid" };
  };
}

/** A FAKE biometric door that ALWAYS DECLINES — for the fail-closed test. */
function declineBiometric(prompts: string[]): BiometricAuth {
  return async (prompt: string) => {
    prompts.push(prompt);
    return { ok: false, platform: "macos-touchid", reason: "test decline" };
  };
}

/** Build REAL setup effects (real ssh-keygen) pinned to the sandbox + a fake biometric + no-network
 *  trust resolver — the SAME pattern the round-trip harness uses to provision initial state. */
function setupEffects(sessionDoor: BiometricAuth): OnboardEffects {
  const machine = { ...machineRealFx(), hostname: () => HOST };
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

/** Provision a COMPLETE N+M setup in the sandbox (CA + machine key + cert) via the REAL setup path. */
async function provision(sb: Sandbox): Promise<void> {
  const prompts: string[] = [];
  const session = sessionBiometric(fakeBiometric(prompts));
  const fx = setupEffects(session.door);
  const res = await setupMachine(fx, session, {
    user: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    caConfigured: false, // clean fork ⇒ realize CA under one approval
  });
  expect(res.onboard.cert?.action).toBe("signed");
  expect(existsSync(caPrivateKeyPath(sb.home))).toBe(true);
  expect(existsSync(deviceKeyPath(sb.home))).toBe(true);
}

/** FAKE rotate effects: genuine ssh-keygen (machine.ts/ca.ts realEffects) for genKey/sign + real
 *  temp-fs reads/writes/moves; `stageRepoWrite` records the staged path + touches NOTHING beyond the
 *  temp repoRoot (NO real git). The keygen is real; it is just aimed wholly at the temp dirs. */
function rotateEffects(staged: { repoRoot: string; relPath: string }[], sessionDoor: BiometricAuth): RotateEffects {
  const machine = machineRealFx();
  const ca = caRealFx();
  // The cert door needs the session biometric (the cert re-sign is gated) — wire it into ca effects'
  // caller via the rotate opts, not the effects bundle; ca effects are pure doors (no biometric).
  void sessionDoor;
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
    ca,
    stageRepoWrite: (repoRoot, relPath) => {
      staged.push({ repoRoot, relPath });
      return true; // staged (fake) — NEVER shells real git, NEVER pushes
    },
  };
}

/** Run a rotation in the sandbox (confirmed + fake biometric), all ports unless overridden. */
async function runRotate(
  sb: Sandbox,
  overrides: Partial<{ ports: readonly RotatePort[]; decline: boolean; rotationTag: string }> = {},
): Promise<{ res: RotateResult; prompts: string[]; staged: { repoRoot: string; relPath: string }[] }> {
  const prompts: string[] = [];
  const staged: { repoRoot: string; relPath: string }[] = [];
  const biometric = overrides.decline ? declineBiometric(prompts) : fakeBiometric(prompts);
  const fx = rotateEffects(staged, biometric);
  const res = await rotate(fx, {
    user: USER,
    ca: USER,
    repoRoot: sb.repoRoot,
    home: sb.home,
    hostname: HOST,
    ports: overrides.ports ?? ROTATE_PORTS,
    dryRun: false,
    confirm: true,
    biometricAuth: biometric,
    ...(overrides.rotationTag !== undefined ? { rotationTag: overrides.rotationTag } : {}),
  });
  return { res, prompts, staged };
}

/** Extract a public key's SHA256 fingerprint via real ssh-keygen (contained — operates on temp files). */
function pubFingerprint(pubPath: string): string {
  const r = spawnSync("ssh-keygen", ["-l", "-f", pubPath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  const m = /SHA256:\S+/.exec(r.stdout);
  expect(m).not.toBeNull();
  return m![0];
}

/** Extract a cert's "Signing CA" SHA256 fingerprint via real ssh-keygen -L (contained). */
function certSigningCaFingerprint(certFilePath: string): string {
  const r = spawnSync("ssh-keygen", ["-L", "-f", certFilePath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  const m = /Signing CA:\s+\S+\s+(SHA256:\S+)/.exec(r.stdout);
  expect(m).not.toBeNull();
  return m![1]!;
}

/** Extract a cert's Key ID + Principals via real ssh-keygen -L (for the N+M invariant check). */
function certIdentity(certFilePath: string): { keyId: string; principals: string[] } {
  const r = spawnSync("ssh-keygen", ["-L", "-f", certFilePath], { encoding: "utf8" });
  expect(r.status).toBe(0);
  const idM = /Key ID:\s+"([^"]*)"/.exec(r.stdout);
  const principals: string[] = [];
  const pIdx = r.stdout.indexOf("Principals:");
  if (pIdx >= 0) {
    const after = r.stdout.slice(pIdx).split("\n").slice(1);
    for (const line of after) {
      const t = line.trim();
      // Principal lines are bare usernames (no colon); a new section ("Critical Options:",
      // "Extensions:", "Valid:") carries a colon → stop.
      if (t.length === 0 || t.includes(":")) break;
      principals.push(t);
    }
  }
  return { keyId: idM ? idM[1]! : "", principals };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DRY-RUN is default-safe: reports a plan, touches NOTHING, NEVER prompts.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("DRY-RUN: reports a plan for every set-up port, touches nothing, no prompt", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const prompts: string[] = [];
    const staged: { repoRoot: string; relPath: string }[] = [];
    const fx = rotateEffects(staged, fakeBiometric(prompts));
    const res = await rotate(fx, {
      user: USER,
      ca: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      dryRun: true, // explicit default-safe
      biometricAuth: fakeBiometric(prompts),
    });
    expect(res.dryRun).toBe(true);
    expect(prompts.length).toBe(0); // dry-run NEVER prompts
    expect(staged.length).toBe(0); // dry-run touches nothing
    // Every set-up port is reported "would-rotate".
    for (const port of ROTATE_PORTS) {
      const r = res.rotations.find((x) => x.port === port);
      expect(r?.action).toBe("would-rotate");
    }
    // No standby was minted (nothing generated on a dry-run).
    expect(existsSync(standbyMachineKeyPath(sb.home))).toBe(false);
    expect(existsSync(standbyCaKeyPath(sb.home))).toBe(false);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// REAL RUN, NOT CONFIRMED: every present port is skipped-not-confirmed, NEVER prompts.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("NOT CONFIRMED (no --confirm on a real run): skips every port, never prompts", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const prompts: string[] = [];
    const staged: { repoRoot: string; relPath: string }[] = [];
    const fx = rotateEffects(staged, fakeBiometric(prompts));
    const res = await rotate(fx, {
      user: USER,
      ca: USER,
      repoRoot: sb.repoRoot,
      home: sb.home,
      hostname: HOST,
      dryRun: false,
      confirm: false, // real run but NOT confirmed
      biometricAuth: fakeBiometric(prompts),
    });
    expect(prompts.length).toBe(0);
    expect(staged.length).toBe(0);
    for (const port of ROTATE_PORTS) {
      expect(res.rotations.find((x) => x.port === port)?.action).toBe("skipped-not-confirmed");
    }
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED: a declined biometric ⇒ NOTHING rotated, NOTHING staged.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("FAIL-CLOSED: declined biometric rotates nothing, stages nothing", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const { res, prompts, staged } = await runRotate(sb, { decline: true });
    expect(prompts.length).toBe(1); // the one gate fired (and was declined)
    expect(res.biometric?.ok).toBe(false);
    expect(staged.length).toBe(0);
    for (const port of ROTATE_PORTS) {
      expect(res.rotations.find((x) => x.port === port)?.action).toBe("skipped-biometric");
    }
    // No standby minted, original keys intact.
    expect(existsSync(standbyMachineKeyPath(sb.home))).toBe(false);
    expect(existsSync(deviceKeyPath(sb.home))).toBe(true);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MACHINE-KEY rotate: new key promoted to Active, old retired, one fingerprint, pubkey staged.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("MACHINE-KEY: rotate promotes a new key to Active, retires the old, stages the new pubkey", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const oldDevFp = pubFingerprint(deviceKeyPath(sb.home) + ".pub");

    const { res, prompts, staged } = await runRotate(sb, { ports: ["machine-key"] });
    expect(prompts.length).toBe(1); // one fingerprint
    const r = res.rotations.find((x) => x.port === "machine-key");
    expect(r?.action).toBe("rotated");

    // New Active key is DIFFERENT from the old (a genuine fresh key).
    const newDevFp = pubFingerprint(deviceKeyPath(sb.home) + ".pub");
    expect(newDevFp).not.toBe(oldDevFp);
    // Old key is parked retired (overlap → wiped after the window).
    expect(existsSync(retiredMachineKeyPath(sb.home))).toBe(true);
    expect(pubFingerprint(retiredMachineKeyPath(sb.home) + ".pub")).toBe(oldDevFp);
    // The updated registered pubkey was staged for a PR, contained under the sandbox repoRoot.
    expect(staged.some((s) => s.relPath === join("machines", `${HOST}.pub`))).toBe(true);
    expect(staged.every((s) => s.repoRoot === sb.repoRoot)).toBe(true);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// DEVICE-CERT rotate: re-signs the cert, N+M preserved (Key ID=machine, principals=[user]).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("DEVICE-CERT: re-sign preserves N+M (Key ID = machine-only, principal = user)", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    expect(existsSync(certFile)).toBe(true);

    const { res, prompts, staged } = await runRotate(sb, { ports: ["device-cert"] });
    expect(prompts.length).toBe(1);
    expect(res.rotations.find((x) => x.port === "device-cert")?.action).toBe("rotated");

    // N+M invariant on the RE-SIGNED cert (read back via real ssh-keygen -L).
    const id = certIdentity(certFile);
    expect(id.keyId).toBe(HOST); // machine-only Key ID
    expect(id.keyId).not.toContain("@"); // never user@machine
    expect(id.principals).toEqual([USER]); // user in the principal
    expect(staged.some((s) => s.relPath === join("machines", `${HOST}-cert.pub`))).toBe(true);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CA-KEY rotate + ∅-BLAST-RADIUS: a cert signed by the OLD CA still verifies after CA rotation,
// because BOTH CA pubkeys stay in the trusted set during the overlap.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CA-KEY + ∅-BLAST-RADIUS: existing cert still trusted after CA rotation (overlap keeps both CA pubkeys)", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    // The cert that exists BEFORE the CA rotation — the "thing protected" we must not break.
    const certFile = certPath(machinePubPath(sb.repoRoot, HOST));
    const protectedCertSigningCa = certSigningCaFingerprint(certFile);
    const oldCaFp = pubFingerprint(caPublicKeyPath(sb.repoRoot, USER));
    // Sanity: the existing cert was signed by the current CA.
    expect(protectedCertSigningCa).toBe(oldCaFp);

    const { res, prompts, staged } = await runRotate(sb, { ports: ["ca-key"] });
    expect(prompts.length).toBe(1); // one fingerprint
    expect(res.rotations.find((x) => x.port === "ca-key")?.action).toBe("rotated");

    // The new CA is Active + DIFFERENT from the old.
    const newCaFp = pubFingerprint(caPrivateKeyPath(sb.home) + ".pub");
    expect(newCaFp).not.toBe(oldCaFp);

    // ∅-BLAST-RADIUS: the trusted-CA-keys file holds BOTH the old and new CA pubkeys during overlap,
    // so the EXISTING cert (signed by the OLD CA) STILL verifies — nothing it protected broke.
    const trustFile = readFileSync(trustedUserCaKeysPath(sb.repoRoot, USER), "utf8");
    const trustedFps = trustFile
      .split("\n")
      .filter((l) => l.trim().length > 0 && !l.trimStart().startsWith("#"))
      .map((line) => fingerprintOfPubLine(line, sb));
    expect(trustedFps).toContain(oldCaFp); // OLD CA still trusted (the overlap)
    expect(trustedFps).toContain(newCaFp); // NEW CA trusted (signs going forward)
    // THE KEY ASSERTION: the protected cert's signing CA is STILL in the trusted set after rotation.
    expect(trustedFps).toContain(protectedCertSigningCa);

    // The trusted-CA-keys file + updated ssh-ca.pub were staged for a PR (contained).
    expect(staged.some((s) => s.relPath.endsWith("trusted-user-ca-keys.pub"))).toBe(true);
    assertContained(sb, ...staged.map((s) => join(s.repoRoot, s.relPath)));
  } finally {
    sb.cleanup();
  }
});

/** Compute the fingerprint of a single SSH pubkey LINE by writing it to a temp file under the
 *  sandbox + running real ssh-keygen -l (contained). */
function fingerprintOfPubLine(line: string, sb: Sandbox): string {
  const tmp = join(sb.home, ".fp-probe.pub");
  writeFileSync(tmp, line.trim() + "\n");
  const fp = pubFingerprint(tmp);
  rmSync(tmp, { force: true });
  return fp;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// IDEMPOTENT-AWARE: re-running mid-overlap RESUMES the same overlap (no second standby minted).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("IDEMPOTENT: re-run mid-overlap resumes (does not mint a second standby)", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    // First rotate machine-key, but leave a standby behind to simulate a mid-overlap state: we mint
    // a standby manually (the genEd25519 door) then run rotate, which should NOT re-mint it.
    const fx = rotateEffects([], fakeBiometric([]));
    fx.mkdirp(dirname(standbyMachineKeyPath(sb.home)));
    fx.genEd25519(standbyMachineKeyPath(sb.home), `${HOST} (zeta-machine)`);
    const stagedStandbyFp = pubFingerprint(standbyMachineKeyPath(sb.home) + ".pub");

    const { res } = await runRotate(sb, { ports: ["machine-key"] });
    const r = res.rotations.find((x) => x.port === "machine-key");
    expect(r?.action).toBe("in-overlap"); // resumed, not re-minted

    // The promoted Active is the SAME standby we pre-staged (not a fresh second one).
    const newActiveFp = pubFingerprint(deviceKeyPath(sb.home) + ".pub");
    expect(newActiveFp).toBe(stagedStandbyFp);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CLEAN NO-OP: rotate on an unprovisioned sandbox is an idempotent no-op (no prompt).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("CLEAN NO-OP: rotate with nothing set up is a no-op, no prompt", async () => {
  const sb = makeSandbox();
  try {
    const { res, prompts, staged } = await runRotate(sb);
    expect(res.hadWork).toBe(false);
    expect(prompts.length).toBe(0); // nothing to rotate ⇒ no approval needed
    expect(staged.length).toBe(0);
    for (const port of ROTATE_PORTS) {
      expect(res.rotations.find((x) => x.port === port)?.action).toBe("absent");
    }
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// NO SECRET BYTES: the public result never carries private-key material.
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("NO SECRET BYTES: the rotate result carries no private-key material", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const { res } = await runRotate(sb);
    expect(JSON.stringify(res)).not.toContain(PRIV_MARKER);
  } finally {
    sb.cleanup();
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SANDBOX-ONLY meta-assertion: every path the rotate touched is under the temp root (never real).
// ══════════════════════════════════════════════════════════════════════════════════════════════
test("SANDBOX-ONLY: all rotated/staged paths live strictly under the temp root (never real state)", async () => {
  const sb = makeSandbox();
  try {
    await provision(sb);
    const { res, staged } = await runRotate(sb);
    for (const r of res.rotations) {
      assertContained(sb, r.newArtifactPath, r.retiredArtifactPath);
    }
    assertContained(sb, ...staged.map((s) => join(s.repoRoot, s.relPath)));
    // The real default paths are NOT under our sandbox (we never used them).
    expect(deviceKeyPath().startsWith(sb.home)).toBe(false);
    expect(caPrivateKeyPath().startsWith(sb.home)).toBe(false);
  } finally {
    sb.cleanup();
  }
});
