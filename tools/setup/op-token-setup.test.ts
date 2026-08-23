// op-token-setup.test.ts — the falsifiers for the property this command exists to hold.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ─────────────────────────────────────────────────────────────┐
// │ NOTHING here touches the real Keychain, the real clipboard, a real `osascript` dialog, real   │
// │ 1Password / `op`, or any real credential. Every OS-specific act is an injected FAKE. The one  │
// │ token-shaped literal in this file is a made-up constant that is not a credential anywhere.    │
// │ A test that would touch real state is a FAIL. (Discipline inherited from                      │
// │ tools/setup/persona-keys/rotate.test.ts.)                                                     │
// └───────────────────────────────────────────────────────────────────────────────────────────────┘
//
// WHY THIS FILE IS THE POINT
// ------------------------------------------------------------------------------------------
// The `.sh` this replaces asserted its security model in a COMMENT. A comment is not a check:
// the same header claimed the token was "never argv" while line 83 ran
// `security add-generic-password … -w "$TOKEN"`, and the claim survived for months because
// nothing could fail. Here the three properties are tests:
//
//   1. the token never reaches this process's stdout or stderr
//   2. the token never reaches an argv (`ps` is world-readable to same-uid processes)
//   3. the token never reaches an environment variable — not the parent's, not a child's
//
// Each one is proved to DISCRIMINATE: the same assertion is run against a deliberately
// defective shape (the old bash argv, a leaking renderer) and must go red there.
import { test, expect } from "bun:test";

import {
  main,
  parseArgs,
  renderTeaching,
  dialogScript,
  usage,
  EXIT_OK,
  EXIT_REFUSED,
  EXIT_USAGE,
  EXIT_UNSUPPORTED_PLATFORM,
  DEFAULT_SERVICE,
  type Capture,
  type OpTokenSetupEffects,
} from "./op-token-setup.ts";
import {
  argvCarriesSecret,
  buildInteractiveAddCommand,
  storeGenericPassword,
  SECURITY_INTERACTIVE_ARGV,
  TRANSPORTABLE_SECRET,
  type KeychainRead,
  type SecuritySpawnResult,
} from "../../src/Core.TypeScript/secrets/keychain-macos.ts";

/** Not a credential anywhere: a shape-valid, made-up value. */
const FAKE_TOKEN = "ops_" + "AAAAfakeTOKENfor-tests_only.NOT-A-REAL-CREDENTIAL=";

interface Harness {
  readonly fx: OpTokenSetupEffects;
  readonly emitted: string[];
  readonly spawns: { argv: readonly string[]; stdin: string }[];
  readonly stored: { account: string; service: string; length: number }[];
}

function harness(over: Partial<OpTokenSetupEffects> = {}, capture: Capture = { ok: true, secret: FAKE_TOKEN }): Harness {
  const emitted: string[] = [];
  const spawns: { argv: readonly string[]; stdin: string }[] = [];
  const stored: { account: string; service: string; length: number }[] = [];
  const fakeSpawn = (argv: readonly string[], stdin: string): SecuritySpawnResult => {
    spawns.push({ argv, stdin });
    return { status: 0, stdout: "", stderr: "" };
  };
  const fx: OpTokenSetupEffects = {
    platform: "darwin",
    account: "tester",
    captureFromDialog: () => capture,
    captureFromClipboard: () => capture,
    store: (account, service, secret) => {
      stored.push({ account, service, length: secret.length });
      // The REAL primitive, with the OS door faked: this exercises the argv/stdin
      // split rather than trusting a stub to have got it right.
      return storeGenericPassword(account, service, secret, {
        platform: "darwin",
        spawn: fakeSpawn,
        verify: (): KeychainRead => ({ ok: true, secret, via: "deputy" }),
      });
    },
    probe: () => ({ present: false, length: 0 }),
    removeAmbientHoist: () => ({ removed: false, path: "/nonexistent/secrets-env.sh" }),
    out: (line) => emitted.push(line),
    err: (line) => emitted.push(line),
    ...over,
  };
  return { fx, emitted, spawns, stored };
}

// ── FALSIFIER 1: the token never reaches stdout or stderr ────────────────────

test("FALSIFIER: a full successful run emits no byte of the token", () => {
  const h = harness();
  expect(main([], h.fx)).toBe(EXIT_OK);
  const all = h.emitted.join("\n");
  expect(all).not.toContain(FAKE_TOKEN);
  // Not just the whole value: no 12-byte window of it either, so a truncated
  // "just the prefix, for debugging" leak also fails.
  for (let i = 0; i + 12 <= FAKE_TOKEN.length; i += 1) {
    expect(all).not.toContain(FAKE_TOKEN.slice(i, i + 12));
  }
  // And the run genuinely did the work — a no-op cannot pass this test by silence.
  expect(h.stored).toEqual([{ account: "tester", service: DEFAULT_SERVICE, length: FAKE_TOKEN.length }]);
  expect(all).toContain("stored ENCRYPTED in the Keychain");
});

test("FALSIFIER discriminates: the same assertion catches a renderer that leaks", () => {
  const leaked = renderTeaching("leaky", {
    assumed: "a",
    observed: `the value was ${FAKE_TOKEN}`,
    believeNow: "c",
  }).join("\n");
  expect(leaked).toContain(FAKE_TOKEN); // the defective shape IS caught
});

test("every refusal path is silent about the value too", () => {
  const cases: Capture[] = [
    { ok: true, secret: "not-an-ops-token-" + FAKE_TOKEN },
    { ok: false, why: "cancelled", detail: "osascript reported the dialog was cancelled" },
    { ok: false, why: "empty", detail: "pbpaste returned nothing" },
  ];
  for (const c of cases) {
    const h = harness({}, c);
    expect(main([], h.fx)).toBe(EXIT_REFUSED);
    const all = h.emitted.join("\n");
    if (c.ok) expect(all).not.toContain(c.secret);
    expect(all).not.toContain(FAKE_TOKEN);
    expect(all).toContain("believe now:"); // teaching-shaped, not merely louder
  }
});

// ── FALSIFIER 2: the token never reaches an argv ─────────────────────────────

test("FALSIFIER: the security(1) argv carries no secret; the stdin does", () => {
  const h = harness();
  expect(main([], h.fx)).toBe(EXIT_OK);
  expect(h.spawns).toHaveLength(1);
  const call = h.spawns[0];
  expect(call).toBeDefined();
  if (call === undefined) return;
  expect(argvCarriesSecret(call.argv, FAKE_TOKEN)).toBe(false);
  expect([...call.argv]).toEqual([...SECURITY_INTERACTIVE_ARGV]);
  // The value must actually have travelled — a write that carried nothing would
  // pass the negative assertion above by doing nothing at all.
  expect(call.stdin).toContain(FAKE_TOKEN);
  expect(call.stdin).toContain("add-generic-password");
});

test("FALSIFIER discriminates: the old bash argv shape is caught", () => {
  // Exactly what tools/setup/op-token-setup.sh:83 executed.
  const bashArgv = ["security", "add-generic-password", "-a", "tester", "-s", DEFAULT_SERVICE, "-U", "-w", FAKE_TOKEN];
  expect(argvCarriesSecret(bashArgv, FAKE_TOKEN)).toBe(true);
  expect(argvCarriesSecret([...SECURITY_INTERACTIVE_ARGV], FAKE_TOKEN)).toBe(false);
});

test("the argv is a constant, so no interpolation can reach it", () => {
  expect([...SECURITY_INTERACTIVE_ARGV]).toEqual(["security", "-i"]);
  expect(buildInteractiveAddCommand("tester", DEFAULT_SERVICE, FAKE_TOKEN).endsWith("\n")).toBe(true);
});

// ── FALSIFIER 3: the token never reaches an environment variable ─────────────

test("FALSIFIER: process.env is byte-identical across a full run", () => {
  const before = JSON.stringify(process.env);
  const h = harness();
  expect(main([], h.fx)).toBe(EXIT_OK);
  expect(JSON.stringify(process.env)).toBe(before);
  for (const [, v] of Object.entries(process.env)) {
    if (typeof v === "string") expect(v).not.toContain(FAKE_TOKEN);
  }
});

/**
 * The discrimination case for FALSIFIER 3 runs against a COPY of the environment,
 * never the real one. Two reasons, and neither is squeamishness:
 *   - planting a token-shaped value in the live `process.env` of a test runner is
 *     the very thing the guard `lint-no-ambient-credential-hoist.ts` exists to
 *     refuse, and a falsifier that must break a security guard to run is not a
 *     falsifier worth having;
 *   - the assertion being proved discriminating is a property of the ASSERTION
 *     SHAPE ("this comparison can go red"), which a copy exercises exactly.
 * The real-environment evidence is the recorded source mutation: assigning
 * `process.env.X = capture.secret` inside `main` turns FALSIFIER 3 red. That was
 * run, observed red, and reverted — twice, once after `main` was refactored.
 */
test("FALSIFIER discriminates: the env assertion catches a hoist", () => {
  const envCopy: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") envCopy[k] = v;
  const before = JSON.stringify(envCopy);
  envCopy.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN;
  expect(JSON.stringify(envCopy)).not.toBe(before);
  expect(Object.values(envCopy).some((v) => v.includes(FAKE_TOKEN))).toBe(true);
  // and the real environment was never touched to prove it
  expect(Object.values(process.env).some((v) => typeof v === "string" && v.includes(FAKE_TOKEN))).toBe(false);
});

// ── the transport's own honesty ──────────────────────────────────────────────

test("`security -i` exiting 0 is NOT read as success — the read-back decides", () => {
  const spawns: string[] = [];
  // The transport lies in exactly the way it was measured to lie: exit 0, no output.
  const lyingSpawn = (argv: readonly string[]): SecuritySpawnResult => {
    spawns.push(argv.join(" "));
    return { status: 0, stdout: "", stderr: "" };
  };
  const notWritten = storeGenericPassword("tester", DEFAULT_SERVICE, FAKE_TOKEN, {
    platform: "darwin",
    spawn: lyingSpawn,
    verify: (): KeychainRead => ({ ok: false, status: -25300, reason: "errSecItemNotFound", via: "in-process" }),
  });
  expect(notWritten.ok).toBe(false);
  if (!notWritten.ok) expect(notWritten.refusal).toBe("write-not-verified");

  const wrongValue = storeGenericPassword("tester", DEFAULT_SERVICE, FAKE_TOKEN, {
    platform: "darwin",
    spawn: lyingSpawn,
    verify: (): KeychainRead => ({ ok: true, secret: FAKE_TOKEN + "drift", via: "deputy" }),
  });
  expect(wrongValue.ok).toBe(false);
  if (!wrongValue.ok) expect(wrongValue.detail).not.toContain(FAKE_TOKEN);
  expect(spawns).toHaveLength(2);
});

test("a value the transport cannot carry unambiguously is REFUSED, never mangled", () => {
  let spawned = 0;
  for (const bad of ['ops_has space', 'ops_has"quote', "ops_has'quote", "ops_has\\backslash", "ops_has\nnewline", "ops_#hash"]) {
    expect(TRANSPORTABLE_SECRET.test(bad)).toBe(false);
    const r = storeGenericPassword("tester", DEFAULT_SERVICE, bad, {
      platform: "darwin",
      spawn: () => { spawned += 1; return { status: 0, stdout: "", stderr: "" }; },
      verify: (): KeychainRead => ({ ok: true, secret: bad, via: "deputy" }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("untransportable-secret");
  }
  expect(spawned).toBe(0); // refused BEFORE any write was attempted
  expect(TRANSPORTABLE_SECRET.test(FAKE_TOKEN)).toBe(true);
});

test("a malformed service or account name is refused before any spawn", () => {
  for (const [account, service] of [["tester", "bad service name"], ["bad account", DEFAULT_SERVICE]] as const) {
    const r = storeGenericPassword(account, service, FAKE_TOKEN, {
      platform: "darwin",
      spawn: () => { throw new Error("must not spawn"); },
      verify: (): KeychainRead => ({ ok: true, secret: FAKE_TOKEN, via: "deputy" }),
    });
    expect(r.ok).toBe(false);
  }
});

// ── OS closure: refuse loudly, never silently no-op ──────────────────────────

test("a non-macOS host REFUSES and names the missing port", () => {
  for (const [platform, portMarker] of [["linux", "libsecret"], ["win32", "Credential Manager"]] as const) {
    const h = harness({ platform });
    expect(main([], h.fx)).toBe(EXIT_UNSUPPORTED_PLATFORM);
    const all = h.emitted.join("\n");
    expect(all).toContain(portMarker);
    expect(all).toContain("believe now:");
    expect(h.stored).toEqual([]); // and it did NOT quietly do nothing-and-succeed
  }
});

test("an unknown platform still refuses rather than silently proceeding", () => {
  const h = harness({ platform: "sunos" });
  expect(main([], h.fx)).toBe(EXIT_UNSUPPORTED_PLATFORM);
  expect(h.stored).toEqual([]);
  expect(storeGenericPassword("tester", DEFAULT_SERVICE, FAKE_TOKEN, {
    platform: "sunos",
    spawn: () => { throw new Error("must not spawn"); },
  }).ok).toBe(false);
});

// ── argument grammar (the OS-closed interface) ───────────────────────────────

test("the flag grammar parses, and an unknown flag teaches", () => {
  expect(parseArgs([])).toMatchObject({ source: "dialog", service: DEFAULT_SERVICE, check: false });
  expect(parseArgs(["--clipboard"])).toMatchObject({ source: "clipboard" });
  expect(parseArgs(["--service", "zeta-other"])).toMatchObject({ service: "zeta-other" });
  expect(parseArgs(["--service"]).error).toBeDefined();
  expect(parseArgs(["--nope"]).error).toBe("unknown arg: --nope");

  const h = harness();
  expect(main(["--nope"], h.fx)).toBe(EXIT_USAGE);
  expect(h.emitted.join("\n")).toContain("believe now:");

  const help = harness();
  expect(main(["--help"], help.fx)).toBe(EXIT_OK);
  expect(help.emitted.join("\n")).toContain(usage()[0] ?? "Usage:");
});

test("--check reports presence and length, never the value, and writes nothing", () => {
  const present = harness({ probe: () => ({ present: true, length: 852 }) });
  expect(main(["--check"], present.fx)).toBe(EXIT_OK);
  expect(present.emitted.join("\n")).toContain("852 bytes");
  expect(present.spawns).toEqual([]);
  expect(present.stored).toEqual([]);

  const absent = harness();
  expect(main(["--check"], absent.fx)).toBe(EXIT_REFUSED);
});

test("the dialog script is built from constants and a validated title only", () => {
  expect(dialogScript(DEFAULT_SERVICE)).toContain("with hidden answer");
  expect(dialogScript('evil" & do shell script "id')).toContain('title "Zeta — store zeta"');
});
