/**
 * Falsifiers for the ephemeral Vault init ceremony.
 *
 * The claim this file has to be able to REFUTE is "the minted key material does
 * not persist". A test that only walks the happy path and sees no keys proves
 * nothing -- so the central pair here is:
 *
 *   * `does not leak ... into the report or the log` -- the property; and
 *   * `leak scan FIRES when material is planted` -- the proof that the check
 *     above is capable of failing at all.
 *
 * Without the second, the first is the vacuity class: a scan that can never go
 * red reporting that it did not go red.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EPHEMERAL_KEY_SHARES,
  EPHEMERAL_KEY_THRESHOLD,
  REDACTION,
  ephemeralVaultInitGate,
  parseInitOutput,
  redact,
  runEphemeralVaultInit,
  scanForKeyMaterial,
  type CommandResult,
  type GateVerdict,
  type StdinMode,
  type VaultExec,
} from "./ephemeral-vault-init.ts";
import { parseArgs } from "./argocd-health-test.ts";

/** Distinctive enough that a substring match cannot be a coincidence. */
const SENTINEL_KEYS = [
  "SENTINELunsealSHAREoneAAAAAAAAAAAAAAAAAAAAAAAA=",
  "SENTINELunsealSHAREtwoBBBBBBBBBBBBBBBBBBBBBBBB=",
  "SENTINELunsealSHAREthreeCCCCCCCCCCCCCCCCCCCCCC=",
  "SENTINELunsealSHAREfourDDDDDDDDDDDDDDDDDDDDDDD=",
  "SENTINELunsealSHAREfiveEEEEEEEEEEEEEEEEEEEEEEE=",
];
const SENTINEL_ROOT = "hvs.SENTINELrootTOKENffffffffffff";

const INIT_JSON = JSON.stringify({
  unseal_keys_b64: SENTINEL_KEYS,
  unseal_keys_hex: SENTINEL_KEYS.map((key) => `hex-${key}`),
  root_token: SENTINEL_ROOT,
});

const ALLOWED: GateVerdict = { allowed: true, reason: "test" };

interface Call {
  readonly args: readonly string[];
  readonly stdin: string | undefined;
  readonly mode: StdinMode | undefined;
}

/** Scripted Vault, sealed until unsealed threshold-many times. */
function fakeVault(overrides: Partial<Record<string, CommandResult>> = {}): {
  readonly exec: VaultExec;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  let unsealCount = 0;
  const exec: VaultExec = (args, stdin, mode) => {
    calls.push({ args, stdin, mode });
    const key = args.join(" ");
    const override = overrides[key];
    if (override !== undefined) return override;
    if (key === "status -format=json") {
      return unsealCount >= EPHEMERAL_KEY_THRESHOLD
        ? { status: 0, stdout: '{"sealed":false}', stderr: "" }
        : { status: 2, stdout: '{"sealed":true}', stderr: "" };
    }
    if (key.startsWith("operator init")) return { status: 0, stdout: INIT_JSON, stderr: "" };
    if (key === "operator unseal") {
      unsealCount += 1;
      return { status: 0, stdout: '{"sealed":true}', stderr: "" };
    }
    if (key === "token revoke -self") return { status: 0, stdout: "Success!", stderr: "" };
    return { status: 1, stdout: "", stderr: `unscripted: ${key}` };
  };
  return { exec, calls };
}

function emptyScanDeps(logs: string[]): {
  readonly scanRoots: readonly string[];
  readonly podLogs: string;
  readonly transcript: string;
  readonly log: (line: string) => void;
} {
  return {
    scanRoots: [],
    podLogs: "vault-0 started, sealed",
    transcript: "harness transcript with no material in it",
    log: (line) => logs.push(line),
  };
}

describe("ephemeralVaultInitGate -- fail-closed, and it names WHICH property was missing", () => {
  const base = { existingCluster: false, provider: "kind", requested: true, teardownGuaranteed: true };

  test("allows the CI shape", () => {
    const verdict = ephemeralVaultInitGate(base);
    expect(verdict.allowed).toBe(true);
  });

  test("REFUSES --existing: that is the metal case wearing the harness's clothes", () => {
    const verdict = ephemeralVaultInitGate({ ...base, existingCluster: true });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("--existing");
    expect(verdict.reason).toContain("TOPOLOGY.md section 5");
  });

  test("refuses when not explicitly requested -- never defaulted on", () => {
    expect(ephemeralVaultInitGate({ ...base, requested: false }).allowed).toBe(false);
  });

  test("refuses a provider that is not a local disposable cluster", () => {
    const verdict = ephemeralVaultInitGate({ ...base, provider: "eks" });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("eks");
  });

  test("refuses when teardown is not guaranteed", () => {
    expect(ephemeralVaultInitGate({ ...base, teardownGuaranteed: false }).allowed).toBe(false);
  });

  test("every refusal path is reachable -- four distinct reasons, no shared fallthrough", () => {
    const reasons = new Set([
      ephemeralVaultInitGate({ ...base, requested: false }).reason,
      ephemeralVaultInitGate({ ...base, existingCluster: true }).reason,
      ephemeralVaultInitGate({ ...base, provider: "eks" }).reason,
      ephemeralVaultInitGate({ ...base, teardownGuaranteed: false }).reason,
    ]);
    expect(reasons.size).toBe(4);
  });
});

describe("the CLI refuses the dangerous combination before the gate ever runs", () => {
  test("--ephemeral-vault-init + --existing is a usage error", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--existing", "--ephemeral-vault-init"], {});
    expect("kind" in parsed).toBe(true);
    expect(JSON.stringify(parsed)).toContain("--existing");
  });

  test("--ephemeral-vault-init requires --run", () => {
    const parsed = parseArgs(["--dry-run", "--provider", "kind", "--ephemeral-vault-init"], {});
    expect("kind" in parsed).toBe(true);
  });

  test("the flag is OFF unless passed", () => {
    const parsed = parseArgs(["--run", "--provider", "kind"], {});
    expect("kind" in parsed).toBe(false);
    expect((parsed as { ephemeralVaultInit: boolean }).ephemeralVaultInit).toBe(false);
  });

  test("the flag is ON when passed", () => {
    const parsed = parseArgs(["--run", "--provider", "kind", "--ephemeral-vault-init"], {});
    expect((parsed as { ephemeralVaultInit: boolean }).ephemeralVaultInit).toBe(true);
  });
});

describe("the ceremony follows TOPOLOGY.md section 5's shape", () => {
  test("reads status BEFORE init, unseals exactly threshold-many, then revokes the root token", async () => {
    const logs: string[] = [];
    const { exec, calls } = fakeVault();
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps(logs) });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const sequence = calls.map((call) => call.args.join(" "));
    expect(sequence[0]).toBe("status -format=json");
    // The stdin probe sits between the sealed check and init, and its position
    // is the whole point of it -- see the ordering test below.
    expect(sequence[2]).toContain("operator init");
    expect(sequence.filter((entry) => entry === "operator unseal").length).toBe(EPHEMERAL_KEY_THRESHOLD);
    expect(sequence.at(-1)).toBe("token revoke -self");
    expect(outcome.report.statusExitBeforeInit).toBe(2);
    expect(outcome.report.sealedAfterUnseal).toBe(false);
    expect(outcome.report.rootTokenRevoked).toBe(true);
    expect(outcome.report.unsealOperations).toBe(EPHEMERAL_KEY_THRESHOLD);
  });

  test("the stdin channel is PROVEN before `operator init` mints anything", async () => {
    // Regression guard for the first live run: unseal #1 received an EMPTY key
    // (`'key' must be a valid hex or base64 string`) -- and by then init had
    // already minted the shares. Material existed, nothing could consume it, and
    // the run died holding it. The probe must therefore come BEFORE init, not
    // merely exist.
    const { exec, calls } = fakeVault();
    await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    const probeIndex = calls.findIndex((call) => call.stdin !== undefined && call.args[0] === "status");
    const initIndex = calls.findIndex((call) => call.args[1] === "init");
    expect(probeIndex).toBeGreaterThanOrEqual(0);
    expect(initIndex).toBeGreaterThanOrEqual(0);
    expect(probeIndex).toBeLessThan(initIndex);
    // The probe value is a fixed non-secret sentinel, never a key.
    const probe = calls[probeIndex];
    expect(probe?.stdin).not.toBe(SENTINEL_ROOT);
    expect(SENTINEL_KEYS).not.toContain(probe?.stdin ?? "");
  });

  test("a broken stdin channel is refused BEFORE any material is minted", async () => {
    let seenInit = false;
    const exec: VaultExec = (args, stdin) => {
      const key = args.join(" ");
      if (key.startsWith("operator init")) seenInit = true;
      // Sealed on the plain status call; the probe (stdin present) errors.
      if (key === "status -format=json") {
        return stdin === undefined
          ? { status: 2, stdout: '{"sealed":true}', stderr: "" }
          : { status: 1, stdout: "", stderr: "error: unable to upgrade connection" };
      }
      return { status: 0, stdout: INIT_JSON, stderr: "" };
    };
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.step).toBe("stdin-probe");
    expect(seenInit).toBe(false);
  });

  test("init is asked for the agreed share count and threshold", async () => {
    const { exec, calls } = fakeVault();
    await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    const init = calls.find((call) => call.args[0] === "operator" && call.args[1] === "init");
    expect(init?.args).toContain(`-key-shares=${String(EPHEMERAL_KEY_SHARES)}`);
    expect(init?.args).toContain(`-key-threshold=${String(EPHEMERAL_KEY_THRESHOLD)}`);
  });

  test("REFUSES to proceed from status exit 0 -- an already-unsealed Vault is not a state to init from", async () => {
    const { exec } = fakeVault({ "status -format=json": { status: 0, stdout: "{}", stderr: "" } });
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.step).toBe("assert-sealed");
  });

  test("REFUSES to proceed from status exit 1 -- error is not sealed", async () => {
    const { exec, calls } = fakeVault({ "status -format=json": { status: 1, stdout: "", stderr: "boom" } });
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(false);
    expect(calls.some((call) => call.args[1] === "init")).toBe(false);
  });

  test("a refused gate runs no command at all", async () => {
    const { exec, calls } = fakeVault();
    const outcome = await runEphemeralVaultInit({
      exec,
      gate: { allowed: false, reason: "refused for the test" },
      ...emptyScanDeps([]),
    });
    expect(outcome.ok).toBe(false);
    expect(calls.length).toBe(0);
  });
});

describe("key material never reaches a surface anything can read", () => {
  test("the unseal share travels on STDIN, never in argv", async () => {
    const { exec, calls } = fakeVault();
    await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    for (const call of calls) {
      for (const arg of call.args) {
        for (const key of SENTINEL_KEYS) expect(arg).not.toContain(key);
        expect(arg).not.toContain(SENTINEL_ROOT);
      }
    }
    const unseals = calls.filter((call) => call.args.join(" ") === "operator unseal");
    expect(unseals.length).toBe(EPHEMERAL_KEY_THRESHOLD);
    for (const unseal of unseals) {
      expect(SENTINEL_KEYS).toContain(unseal.stdin ?? "");
      // The share crosses the kubectl boundary on stdin. `arg` describes what a
      // shell does with it INSIDE the pod; kubectl's own argv never carries it.
      expect(unseal.mode).toBe("arg");
    }
  });

  test("no share and no root token appears in the returned report or in any logged line", async () => {
    const logs: string[] = [];
    const { exec } = fakeVault();
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps(logs) });
    expect(outcome.ok).toBe(true);

    const surface = `${JSON.stringify(outcome)}\n${logs.join("\n")}`;
    for (const key of SENTINEL_KEYS) expect(surface).not.toContain(key);
    expect(surface).not.toContain(SENTINEL_ROOT);
    // And the log actually said something -- an empty log trivially contains no
    // secrets, which would make the assertion above vacuous.
    expect(logs.length).toBeGreaterThan(0);
  });

  test("a FAILING init does not echo its stdout, because on the success path stdout is the material", async () => {
    const { exec } = fakeVault({
      "operator init -key-shares=5 -key-threshold=3 -format=json": {
        status: 1,
        stdout: INIT_JSON,
        stderr: "Vault is already initialized",
      },
    });
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const rendered = JSON.stringify(outcome.failure);
    for (const key of SENTINEL_KEYS) expect(rendered).not.toContain(key);
    expect(rendered).not.toContain(SENTINEL_ROOT);
    expect(rendered).toContain("already initialized");
  });

  test("a FAILING unseal redacts the material out of its detail", async () => {
    const { exec } = fakeVault({
      "operator unseal": { status: 1, stdout: `bad key ${SENTINEL_KEYS[0] ?? ""}`, stderr: "" },
    });
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(JSON.stringify(outcome.failure)).not.toContain(SENTINEL_KEYS[0] ?? "");
    expect(outcome.failure.detail).toContain(REDACTION);
  });
});

describe("the leak scan is capable of failing -- without this the check above is vacuous", () => {
  test("FIRES when material is planted in the transcript", async () => {
    const logs: string[] = [];
    const { exec } = fakeVault();
    const outcome = await runEphemeralVaultInit({
      exec,
      gate: ALLOWED,
      ...emptyScanDeps(logs),
      transcript: `some log line carrying ${SENTINEL_KEYS[0] ?? ""} where it must not be`,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.step).toBe("leak-scan");
    expect(outcome.report?.leakScan.leaked.length).toBe(1);
  });

  test("FIRES when material is planted in a file under a scan root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-vault-leak-"));
    try {
      writeFileSync(join(dir, "included-proof.log"), `verdict ok\nroot=${SENTINEL_ROOT}\n`, "utf8");
      const { exec } = fakeVault();
      const outcome = await runEphemeralVaultInit({
        exec,
        gate: ALLOWED,
        ...emptyScanDeps([]),
        scanRoots: [dir],
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.failure.step).toBe("leak-scan");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("FIRES when material is planted in the vault-0 pod logs", async () => {
    const { exec } = fakeVault();
    const outcome = await runEphemeralVaultInit({
      exec,
      gate: ALLOWED,
      ...emptyScanDeps([]),
      podLogs: `core: post-unseal setup ${SENTINEL_KEYS[2] ?? ""}`,
    });
    expect(outcome.ok).toBe(false);
  });

  test("the root token reaches `token revoke -self` on STDIN, so the revoke can actually authenticate", async () => {
    // Regression guard for a real defect in the first draft: `token revoke -self`
    // must authenticate AS the token it revokes, and the root token exists
    // nowhere in the pod -- `operator init` printed it to us and to nobody else.
    // Without a token the call is a guaranteed 403 that reported itself as a
    // non-fatal miss, i.e. a step that never worked wearing the face of one that
    // was merely unlucky.
    const { exec, calls } = fakeVault();
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const revoke = calls.find((call) => call.args.join(" ") === "token revoke -self");
    expect(revoke?.stdin).toBe(SENTINEL_ROOT);
    expect(revoke?.mode).toBe("env");
    expect(revoke?.args.join(" ")).not.toContain(SENTINEL_ROOT);
    expect(outcome.report.rootTokenRevoked).toBe(true);
  });

  test("a scan root that is a single FILE is opened, not silently skipped", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-vault-file-root-"));
    try {
      const file = join(dir, "one.log");
      writeFileSync(file, SENTINEL_ROOT, "utf8");
      const scan = scanForKeyMaterial([SENTINEL_ROOT], {
        transcript: "x",
        reportJson: "{}",
        fileRoots: [file],
        podLogs: "",
      });
      expect(scan.leaked).toContain(file);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a scan of zero bytes is VACUOUS, not clean", () => {
    const scan = scanForKeyMaterial([SENTINEL_ROOT], {
      transcript: "",
      reportJson: "",
      fileRoots: [],
      podLogs: "",
    });
    expect(scan.leaked.length).toBe(0);
    expect(scan.vacuous).toBe(true);
  });

  test("an empty needle set is VACUOUS -- searching for nothing always succeeds", () => {
    const scan = scanForKeyMaterial([], {
      transcript: "anything",
      reportJson: "{}",
      fileRoots: [],
      podLogs: "",
    });
    expect(scan.vacuous).toBe(true);
  });

  test("the clean path reports what it actually looked at, so a zero cannot hide", async () => {
    const { exec } = fakeVault();
    const outcome = await runEphemeralVaultInit({ exec, gate: ALLOWED, ...emptyScanDeps([]) });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.leakScan.vacuous).toBe(false);
    expect(outcome.report.leakScan.bytesScanned).toBeGreaterThan(0);
    expect(outcome.report.leakScan.sourcesScanned).toBeGreaterThan(0);
  });
});

describe("parseInitOutput and redact", () => {
  test("collects b64 shares, hex shares and the root token as needles", () => {
    const parsed = parseInitOutput(INIT_JSON);
    expect(parsed?.unsealKeys.length).toBe(EPHEMERAL_KEY_SHARES);
    expect(parsed?.allNeedles.length).toBe(EPHEMERAL_KEY_SHARES * 2 + 1);
    expect(parsed?.allNeedles).toContain(SENTINEL_ROOT);
  });

  test("refuses output with no shares or no root token rather than proceeding half-blind", () => {
    expect(parseInitOutput("not json")).toBeNull();
    expect(parseInitOutput(JSON.stringify({ unseal_keys_b64: [], root_token: "x" }))).toBeNull();
    expect(parseInitOutput(JSON.stringify({ unseal_keys_b64: ["a"], root_token: "" }))).toBeNull();
  });

  test("redact replaces every occurrence, not just the first", () => {
    const text = `${SENTINEL_ROOT} then again ${SENTINEL_ROOT}`;
    const out = redact(text, [SENTINEL_ROOT]);
    expect(out).not.toContain(SENTINEL_ROOT);
    expect(out.split(REDACTION).length - 1).toBe(2);
  });
});
