// ca-shamir-custody.ts — Shamir split/combine for LOCAL CA private keys (081KVP3GYW1 custody slice).
// ALL tests run in throwaway temp dirs; biometric is FAKE; nothing touches real ~/.config/zeta.
// Run: bun test ca-shamir-custody.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { caPrivateKeyPath, ensureCa, realEffects as caRealFx } from "./ca.ts";
import type { BiometricAuth, BiometricResult } from "./biometric.ts";
import {
  caShamirSharesDir,
  combineSharesToCa,
  decodeShareFile,
  parseShamirSpec,
  shareFilePath,
  splitCaToShares,
  type CaShamirCustodyEffects,
} from "./ca-shamir-custody.ts";

const PRIV_MARKER = "PRIVATE" + " " + "KEY";
const CA = "custody-tester";

function fakeBiometric(ok: boolean, calls?: string[]): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    if (calls) calls.push(prompt);
    return ok
      ? { ok: true, platform: "macos-touchid" }
      : { ok: false, platform: "macos-touchid", reason: "declined" };
  };
}

function makeSandbox(): { home: string; repoRoot: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), "zeta-shamir-home-"));
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-shamir-repo-"));
  return {
    home,
    repoRoot,
    cleanup: () => {
      rmSync(home, { recursive: true, force: true });
      rmSync(repoRoot, { recursive: true, force: true });
    },
  };
}

function custodyFx(): CaShamirCustodyEffects {
  return {
    exists: (p) => existsSync(p),
    readBytes: (p) => new Uint8Array(readFileSync(p)),
    writeText: (p, c, mode = 0o600) => {
      mkdirSync(join(p, ".."), { recursive: true, mode: 0o700 });
      writeFileSync(p, c, { mode, encoding: "utf8" });
    },
    mkdirp: (p) => mkdirSync(p, { recursive: true, mode: 0o700 }),
  };
}

async function genRealCa(home: string, repoRoot: string): Promise<void> {
  const prompts: string[] = [];
  const r = await ensureCa(caRealFx(), {
    ca: CA,
    repoRoot,
    home,
    dryRun: false,
    biometricAuth: fakeBiometric(true, prompts),
  });
  expect(r.action).toBe("generated");
  expect(existsSync(caPrivateKeyPath(home))).toBe(true);
}

test("parseShamirSpec accepts k-of-n", () => {
  expect(parseShamirSpec("2-of-3")).toEqual({ threshold: 2, shares: 3 });
  expect(() => parseShamirSpec("bad")).toThrow(/invalid spec/);
});

test("split dry-run: would-split, no share files, no biometric", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    const prompts: string[] = [];
    const fx = custodyFx();
    const sharesDir = caShamirSharesDir(sb.home, CA);
    const res = await splitCaToShares(fx, {
      ca: CA,
      home: sb.home,
      shamir: "2-of-3",
      dryRun: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(res.action).toBe("skipped-not-confirmed");
    expect(prompts.length).toBe(0);
    expect(existsSync(sharesDir)).toBe(false);
  } finally {
    sb.cleanup();
  }
});

test("split confirm: writes n share files; k subset reconstructs original private key", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    const caPriv = caPrivateKeyPath(sb.home);
    const original = readFileSync(caPriv);
    const prompts: string[] = [];
    const fx = custodyFx();

    const split = await splitCaToShares(fx, {
      ca: CA,
      home: sb.home,
      shamir: "2-of-4",
      confirm: true,
      biometricAuth: fakeBiometric(true, prompts),
    });
    expect(split.action).toBe("split");
    expect(prompts.length).toBe(1);
    const sharesDir = caShamirSharesDir(sb.home, CA);
    for (let x = 1; x <= 4; x++) {
      expect(existsSync(shareFilePath(sharesDir, x))).toBe(true);
    }

    const recoveredPath = join(sb.home, "recovered", "ssh_ca_ed25519");
    const combinePrompts: string[] = [];
    const combined = await combineSharesToCa(fx, {
      ca: CA,
      home: sb.home,
      threshold: 2,
      shareIndices: [1, 3],
      outputPrivateKeyPath: recoveredPath,
      confirm: true,
      biometricAuth: fakeBiometric(true, combinePrompts),
    });
    expect(combined.action).toBe("combined");
    expect(readFileSync(recoveredPath).equals(original)).toBe(true);

    // ssh-keygen accepts the reconstructed key (public half readable).
    const pubCheck = spawnSync("ssh-keygen", ["-y", "-f", recoveredPath], { encoding: "utf8" });
    expect(pubCheck.status).toBe(0);
    expect(pubCheck.stdout).toMatch(/^ssh-ed25519 /);
  } finally {
    sb.cleanup();
  }
});

test("split fail-closed: declined biometric writes nothing", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    const fx = custodyFx();
    const res = await splitCaToShares(fx, {
      ca: CA,
      home: sb.home,
      shamir: "2-of-3",
      confirm: true,
      biometricAuth: fakeBiometric(false),
    });
    expect(res.action).toBe("skipped-biometric");
    expect(existsSync(caShamirSharesDir(sb.home, CA))).toBe(false);
  } finally {
    sb.cleanup();
  }
});

test("combine insufficient shares: fail without writing output key", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    const fx = custodyFx();
    await splitCaToShares(fx, {
      ca: CA,
      home: sb.home,
      shamir: "3-of-5",
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    const out = join(sb.home, "should-not-exist", "key");
    const res = await combineSharesToCa(fx, {
      ca: CA,
      home: sb.home,
      threshold: 3,
      shareIndices: [1, 2],
      outputPrivateKeyPath: out,
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    expect(res.action).toBe("insufficient-shares");
    expect(existsSync(out)).toBe(false);
  } finally {
    sb.cleanup();
  }
});

test("formatters and decodeShareFile never emit private key marker", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    const fx = custodyFx();
    const split = await splitCaToShares(fx, {
      ca: CA,
      home: sb.home,
      shamir: "2-of-3",
      confirm: true,
      biometricAuth: fakeBiometric(true),
    });
    const { formatSplitCaShamir, formatCombineCaShamir } = await import("./ca-shamir-custody.ts");
    const splitText = formatSplitCaShamir(split);
    expect(splitText).not.toMatch(new RegExp(PRIV_MARKER));
    const shareText = readFileSync(split.sharePaths[0]!, "utf8");
    const decoded = decodeShareFile(shareText);
    expect(decoded.threshold).toBe(2);
    expect(JSON.stringify(decoded)).not.toMatch(new RegExp(PRIV_MARKER));
    const combineDry = await combineSharesToCa(fx, {
      ca: CA,
      home: sb.home,
      threshold: 2,
      dryRun: true,
    });
    const combineText = formatCombineCaShamir(combineDry);
    expect(combineText).not.toMatch(new RegExp(PRIV_MARKER));
  } finally {
    sb.cleanup();
  }
});

test("SAFETY: paths stay under sandbox temp root", async () => {
  const sb = makeSandbox();
  try {
    await genRealCa(sb.home, sb.repoRoot);
    expect(caPrivateKeyPath(sb.home).startsWith(tmpdir())).toBe(true);
    expect(caPrivateKeyPath().startsWith(sb.home)).toBe(false);
  } finally {
    sb.cleanup();
  }
});
