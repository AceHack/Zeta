// ceremony-handoff.ts falsifiers — and the EVIDENCE for the defect this module was
// extracted to fix. No real Touch ID, no `sudo`, no device, no network, no key material.
// Run: bun test ceremony-handoff.test.ts   (from tools/setup/persona-keys)
//
// The first block is the load-bearing one, in the same register `ceremony-brief.test.ts`
// uses: the claim "a refusal that names no remedy leaves the reader at a wall" is not
// asserted in prose — it is EXECUTED, against the actual text the working instance
// produced, transcribed and pinned so it stays checkable after the source line is fixed.
import { test, expect } from "bun:test";
import {
  actionable,
  assertFullySpecified,
  blocked,
  environmentSecretSource,
  expectMeasured,
  findEscape,
  HANDOFF_REFUSAL_CODES,
  HandoffRefused,
  keychainSecretSource,
  MalformedRefusalError,
  measureAround,
  MeasuredActFailure,
  namedEscape,
  readinessExitCode,
  REDACTED,
  refusal,
  refuseWith,
  renderReadiness,
  renderRefusal,
  resolveSecret,
  runGatedCeremony,
  Secret,
  specifySubprocessPlan,
  type RemedyStep,
  type SecretSource,
} from "./ceremony-handoff.ts";

// ── THE DEFECT, EXECUTED ─────────────────────────────────────────────────────────────
//
// Transcribed from `frost-hsm-provision.ts` on branch `hw-lane-provisioning` (PR #15564)
// as it stood on 2026-08-26 — the day it was run end-to-end against a real YubiHSM 2.
// Both strings are what an operator was actually shown. They are pinned as constants
// because the claim they support is HISTORICAL: it is about what a person could do next
// at that stop, and it must stay falsifiable after the code is repaired.

/** `planWrapKeyProvisioning`, the `module-init-failed` stage. TEACHES: names the config
 *  file, the setting, and where to point it. This one repaired a live operator's host. */
const STAGE_REFUSAL_THAT_TAUGHT =
  "C_Initialize returned 6. The module loaded and would not initialise, which is " +
  "usually module CONFIGURATION rather than hardware. For the YubiHSM module: point " +
  "YUBIHSM_PKCS11_CONF at a file containing `connector = http://127.0.0.1:12345`, with " +
  "yubihsm-connector running.";

/** `planWrapKeyProvisioning`, the empty-password refusal. Impeccable reasoning; NO REMEDY.
 *  A newcomer reading this knows exactly why it stopped and nothing about what to do. */
const PASSWORD_REFUSAL_THAT_DID_NOT =
  "frost-hsm-provision: no device password was supplied. Refusing to build a command that " +
  "would prompt interactively behind a biometric gate — the operator would be approving " +
  "an act whose authentication had not happened yet.";

/**
 * The mechanical difference between a guard and a dead end, stated as something a machine
 * can see: a remedy tells the reader an ACT — a command to run, a file to edit, a person
 * to ask. This is a weak proxy on purpose (see the test below that says so).
 */
function looksLikeItNamesAnAct(text: string): boolean {
  return /\$ |run |set |point |edit |install |store |ask |plug /i.test(text);
}

test("BEFORE: the two refusals from one file, one hour apart — one taught, one walled", () => {
  expect(looksLikeItNamesAnAct(STAGE_REFUSAL_THAT_TAUGHT)).toBe(true);
  expect(looksLikeItNamesAnAct(PASSWORD_REFUSAL_THAT_DID_NOT)).toBe(false);
  // Same author, same file, same hour. Which is the evidence that remedy-naming is a
  // discipline you fall out of, not a thing careless people do — and therefore that it
  // wants a constructor rather than a code review.
});

test("the proxy above is WEAK, and saying so keeps the claim honest", () => {
  // A refusal could name an act in words the regex misses, or match it while saying
  // nothing useful. The regex is evidence about these two PINNED strings; it is not a
  // general detector, and this module does not ship one. What ships is the constructor.
  expect(looksLikeItNamesAnAct("please ask someone")).toBe(true);
  expect(looksLikeItNamesAnAct("supply the credential")).toBe(false); // a real act, missed
});

// ── INVARIANT 4: EVERY REFUSAL NAMES ITS REMEDY (STRUCTURAL) ─────────────────────────

const OK_STEP: RemedyStep = { why: "store the credential", command: "op item get zeta-hsm" };

test("a refusal with an EMPTY remedy cannot be constructed", () => {
  expect(() => refusal({ code: "c", what: "w", why: "y", remedy: [] })).toThrow(MalformedRefusalError);
});

test("a remedy step with neither command nor note cannot be constructed", () => {
  expect(() => refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "fix it" }] })).toThrow(
    MalformedRefusalError,
  );
  // ...and the message must say what is missing, or this validator is itself a dead end.
  try {
    refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "fix it" }] });
    throw new Error("unreachable");
  } catch (err) {
    expect((err as Error).message).toContain("neither a command nor a note");
  }
});

test("an empty why/what/code is refused — a refusal that says nothing is not a refusal", () => {
  expect(() => refusal({ code: "", what: "w", why: "y", remedy: [OK_STEP] })).toThrow(MalformedRefusalError);
  expect(() => refusal({ code: "c", what: "", why: "y", remedy: [OK_STEP] })).toThrow(MalformedRefusalError);
  expect(() => refusal({ code: "c", what: "w", why: "", remedy: [OK_STEP] })).toThrow(MalformedRefusalError);
});

test("a multi-line remedy command is refused — a remedy is meant to be pasted", () => {
  expect(() =>
    refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "do two things", command: "a\nb" }] }),
  ).toThrow(MalformedRefusalError);
});

test("VACUITY ADMITTED: a technically-non-empty useless remedy still passes", () => {
  // A constructor can check that a remedy EXISTS. It cannot check that it HELPS, and a
  // check that claimed to would be the vacuity class in this module's own front door.
  // Recorded as a falsifier rather than hidden, so nobody cites the constructor as more
  // than it is. What the constructor buys is that the omission is now DELIBERATE.
  const useless = refusal({ code: "c", what: "w", why: "y", remedy: [{ why: "fix it", note: "see the docs" }] });
  expect(useless.remedy).toHaveLength(1);
});

test("the rendered refusal puts the remedy LAST, where the reader's eye lands", () => {
  const text = renderRefusal(
    refusal({ code: "secret-absent", what: "refused", why: "because", remedy: [OK_STEP] }),
  );
  expect(text).toContain("TO PROCEED:");
  expect(text.indexOf("TO PROCEED:")).toBeGreaterThan(text.indexOf("WHY"));
  expect(text).toContain("$ op item get zeta-hsm");
});

test("refuseWith throws a HandoffRefused carrying the whole refusal", () => {
  try {
    refuseWith({ code: "x", what: "w", why: "y", remedy: [OK_STEP] });
    throw new Error("unreachable");
  } catch (err) {
    expect(err).toBeInstanceOf(HandoffRefused);
    expect((err as HandoffRefused).refusal.remedy).toHaveLength(1);
  }
});

// ── INVARIANT 1: THE AGENT NEVER HOLDS THE SECRET ────────────────────────────────────

test("a Secret redacts through every ACCIDENTAL path, and only reveal() exits", () => {
  const s = new Secret("hunter2", "1Password:zeta/hsm");
  expect(`${s}`).toBe(REDACTED); // template literal — the leak that actually happens
  expect(String(s)).toBe(REDACTED);
  expect(s + "").toBe(REDACTED);
  expect(JSON.stringify({ password: s })).toBe(`{"password":"${REDACTED}"}`);
  expect(JSON.stringify([s])).toBe(`["${REDACTED}"]`);
  // ADJUDICATED (R5, audit-check-arity-nonequality). An absence assertion witnesses ONE
  // RENDERING of a leak, never its absence — so the claim is carried by EXACT-EQUALITY PINS
  // on the WHOLE output of every accidental path, above and here. The `not.toContain` below
  // is kept as a readable statement of intent; the pins are what make it a check.
  expect(Bun.inspect(s)).toBe(`Secret(1Password:zeta/hsm) ${REDACTED}`);
  expect(Bun.inspect(s)).not.toContain("hunter2");
  expect(s.reveal()).toBe("hunter2"); // the ONE deliberate exit
  expect(s.origin).toBe("1Password:zeta/hsm");
});

test("HONEST LIMIT: a Secret is hygiene, not a boundary — reveal() is public", () => {
  // Stated as a falsifier so nobody upgrades the claim later. Anything with code
  // execution in this process reads the value. What this stops is accidents, and the
  // incident history is made of accidents.
  expect(typeof new Secret("v", "o").reveal).toBe("function");
});

test("an absent secret REFUSES with the store's own remedy, never with an empty string", () => {
  const source: SecretSource = {
    storeName: "the vault",
    read: () => undefined,
    storeRemedy: (ref) => [{ why: `put ${ref} in the vault`, command: `vault put ${ref}` }],
  };
  const r = resolveSecret({ ref: "ZETA_PW", purpose: "the device password" }, source);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");
  expect(r.refusal.code).toBe(HANDOFF_REFUSAL_CODES.secretAbsent);
  expect(r.refusal.what).toContain("the device password");
  expect(r.refusal.remedy[0]?.command).toBe("vault put ZETA_PW");
});

test("an EMPTY-STRING secret is absent, not present — the falsifier for the real bug", () => {
  // This is the case that actually bites: `process.env.X ?? ""` yields a present-looking
  // empty credential that flows onward and fails at a point where the cause is invisible.
  const source = environmentSecretSource({
    env: { ZETA_PW: "" },
    storeRemedy: (ref) => [{ why: `export ${ref}`, command: `export ${ref}=$(op read op://Zeta/hsm/password)` }],
  });
  const r = resolveSecret({ ref: "ZETA_PW", purpose: "the device password" }, source);
  expect(r.ok).toBe(false);
});

test("a present secret resolves with its origin recorded, not its value", () => {
  const source = environmentSecretSource({ env: { ZETA_PW: "s3cret" }, storeRemedy: () => [OK_STEP] });
  const r = resolveSecret({ ref: "ZETA_PW", purpose: "p" }, source);
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error("unreachable");
  expect(r.secret.reveal()).toBe("s3cret");
  expect(`${r.secret}`).toBe(REDACTED);
});

// ── INVARIANTS 2 + 3: FULLY SPECIFIED, AUTH BEFORE APPROVAL ──────────────────────────

const GATED = "provision-or-reconfigure-hardware-token" as const;

test("argv and displayArgv are two projections of ONE array — they cannot drift", () => {
  const plan = specifySubprocessPlan({
    operation: GATED,
    program: "yubihsm-shell",
    args: ["-p", new Secret("0001password", "env:PW"), "-a", "generate-symmetric-key"],
  });
  expect(plan.argv).toEqual(["-p", "0001password", "-a", "generate-symmetric-key"]);
  expect(plan.displayArgv).toEqual(["-p", REDACTED, "-a", "generate-symmetric-key"]);
  expect(plan.argv).toHaveLength(plan.displayArgv.length);
  // ADJUDICATED (R5): backed by the exact-equality pin on `displayArgv` above AND by this
  // whole-string pin. The absence assertion alone would pass for any other encoding of the
  // credential, which is precisely the 2-safety gap the audit exists to name.
  expect(plan.displayCommand).toBe(`yubihsm-shell -p ${REDACTED} -a generate-symmetric-key`);
  expect(plan.displayCommand).not.toContain("0001password");
  // The password is REPLACED, not omitted — the reader can see there is a credential and
  // exactly where it goes, which is what makes the shape legible.
  expect(plan.displayCommand).toContain(REDACTED);
});

test("an EMPTY credential is refused, not prompted for — the order is load-bearing", () => {
  try {
    specifySubprocessPlan({ operation: GATED, program: "yubihsm-shell", args: ["-p", new Secret("", "env:PW")] });
    throw new Error("unreachable");
  } catch (err) {
    expect(err).toBeInstanceOf(HandoffRefused);
    const r = (err as HandoffRefused).refusal;
    expect(r.code).toBe(HANDOFF_REFUSAL_CODES.underspecified);
    // THE FIX, EXECUTED: this refusal — unlike the one it replaces — names a remedy.
    expect(r.remedy.length).toBeGreaterThan(0);
    expect(r.why).toContain("authentication had not happened yet");
    expect(r.remedy.some((s) => (s.note ?? "").includes("env:PW"))).toBe(true);
  }
});

test("passing a REVEALED secret as a plain string is caught, not silently displayed", () => {
  // The realistic mistake: somebody writes `secret.reveal()` in the args array because it
  // typechecks. Without this check the plan would print the password to the operator's
  // terminal and into every log that captured it.
  const pw = new Secret("0001password", "env:PW");
  expect(() =>
    specifySubprocessPlan({ operation: GATED, program: "p", args: [pw, "-x", pw.reveal()] }),
  ).toThrow(HandoffRefused);
});

test("REGRESSION: the `--flag=secret` spelling is caught — equality-only missed it", () => {
  // Found in adversarial review, 2026-08-26. The first draft checked
  // `displayArgv.includes(value)`, which finds the credential ONLY when it is an argument
  // entirely by itself. `--pw=<secret>` is the ordinary spelling, is a distinct string, and
  // sailed through while shipping the password to the operator's terminal and every log
  // that captured it. This test fails against that draft and passes against the substring
  // scan — which is what makes it a falsifier rather than a restatement.
  const pw = new Secret("0001password", "env:PW");
  expect(() =>
    specifySubprocessPlan({ operation: GATED, program: "p", args: [pw, `--pw=${pw.reveal()}`] }),
  ).toThrow(HandoffRefused);
});

test("the short-secret threshold is STATED, not silently tuned", () => {
  // A 1-3 character secret occurs inside ordinary arguments by chance, so scanning for it
  // would refuse every plan and teach callers to route around the check. Pinned so the
  // number is a decision somebody can disagree with rather than a constant nobody noticed.
  const tiny = new Secret("ab", "env:PW");
  expect(() => specifySubprocessPlan({ operation: GATED, program: "p", args: [tiny, "grab"] })).not.toThrow();
});

test("assertFullySpecified carries the ordering guarantee for NON-subprocess acts", () => {
  // The act-shape-agnostic half. Two of the three ceremonies this repo already classifies
  // are not subprocess invocations — `publish.ts` posts a JSON body and `revoke.ts` calls
  // an injected effect — so an argv-only module would have covered one case in three.
  expect(() => assertFullySpecified({ operation: GATED, secrets: [new Secret("v", "o")] })).not.toThrow();
  try {
    assertFullySpecified({ operation: GATED, secrets: [new Secret("", "vault:zeta/hsm")] });
    throw new Error("unreachable");
  } catch (err) {
    const r = (err as HandoffRefused).refusal;
    expect(r.code).toBe(HANDOFF_REFUSAL_CODES.underspecified);
    expect(r.why).toContain("authentication had not happened yet");
    expect(r.remedy.some((s) => (s.note ?? "").includes("vault:zeta/hsm"))).toBe(true);
  }
  expect(() => assertFullySpecified({ operation: "renew-leaf-svid", secrets: [] })).toThrow(HandoffRefused);
});

test("VACUITY ADMITTED: nothing here proves a program will not prompt anyway", () => {
  // `gpg`, `ssh-keygen`, `op` and `yubihsm-shell` all prompt on a tty regardless of argv.
  // A non-empty Secret satisfies the LETTER of invariant 2 and the program can still ask.
  // Recorded so the carved sentence is never read as more than the mechanism delivers.
  expect(() => assertFullySpecified({ operation: GATED, secrets: [new Secret("anything", "o")] })).not.toThrow();
});

test("a plan for an UNATTENDED operation is refused — routine prompts destroy real ones", () => {
  try {
    specifySubprocessPlan({ operation: "renew-leaf-svid", program: "p", args: ["a"] });
    throw new Error("unreachable");
  } catch (err) {
    const r = (err as HandoffRefused).refusal;
    expect(r.code).toBe(HANDOFF_REFUSAL_CODES.notAGatedOperation);
    // It must quote ceremony-gate.ts's OWN reason, not restate one invented here.
    expect(r.why).toContain("an agent that cannot renew unattended");
    expect(r.remedy.length).toBeGreaterThan(0);
  }
});

test("the closed set is NOT extended here — an unclassified operation does not typecheck", () => {
  // Compile-time, so the falsifier is the @ts-expect-error itself: if `specifySubprocessPlan` ever
  // accepted a free string, this line stops erroring and the test fails.
  // @ts-expect-error — 'drop-production-database' is not in FederatedIdentityOperation
  const build = () => specifySubprocessPlan({ operation: "drop-production-database", program: "p", args: [] });
  expect(typeof build).toBe("function");
});

// ── THE LADDER ───────────────────────────────────────────────────────────────────────

test("exit codes: ready=0, actionable=3, blocked=1 — the middle rung is not a failure", () => {
  expect(readinessExitCode({ rung: "ready", detail: "d" })).toBe(0);
  expect(readinessExitCode(actionable("d", [OK_STEP]))).toBe(3);
  expect(readinessExitCode(blocked("stage", { code: "c", what: "w", why: "y", remedy: [OK_STEP] }))).toBe(1);
});

test("an ACTIONABLE rung with no next act cannot be constructed", () => {
  // The middle rung's entire value is that it says what the one remaining act IS. A rung
  // that says "you are one command away" and not WHICH command is the dead end again.
  expect(() => actionable("d", [])).toThrow(MalformedRefusalError);
});

test("a BLOCKED stage cannot be added without someone writing down what to do about it", () => {
  expect(() => blocked("new-stage", { code: "c", what: "w", why: "y", remedy: [] })).toThrow(
    MalformedRefusalError,
  );
});

test("the actionable readout says EXPECTED and prints the act; blocked says real failure", () => {
  const act = renderReadiness("T", actionable("factory-fresh device", [{ why: "run the ceremony", command: "x" }]));
  expect(act).toContain("EXPECTED");
  expect(act).toContain("$ x");
  expect(act).not.toContain("real failure");

  const bad = renderReadiness("T", blocked("no-token", { code: "c", what: "w", why: "y", remedy: [OK_STEP] }));
  expect(bad).toContain("real failure, not a missing prerequisite");
  expect(bad).toContain("TO PROCEED:"); // blocked still names a remedy
});

// ── INVARIANT 5: BEFORE/AFTER IS MEASURED ────────────────────────────────────────────

test("the probe runs TWICE around the act, and both readings are carried", () => {
  let reading = 0;
  const seen: number[] = [];
  const m = measureAround({
    probe: () => {
      seen.push(reading);
      return reading;
    },
    act: () => {
      reading = 1;
      return "done";
    },
  });
  return m.then((r) => {
    expect(seen).toHaveLength(2);
    expect(r.before).toBe(0);
    expect(r.after).toBe(1);
    expect(r.changed).toBe(true);
    expect(r.result).toBe("done");
  });
});

test("an act that touches nothing MEASURES unchanged — a reading, not an assumption", async () => {
  const m = await measureAround({ probe: () => 7, act: () => "dry-run" });
  expect(m.changed).toBe(false);
  expect(m.before).toBe(7);
  expect(m.after).toBe(7);
});

test("REGRESSION: a failed act CARRIES its readings — the branch used to be dead", async () => {
  // Adversarial review, 2026-08-26, found the original catch block threw the same error
  // down both arms of its comparison: the after-reading was computed and DISCARDED while a
  // comment claimed the caller's log now had it. Deleting the whole branch would not have
  // failed a single test. That is the vacuity class inside the module written to abolish
  // it, guarding the exact case invariant 5 exists for — a half-done privileged act.
  //
  // These assertions fail against that draft: nothing carried `changed`, and the readings
  // were unreachable from the caller.
  let reading = 0;
  let probes = 0;
  const boom = measureAround({
    probe: () => {
      probes += 1;
      return reading;
    },
    act: () => {
      reading = 1; // the act got HALFWAY before failing
      throw new Error("device said no");
    },
  });
  await expect(boom).rejects.toThrow(MeasuredActFailure);
  // The cause's message is still a substring, so existing `toThrow(...)` matches and log
  // greps keep working — the measured fact is APPENDED, never substituted.
  await expect(boom).rejects.toThrow("device said no");
  try {
    await boom;
    throw new Error("unreachable");
  } catch (err) {
    const m = err as MeasuredActFailure<number>;
    expect(m.changed).toBe(true);
    expect(m.before).toBe(0);
    expect(m.after).toBe(1);
    expect(m.message).toContain("HALF-DONE");
    expect((m.cause as Error).message).toBe("device said no");
  }
  expect(probes).toBeGreaterThanOrEqual(2);
});

test("a failed act that touched nothing says so, and does not cry half-done", async () => {
  try {
    await measureAround({
      probe: () => 5,
      act: () => {
        throw new Error("refused");
      },
    });
    throw new Error("unreachable");
  } catch (err) {
    const m = err as MeasuredActFailure<number>;
    expect(m.changed).toBe(false);
    expect(m.message).toContain("did not take effect");
    expect(m.message).not.toContain("HALF-DONE");
  }
});

test("REGRESSION: the probe may be ASYNC — a remote state read was impossible before", async () => {
  // The sync-only signature was an artifact of the local-hardware instance this was
  // extracted from. It silently excluded every act whose state you have to ask for over a
  // network — a cloud token, a remote KRL, a database — i.e. most of what this claims to
  // cover. This test does not compile against the original signature.
  const m = await measureAround({
    probe: async () => (await Promise.resolve({ revision: 7 })).revision,
    act: async () => Promise.resolve("ok"),
  });
  expect(m.before).toBe(7);
  expect(m.after).toBe(7);
  expect(m.changed).toBe(false);
});

test("VACUITY ADMITTED: a constant probe measures nothing and passes", async () => {
  // `measureAround` runs the probe the caller supplies. A probe that returns a literal
  // proves exactly nothing, and no signature can tell that from a real observation. This
  // is a CALL SITE obligation, recorded here rather than implied away.
  const m = await measureAround({ probe: () => "always", act: () => null });
  expect(m.changed).toBe(false);
});

test("expectMeasured refuses a contradicted expectation, WITH a remedy", () => {
  const m = { before: 0, after: 1, changed: true, result: null };
  try {
    expectMeasured(m, { changed: false, subject: "the token" });
    throw new Error("unreachable");
  } catch (err) {
    const r = (err as HandoffRefused).refusal;
    expect(r.code).toBe(HANDOFF_REFUSAL_CODES.unexpectedStateChange);
    expect(r.remedy.length).toBeGreaterThan(0);
    expect(r.remedy[0]?.note).toContain("before=0 after=1");
  }
  // And a matching expectation is silent.
  expect(() => expectMeasured(m, { changed: true, subject: "the token" })).not.toThrow();
});

test("the DEFAULT comparator would report every structural reading as changed", async () => {
  // Named because it is the trap: `Object.is` on freshly-allocated objects is always
  // false, and a signal that is always on carries no information.
  const noisy = await measureAround({ probe: () => ({ n: 1 }), act: () => null });
  expect(noisy.changed).toBe(true);
  const quiet = await measureAround({
    probe: () => ({ n: 1 }),
    act: () => null,
    sameState: (a, b) => a.n === b.n,
  });
  expect(quiet.changed).toBe(false);
});

// ── INVARIANT 6: THE ESCAPE HATCH IS NAMED ───────────────────────────────────────────

test("blanket escapes are refused at construction — an override button is not a hatch", () => {
  for (const blanket of ["*", "all", "any", "force", "admin", "FORCE", ""]) {
    expect(() => namedEscape({ liftsCode: blanket, reason: "r", authorizedBy: "a" })).toThrow(
      MalformedRefusalError,
    );
  }
});

test("an escape with no reason or no authorizer is refused", () => {
  expect(() => namedEscape({ liftsCode: "secret-absent", reason: "", authorizedBy: "a" })).toThrow(
    MalformedRefusalError,
  );
  expect(() => namedEscape({ liftsCode: "secret-absent", reason: "r", authorizedBy: "" })).toThrow(
    MalformedRefusalError,
  );
});

test("a named escape lifts exactly ONE code and is returned so it can be LOGGED", () => {
  const e = namedEscape({
    liftsCode: HANDOFF_REFUSAL_CODES.secretAbsent,
    reason: "this lane reads its credential from the HSM, never from a store",
    authorizedBy: "aaron",
  });
  const absent = refusal({ code: HANDOFF_REFUSAL_CODES.secretAbsent, what: "w", why: "y", remedy: [OK_STEP] });
  const other = refusal({ code: HANDOFF_REFUSAL_CODES.underspecified, what: "w", why: "y", remedy: [OK_STEP] });
  expect(findEscape(absent, [e])).toBe(e);
  expect(findEscape(other, [e])).toBeUndefined(); // it lifts ONE, not the neighbours
});

test("HONEST LIMIT: nothing stops enumerating every code by hand", () => {
  // Recorded rather than claimed away. What the type buys is that doing so is a VISIBLE
  // LIST in a diff instead of a single innocuous-looking flag.
  const everything = Object.values(HANDOFF_REFUSAL_CODES).map((c) =>
    namedEscape({ liftsCode: c, reason: "r", authorizedBy: "a" }),
  );
  expect(everything).toHaveLength(Object.values(HANDOFF_REFUSAL_CODES).length);
});

// ── THE FIRST CONSUMER, PINNED ───────────────────────────────────────────────────────
//
// `frost-hsm-provision.ts` (PR #15564) is the first consumer of this module and is not on
// `main` yet, so the remedy it will print is pinned HERE — verified against the store's own
// usage text on this branch — rather than asserted in a PR description. When #15564 lands,
// its password refusal calls `keychainSecretSource` and this test is what proves the
// sentence the operator reads is the one the store actually accepts.

test("FIRST CONSUMER: the HSM password refusal now NAMES ITS REMEDY", () => {
  const source = keychainSecretSource({
    read: () => undefined, // the credential is not in the keystore
    thenAlso: (ref) => [
      {
        why: "hand it to the provisioning command for one run, without exporting it globally",
        command: `ZETA_YUBIHSM_PASSWORD=$(tools/setup/secret-clip.sh get ${ref}) bun tools/setup/persona-keys/frost-hsm-provision.ts plan`,
      },
    ],
  });
  const r = resolveSecret({ ref: "zeta-yubihsm-password", purpose: "the YubiHSM device password" }, source);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");

  // The reasoning that was already good is preserved...
  expect(r.refusal.why).toContain("authentication had not happened yet");
  // ...and the thing that was MISSING is now present and concrete.
  const rendered = renderRefusal(r.refusal);
  expect(rendered).toContain("TO PROCEED:");
  expect(rendered).toContain("secret-clip.sh set zeta-yubihsm-password");
  expect(rendered).toContain("frost-hsm-provision.ts plan");

  // VERIFIED SPELLING, not guessed. `secret-clip.sh` accepts exactly `set` / `get` / `del`
  // (its usage() prints lines 11-18 of itself, so the text cannot drift from the parser).
  // A remedy naming `put`/`store`/`add` would run, fail, and cost the reader more than
  // silence would have — which is why a wrong remedy is worse than none.
  // ADJUDICATED (R5): this is not a taint claim — it is a SPELLING claim, and it is carried
  // by the POSITIVE assertion above that the correct verb `set` IS present. The negative is
  // the readable form of "and none of the verbs this script does not have".
  expect(rendered).not.toMatch(/secret-clip\.sh (put|store|add|write) /);
  for (const step of r.refusal.remedy) {
    expect((step.command ?? "").includes("\n")).toBe(false); // paste-able
  }
});

test("the store's own limits travel WITH the remedy, not in a footnote", () => {
  const r = resolveSecret(
    { ref: "zeta-yubihsm-password", purpose: "the device password" },
    keychainSecretSource({ read: () => undefined }),
  );
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error("unreachable");
  // macOS-only is a REAL limit: `secret-clip.sh` prints "PLANNED, not yet implemented" and
  // exits 3 on Linux and Windows. A reader on the wrong OS must learn that FROM the remedy
  // rather than from an exit code, or the remedy sends them somewhere that cannot work.
  expect(renderRefusal(r.refusal)).toContain("PLANNED");
});

// ── THE COMPOSED ENTRY POINT — the ordering is EXECUTED, not documented ──────────────

const SUBJECTS = [{ label: "device", value: "yubihsm 39160506" }];
const DECLINED_TEXT = "no key is generated and the device is byte-for-byte as it was";

function ceremonyArgs(over: Record<string, unknown> = {}) {
  return {
    operation: GATED,
    summary: "Generate a NEW AES-256 wrapping key ON the module",
    subjects: SUBJECTS,
    ifDeclined: DECLINED_TEXT,
    probe: () => 0,
    act: () => "done",
    dryRun: false,
    biometricAuth: async () => ({ ok: true, platform: "macos-touchid" as const, factor: "biometric" as const }),
    ...over,
  };
}

test("THE ORDERING IS STRUCTURAL: credentials resolve BEFORE the door is opened", async () => {
  // This is the invariant that was prose everywhere else in the module. A call site could
  // resolve after prompting and nothing would object. Here it CANNOT, because the sequence
  // is the function body. The falsifier is an event log: if `biometric` ever precedes
  // `resolve`, the operator approved an act whose authentication had not happened yet.
  const order: string[] = [];
  const outcome = await runGatedCeremony(
    ceremonyArgs({
      requires: [{ ref: "zeta-hsm-pw", purpose: "the device password" }],
      source: {
        storeName: "test store",
        read: (ref: string) => {
          order.push(`resolve:${ref}`);
          return "s3cret";
        },
        storeRemedy: () => [OK_STEP],
      },
      probe: () => {
        order.push("probe");
        return 0;
      },
      biometricAuth: async () => {
        order.push("biometric");
        return { ok: true, platform: "macos-touchid" as const, factor: "biometric" as const };
      },
      act: (secrets: ReadonlyMap<string, Secret>) => {
        order.push("act");
        expect(secrets.get("zeta-hsm-pw")?.reveal()).toBe("s3cret");
        return "done";
      },
    }),
  );
  expect(outcome.kind).toBe("performed");
  expect(order.indexOf("resolve:zeta-hsm-pw")).toBeLessThan(order.indexOf("biometric"));
  expect(order.indexOf("biometric")).toBeLessThan(order.indexOf("act"));
  // ...and the ground truth was read before the human was asked, then again after the act.
  expect(order.filter((s) => s === "probe")).toHaveLength(2);
});

test("an ABSENT credential refuses BEFORE prompting, with the store's remedy", async () => {
  let prompted = 0;
  const outcome = await runGatedCeremony(
    ceremonyArgs({
      requires: [{ ref: "zeta-hsm-pw", purpose: "the device password" }],
      source: keychainSecretSource({ read: () => undefined }),
      biometricAuth: async () => {
        prompted += 1;
        return { ok: true, platform: "macos-touchid" as const, factor: "biometric" as const };
      },
    }),
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") throw new Error("unreachable");
  expect(outcome.refusal.code).toBe(HANDOFF_REFUSAL_CODES.secretAbsent);
  expect(renderRefusal(outcome.refusal)).toContain("secret-clip.sh set zeta-hsm-pw");
  // The load-bearing assertion: the human was never asked to approve an act that could not
  // have run. Asking anyway is the unevaluable prompt.
  expect(prompted).toBe(0);
});

test("a declared credential with NO source refuses, and says how to pass one", async () => {
  const outcome = await runGatedCeremony(
    ceremonyArgs({ requires: [{ ref: "x", purpose: "p" }] }),
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") throw new Error("unreachable");
  expect(outcome.refusal.remedy.length).toBeGreaterThan(0);
});

test("DRY RUN IS THE DEFAULT and never opens the biometric door", async () => {
  let prompted = 0;
  let acted = 0;
  const outcome = await runGatedCeremony({
    operation: GATED,
    summary: "s",
    subjects: SUBJECTS,
    ifDeclined: DECLINED_TEXT,
    probe: () => 41,
    act: () => {
      acted += 1;
      return "x";
    },
    biometricAuth: async () => {
      prompted += 1;
      return { ok: true, platform: "macos-touchid" as const, factor: "biometric" as const };
    },
  }); // NOTE: no `dryRun` passed at all
  expect(outcome.kind).toBe("dry-run");
  if (outcome.kind !== "dry-run") throw new Error("unreachable");
  expect(outcome.before).toBe(41);
  // Planning must never habituate an operator into approving.
  expect(prompted).toBe(0);
  expect(acted).toBe(0);
  // The prompt line is DERIVED from the brief, so a dry run shows the real sentence.
  expect(outcome.promptLine).toContain("device=yubihsm 39160506");
});

test("FAIL-CLOSED: no injected door means declined, never performed", async () => {
  let acted = 0;
  const outcome = await runGatedCeremony(
    ceremonyArgs({ biometricAuth: undefined, act: () => { acted += 1; return "x"; } }),
  );
  expect(outcome.kind).toBe("declined");
  expect(acted).toBe(0);
});

test("a DECLINED approval performs nothing and reports the reason", async () => {
  let acted = 0;
  const outcome = await runGatedCeremony(
    ceremonyArgs({
      biometricAuth: async () => ({ ok: false, platform: "macos-touchid" as const, reason: "operator pressed Esc" }),
      act: () => { acted += 1; return "x"; },
    }),
  );
  expect(outcome.kind).toBe("declined");
  if (outcome.kind !== "declined") throw new Error("unreachable");
  expect(outcome.reason).toBe("operator pressed Esc");
  expect(acted).toBe(0);
});

test("an UNATTENDED operation cannot be run through the ceremony at all", async () => {
  await expect(runGatedCeremony(ceremonyArgs({ operation: "renew-leaf-svid" }))).rejects.toThrow();
});

test("a performed act reports a MEASURED change, not an assumed one", async () => {
  let world = 0;
  const outcome = await runGatedCeremony(
    ceremonyArgs({ probe: () => world, act: () => { world = 1; return "done"; } }),
  );
  expect(outcome.kind).toBe("performed");
  if (outcome.kind !== "performed") throw new Error("unreachable");
  expect(outcome.measured.before).toBe(0);
  expect(outcome.measured.after).toBe(1);
  expect(outcome.measured.changed).toBe(true);
  expect(outcome.measured.result).toBe("done");
});

test("a NAMED escape lifts exactly its refusal and lets the ceremony proceed", async () => {
  const outcome = await runGatedCeremony(
    ceremonyArgs({
      requires: [{ ref: "zeta-hsm-pw", purpose: "p" }],
      source: keychainSecretSource({ read: () => undefined }),
      escapes: [
        namedEscape({
          liftsCode: HANDOFF_REFUSAL_CODES.secretAbsent,
          reason: "this lane authenticates from the HSM session, never from a store",
          authorizedBy: "aaron",
        }),
      ],
    }),
  );
  // The absent credential no longer stops it — but ONLY because a named, reasoned,
  // authorized escape said so, and only for that one code.
  expect(outcome.kind).toBe("performed");
});

test("an escape for a DIFFERENT code does not lift this refusal", async () => {
  const outcome = await runGatedCeremony(
    ceremonyArgs({
      requires: [{ ref: "zeta-hsm-pw", purpose: "p" }],
      source: keychainSecretSource({ read: () => undefined }),
      escapes: [
        namedEscape({ liftsCode: HANDOFF_REFUSAL_CODES.underspecified, reason: "r", authorizedBy: "a" }),
      ],
    }),
  );
  expect(outcome.kind).toBe("refused");
});

test("an empty-subject brief is refused — the unevaluable prompt, still refused here", async () => {
  await expect(runGatedCeremony(ceremonyArgs({ subjects: [] }))).rejects.toThrow();
});
