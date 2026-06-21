// machine.ts conformance — the two-part (user × machine) presence check + the gated
// device-key generation. ALL tests run against a THROWAWAY temp dir via injected
// effects (or mktemp -d for the real-ssh-keygen path) — NEVER real ~/.ssh, NEVER real
// maintainer paths, NEVER committing a generated key. Conformance/structure only.
// Run: bun test machine.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPresence, ensureMachineKey, formatStatus, publishPubPath, sanitizeHostname, userKeyringPublicPath, } from "./machine.js";
// A FAKE biometric door (no real Touch ID / Hello). `ok` controls approval; a `calls` array
// records every prompt so a test can assert the gate WAS invoked + fail-closed semantics.
function fakeBiometric(ok, calls) {
    return async (prompt) => {
        if (calls)
            calls.push(prompt);
        return ok
            ? { ok: true, platform: "macos-touchid" }
            : { ok: false, platform: "macos-touchid", reason: "declined" };
    };
}
// A passing approval, the default for the happy-path tests below.
const APPROVE = fakeBiometric(true);
// A fully in-memory-ish fake: deterministic fake key generation, real temp filesystem
// for the public-artifact writes. The fake NEVER shells out and NEVER touches secrets.
function fakeEffects(host, opts) {
    return {
        hostname: () => host,
        exists: (p) => existsSync(p),
        readText: (p) => readFileSync(p, "utf8"),
        writeText: (p, c) => writeFileSync(p, c),
        mkdirp: (p) => mkdirSync(p, { recursive: true }),
        genEd25519: (keyPath, comment) => {
            if (opts?.genCount)
                opts.genCount.n += 1;
            // Simulate ssh-keygen: write a (fake) private + public file locally.
            mkdirSync(keyPath.slice(0, keyPath.lastIndexOf("/")), { recursive: true });
            writeFileSync(keyPath, "FAKE-PRIVATE-DO-NOT-USE\n", { mode: 0o600 });
            const pub = `ssh-ed25519 AAAAFAKEPUBKEY ${comment}\n`;
            writeFileSync(keyPath + ".pub", pub);
            return pub;
        },
    };
}
test("status: both absent -> userKeyPresent=n, machine key present=n (READ-ONLY, generates nothing)", () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const fx = fakeEffects("dev-box-1");
        const s = checkPresence(fx, { user: "tester", repoRoot: tmp, home: tmp });
        expect(s.userKeyPresent).toBe(false);
        expect(s.machineKeyPresentLocal).toBe(false);
        expect(s.machineKeyPublished).toBe(false);
        expect(formatStatus(s)).toContain("user=tester present=n");
        expect(formatStatus(s)).toContain("machine=dev-box-1 key present=n");
        // pure inspection: no files were created
        expect(existsSync(s.devicePrivatePath)).toBe(false);
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("status: detects an existing user keyring + machine key independently (two-axis)", () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        // user key present, machine key NOT (the common 'new flasher box' case from the workitem)
        mkdirSync(join(tmp, "maintainers", "tester"), { recursive: true });
        writeFileSync(userKeyringPublicPath(tmp, "tester"), JSON.stringify({ user: "tester" }));
        const fx = fakeEffects("dev-box-2");
        const s = checkPresence(fx, { user: "tester", repoRoot: tmp, home: tmp });
        expect(s.userKeyPresent).toBe(true);
        expect(s.machineKeyPresentLocal).toBe(false); // independent: user set up, this machine not
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("--dry-run generates NOTHING and reports would-generate (and never prompts)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const genCount = { n: 0 };
        const prompts = [];
        const fx = fakeEffects("dev-box-3", { genCount });
        const r = await ensureMachineKey(fx, {
            user: "tester",
            repoRoot: tmp,
            home: tmp,
            dryRun: true,
            publish: true,
            biometricAuth: fakeBiometric(true, prompts),
        });
        expect(r.dryRun).toBe(true);
        expect(r.action).toBe("would-generate");
        expect(r.published).toBe(false);
        expect(genCount.n).toBe(0); // nothing generated
        expect(prompts).toHaveLength(0); // dry-run NEVER prompts
        expect(existsSync(r.devicePrivatePath)).toBe(false); // nothing written
        expect(existsSync(r.devicePublicPath)).toBe(false);
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("machine: generates a device key (fake) and publishes ONLY the public half; private never published", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const fx = fakeEffects("dev-box-4");
        const r = await ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp, publish: true, biometricAuth: APPROVE });
        expect(r.action).toBe("generated");
        expect(r.published).toBe(true);
        // the PUBLISH path holds ONLY the public key — no private bytes anywhere in it
        const publishedPath = publishPubPath(tmp, "tester", "dev-box-4");
        expect(existsSync(publishedPath)).toBe(true);
        const published = readFileSync(publishedPath, "utf8");
        expect(published).toContain("ssh-ed25519");
        expect(published).not.toContain("PRIVATE");
        // The marker is assembled at runtime so NO key-shaped header literal appears in this file.
        expect(published).not.toMatch(new RegExp("BEGIN .*" + "PRIVATE" + " " + "KEY"));
        // the private key file stays at the LOCAL path, NOT under maintainers/
        expect(r.devicePrivatePath.includes("maintainers")).toBe(false);
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("machine: idempotent — a second run is a no-op ('exists'), does not regenerate", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const genCount = { n: 0 };
        const secondPrompts = [];
        const fx = fakeEffects("dev-box-5", { genCount });
        const first = await ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp, biometricAuth: APPROVE });
        expect(first.action).toBe("generated");
        expect(genCount.n).toBe(1);
        const second = await ensureMachineKey(fx, {
            user: "tester",
            repoRoot: tmp,
            home: tmp,
            biometricAuth: fakeBiometric(true, secondPrompts),
        });
        expect(second.action).toBe("exists"); // idempotent: apply-N == apply-once effect
        expect(genCount.n).toBe(1); // NOT regenerated
        expect(secondPrompts).toHaveLength(0); // the idempotent no-op does NOT prompt (no keygen)
        expect(second.publicKey).toBe(first.publicKey); // same public key returned
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("FAIL-CLOSED: biometric declined -> genEd25519 NEVER called, NO key, aborted-biometric", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const genCount = { n: 0 };
        const prompts = [];
        const fx = fakeEffects("dev-box-deny", { genCount });
        const r = await ensureMachineKey(fx, {
            user: "tester",
            repoRoot: tmp,
            home: tmp,
            publish: true,
            biometricAuth: fakeBiometric(false, prompts),
        });
        expect(r.action).toBe("aborted-biometric");
        expect(prompts).toHaveLength(1); // the gate WAS invoked
        expect(genCount.n).toBe(0); // the keygen door was NEVER called
        expect(r.published).toBe(false);
        expect(existsSync(r.devicePrivatePath)).toBe(false); // nothing written
        expect(existsSync(r.devicePublicPath)).toBe(false); // no public artifact either
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("FAIL-CLOSED: NO biometric door provided -> keygen NEVER runs (default fail-closed)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-"));
    try {
        const genCount = { n: 0 };
        const fx = fakeEffects("dev-box-nodoor", { genCount });
        // No biometricAuth wired at all — requireBiometric returns ok:false (fail-closed).
        const r = await ensureMachineKey(fx, { user: "tester", repoRoot: tmp, home: tmp });
        expect(r.action).toBe("aborted-biometric");
        expect(genCount.n).toBe(0); // never generated without an approval door
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
test("sanitizeHostname: filesystem-safe, ordinal-stable, never empty", () => {
    expect(sanitizeHostname("Dev Box!.local")).toBe("dev-box-.local");
    expect(sanitizeHostname("  ")).toBe("unknown-host");
    expect(sanitizeHostname("aaron-MBP")).toBe("aaron-mbp");
});
// REAL ssh-keygen, but ONLY into a throwaway temp dir (never ~/.ssh, never committed).
// Proves the production seam actually produces a valid ed25519 pubkey and that the
// private key never leaves the local temp path. Skips cleanly if ssh-keygen absent.
test("real ssh-keygen into a temp dir produces a valid ed25519 pubkey, private stays local", async () => {
    const probe = spawnSync("ssh-keygen", ["-A", "-?"], { encoding: "utf8" });
    const haveSshKeygen = probe.error === undefined;
    if (!haveSshKeygen) {
        return; // environment without ssh-keygen — conformance covered by the fake-effects tests
    }
    const tmp = mkdtempSync(join(tmpdir(), "zeta-machine-real-"));
    try {
        const { realEffects, ensureMachineKey: ensure, deviceKeyPath } = await import("./machine.js");
        const fx = realEffects();
        // pin HOME to the temp dir so the REAL device path resolves inside temp, never ~/.ssh.
        // A FAKE biometric (approve) so this test never needs a real Touch ID prompt — the gate
        // is exercised against the fake; the keygen itself is the real ssh-keygen.
        const r = await ensure(fx, { user: "tester", repoRoot: tmp, home: tmp, publish: true, biometricAuth: APPROVE });
        expect(r.action).toBe("generated");
        const priv = deviceKeyPath(tmp);
        expect(priv.startsWith(tmp)).toBe(true); // private key is inside the temp dir
        expect(existsSync(priv)).toBe(true);
        expect(existsSync(priv + ".pub")).toBe(true);
        // private key is not group/other readable (umask 077 honored by ssh-keygen)
        const mode = statSync(priv).mode & 0o077;
        expect(mode).toBe(0);
        // published artifact is the PUBLIC key only
        const published = readFileSync(publishPubPath(tmp, "tester", fx.hostname()), "utf8");
        expect(published).toContain("ssh-ed25519");
        expect(published).not.toMatch(/PRIVATE/);
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
