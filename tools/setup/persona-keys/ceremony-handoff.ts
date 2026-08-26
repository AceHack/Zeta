// ceremony-handoff.ts — THE PROTOCOL AROUND THE GATE, EXTRACTED SO IT IS NOT RE-DERIVED.
//
// Aaron, 2026-08-26, on why this file exists — verbatim:
//   *"many times i have to redesign over and over secure AI / human interactions. if this
//    could be taught and reused over and over it would be great productivity enhancement
//    to both sides."*
//
// This package already had the two halves of the human gate:
//
//   `ceremony-gate.ts`   — WHETHER a human is needed (a total classifier over a CLOSED set)
//   `ceremony-brief.ts`  — WHAT the human is told (one brief, one derived prompt)
//
// What it did NOT have is the third half: everything the agent must do BEFORE and AFTER
// the gate so that the moment of approval is worth anything. That third half was derived
// from scratch, correctly, in `frost-hsm-provision.ts` — and it would have been derived
// from scratch again by the next privileged operation. This module is that derivation
// lifted out, as types, so the next one composes it.
//
// ── THIS DOES NOT EXTEND THE CLOSED SET, AND MUST NOT ────────────────────────────────
//
// `FederatedIdentityOperation` stays closed: a peer may NAME an operation and can never
// DEFINE one, which is the portable half of the Itron hub/agent lineage
// (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`). Nothing here adds a
// member; `HandoffPlan` is PARAMETERISED BY one, so a new consumer must go and be
// classified in `ceremony-gate.ts` before it can use this module at all. That is the
// intended friction, not an oversight.
//
// ============================================================================
// THE SIX INVARIANTS
// ============================================================================
//
// Each is stated with the primitive that carries it, because an invariant with no
// mechanism is the vacuity class — an unenforced guarantee that looks like protection is
// worse than an absent one, and Aaron named exactly that as the obstacle to human-AI trust.
//
//  1. THE AGENT NEVER HOLDS THE SECRET.  It is resolved from a store at use time and
//     carried in a `Secret`, whose `toString`/`toJSON` render `<redacted>` — so the leak
//     path that actually happens (a template literal in a log line) is closed by the type
//     rather than by remembering.                       → `Secret`, `resolveSecret`
//
//  2. APPROVAL FOLLOWS AUTHENTICATION, NEVER PRECEDES IT.  A plan that would still have to
//     ask for a credential after the human approves is refused at plan time. The operator
//     would otherwise be approving an act whose authentication had not happened yet — i.e.
//     approving something not yet specified.            → `assertFullySpecified`, `specifySubprocessPlan`
//     PARTIAL, AND SAID SO: this refuses a KNOWABLY-ABSENT credential. It cannot prove no
//     prompt appears — `gpg`, `ssh-keygen`, `op` and `yubihsm-shell` all prompt on a tty
//     whatever you pass them. Prefer programs that FAIL rather than prompt.
//
//  3. THE APPROVED ACT IS FULLY SPECIFIED BEFORE APPROVAL.  `argv` and `displayArgv` are
//     TWO PROJECTIONS OF ONE ARRAY, never two authorings, so the sentence shown to the
//     human cannot drift from the bytes executed.       → `HandoffPlan`
//     SUBPROCESS-SHAPED, AND SAID SO: the general mechanism for "shown ≡ executed" is
//     `ceremony-brief.ts`'s `CeremonySubject` list, which predates this module and which
//     `publish.ts` (a JSON body) and `revoke.ts` (an injected effect) correctly use instead.
//
//  4. EVERY REFUSAL NAMES ITS REMEDY.  A `Refusal` cannot be constructed with an empty
//     remedy — the constructor throws. This is the one invariant that was MISSING from the
//     worked instance and is the reason this module exists as code rather than as a doc.
//                                                        → `refusal`, `RemedyStep`
//
//  5. BEFORE/AFTER STATE IS MEASURED.  "Nothing changed" is a reading, not an assumption:
//     the probe runs twice, around the act, and both readings are carried in the outcome.
//                                                        → `measureAround`
//
//  6. THE ESCAPE HATCH IS EXPLICIT AND NAMED.  An escape names the ONE refusal code it
//     lifts, with a reason and an authorizer. A blanket escape is refused at construction,
//     because an override button that lifts everything is not an escape hatch — it is the
//     absence of a gate with extra steps.                → `namedEscape`, `applyEscapes`
//
// ============================================================================
// WHAT THIS MODULE DELIBERATELY IS NOT
// ============================================================================
//
// It is not an authentication mechanism (`biometric.ts` owns that), not a classifier
// (`ceremony-gate.ts`), not a renderer of the consent block (`ceremony-brief.ts`), and NOT
// a secret store — it holds no credentials, opens no vault, and adds no new place a secret
// can live. `SecretSource` is a description of a store that already exists, whose whole
// job is to produce a correct REMEDY SENTENCE and to read the value through an injected
// door.
//
// ── VACUITY DISCLOSURE (read before citing any of this as a guarantee) ───────────────
//
// This module SITS BESIDE the path rather than on it. `ceremony-gate.ts` at least guards a
// closed set a consumer must pass through; nothing compels anyone to call this file at all.
// So the strongest honest statement of what it buys is:
//
//   ── IT MAKES FOUR FAILURES UNCONSTRUCTIBLE FOR A CALLER WHO USES IT: a refusal with no
//      remedy, a plan whose displayed sentence drifts from its executed bytes, a secret
//      that stringifies to plaintext, and a blanket escape hatch. ──────────────────────
//
// It CANNOT stop a program prompting from behind the gate, cannot tell a real probe from a
// constant one, and cannot make anybody import it. Those three are call-site obligations,
// named here rather than implied away — in the same register `ceremony-brief.ts` uses for
// the macOS modal it cannot reach.
//
// Per invariant: 1 is structural for the ACCIDENTAL paths (`toString`/`toJSON`/inspect) and
// prose for `HandoffPlan.argv`, which must be a plain `string[]` for `spawn` to accept it.
// 3 is structural for arguments passed as `Secret`. 4 is structural for refusals CONSTRUCTED
// through `refusal()` — `throw new Error("nope")` bypasses it entirely. 6 is structural
// against the blanket SPELLINGS and does not stop somebody enumerating every code by hand.
// 2 and 5 are partial, above.
//
// REGISTER: `unmetered`. Every function is total and every arm is exercised by falsifiers
// in `ceremony-handoff.test.ts`, which also pins the four vacuities above as tests rather
// than leaving them as claims. That consumers of this module produce handoffs a human
// actually understands better is a claim nobody has measured.
//
// Anchors (Beacon):
//  - Confused-deputy problem — Norm Hardy, *"The Confused Deputy"* (ACM OSR, 1988). An
//    authority exercised on behalf of a principal who could not see what was being asked
//    is the failure invariants 2 and 3 exist to prevent.
//  - Informed consent as comprehension rather than signature — Faden & Beauchamp,
//    *A History and Theory of Informed Consent* (1986).
//  - Habituation to security dialogs — Böhme & Köpsell, *"Trained to Accept?"* (CHI 2010);
//    Anderson et al., *"How Polymorphic Warnings Reduce Habituation in the Brain"* (CHI 2015).
//  - Actionable error messages — Ko, Myers & Aung, *"Six Learning Barriers in End-User
//    Programming Systems"* (VL/HCC 2004): the *selection* and *coordination* barriers are
//    exactly "the system told me it stopped and not what to do next".
//  - Least privilege / fail-safe defaults — Saltzer & Schroeder, *"The Protection of
//    Information in Computer Systems"* (Proc. IEEE, 1975).
import {
  ceremonyRequirementFor,
  type FederatedIdentityOperation,
} from "../../../src/Core.TypeScript/federated-identity/ceremony-gate.ts";
import {
  assertGatedCeremony,
  type CeremonyBrief,
  type CeremonyBriefEffects,
  ceremonyPromptLine,
  type CeremonySubject,
  renderCeremonyBrief,
  requestedBy,
} from "./ceremony-brief.ts";
import { type BiometricAuth, requireBiometric } from "./biometric.ts";

export type { CeremonySubject, CeremonyBriefEffects };

// ============================================================================
// INVARIANT 4 — EVERY REFUSAL NAMES ITS REMEDY
// ============================================================================

/**
 * One concrete thing a person can go and do. A remedy step is not advice; it is the next
 * act, in the reader's hands.
 *
 * At least one of `command` and `note` MUST be present — a step that says only *why*
 * without saying *what to do* is the dead end this whole module was written to abolish.
 * `command` is preferred: a literal the reader can paste. `note` is for the acts that are
 * genuinely not commands ("plug the device in", "ask Aaron to authorize the budget").
 */
export interface RemedyStep {
  /** What this step accomplishes, in the reader's terms. Required, non-empty. */
  readonly why: string;
  /** A literal, single-line, paste-able command. Placeholders are allowed only when the
   *  value is genuinely the reader's to choose, and must be `<angle-bracketed>` so they are
   *  visibly holes rather than looking like part of the command. */
  readonly command?: string;
  /** A non-command act, or the context a command needs. */
  readonly note?: string;
}

/**
 * A refusal — a stop, with a way forward.
 *
 * The distinction this type encodes, and the reason it is a type rather than a string:
 *
 *   ── A REFUSAL THAT NAMES ITS REMEDY IS A GUARD. ONE THAT DOES NOT IS A DEAD END. ──
 *
 * Measured, 2026-08-26, on the working instance this module was extracted from: eight
 * `unreachable` stages each carried the thing to go fix, and two of them diagnosed a live
 * operator's environment correctly enough to be repaired in one step each. The password
 * refusal in the same file explained its reasoning beautifully and named no remedy — so
 * the same operator, at that stop, had nothing to do next. Same file, same author, same
 * hour: which is the evidence that this is a discipline you fall out of rather than a
 * thing careless people do.
 */
export interface Refusal {
  /** Stable and greppable, e.g. `"secret-absent"`. Kept out of prose so a log can be
   *  searched and a test can assert on the CLASS of refusal rather than its wording. */
  readonly code: string;
  /** What was refused, imperatively: `"refusing to build a command that would prompt"`. */
  readonly what: string;
  /** The reasoning. What goes wrong if this proceeded — the part that teaches. */
  readonly why: string;
  /** How to get past it. MUST be non-empty; `refusal()` throws otherwise. */
  readonly remedy: readonly RemedyStep[];
}

/** Thrown when a `Refusal` is itself malformed — a defect in the refusing code, never in
 *  the operator's environment. Distinct from `HandoffRefused` so the two never conflate. */
export class MalformedRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedRefusalError";
  }
}

/** Thrown to abort a handoff, carrying the refusal so a CLI can render it whole. */
export class HandoffRefused extends Error {
  readonly refusal: Refusal;
  constructor(r: Refusal) {
    super(`${r.code}: ${r.what}`);
    this.name = "HandoffRefused";
    this.refusal = r;
  }
}

/**
 * Construct a refusal, VALIDATING that it carries a remedy.
 *
 * This is the whole mechanism behind invariant 4, and it is deliberately a constructor
 * rather than a linter: a rule that lives in a linter can be satisfied by a remedy field
 * containing `""`, and a rule that lives in review is satisfied by nobody looking. Here,
 * the value does not exist.
 */
export function refusal(r: Refusal): Refusal {
  if (r.code.trim() === "") throw new MalformedRefusalError("a refusal must carry a stable, greppable code");
  if (r.what.trim() === "") throw new MalformedRefusalError(`refusal '${r.code}' does not say WHAT it refused`);
  if (r.why.trim() === "") throw new MalformedRefusalError(`refusal '${r.code}' does not say WHY it refused`);
  if (r.remedy.length === 0) {
    throw new MalformedRefusalError(
      `refusal '${r.code}' names no remedy. A refusal that explains why it stopped and leaves the ` +
        "reader with nothing to do next is a dead end, not a guard — it teaches the reader that this " +
        "system stops for reasons they cannot act on, which is how a person learns to route around it. " +
        "State the next act, even when that act is 'ask a human with the authority you lack'.",
    );
  }
  r.remedy.forEach((step, i) => {
    if (step.why.trim() === "") {
      throw new MalformedRefusalError(`refusal '${r.code}' remedy step ${i} does not say what it accomplishes`);
    }
    const hasCommand = step.command !== undefined && step.command.trim() !== "";
    const hasNote = step.note !== undefined && step.note.trim() !== "";
    if (!hasCommand && !hasNote) {
      throw new MalformedRefusalError(
        `refusal '${r.code}' remedy step ${i} ('${step.why}') carries neither a command nor a note — ` +
          "it states an intention and no act. Give the reader something to run, or say plainly what " +
          "non-command thing to do.",
      );
    }
    if (hasCommand && step.command !== undefined && step.command.includes("\n")) {
      throw new MalformedRefusalError(
        `refusal '${r.code}' remedy step ${i} spans multiple lines. A remedy command is meant to be ` +
          "pasted; split a sequence into separate steps so the reader can tell where one act ends.",
      );
    }
  });
  return r;
}

/** Construct-and-throw, for the common case. Returns `never` so control flow narrows. */
export function refuseWith(r: Refusal): never {
  throw new HandoffRefused(refusal(r));
}

const RULE = "─".repeat(74);

/**
 * The operator-facing refusal block. Deliberately shaped so the remedy is the LAST thing on
 * screen and therefore the thing still visible after a long stack trace scrolled past — the
 * reader's eye lands on the act, not on the complaint.
 */
export function renderRefusal(r: Refusal): string {
  const lines: string[] = [
    RULE,
    "  REFUSED — this stopped on purpose, and there is a way forward.",
    RULE,
    `  CODE        ${r.code}`,
    `  WHAT        ${r.what}`,
    `  WHY         ${r.why}`,
    "",
    "  TO PROCEED:",
  ];
  r.remedy.forEach((step, i) => {
    lines.push(`    ${i + 1}. ${step.why}`);
    if (step.command !== undefined && step.command.trim() !== "") lines.push(`         $ ${step.command}`);
    if (step.note !== undefined && step.note.trim() !== "") lines.push(`         ${step.note}`);
  });
  lines.push(RULE, "");
  return lines.join("\n");
}

/** The refusal codes this module itself raises. Exported so a consumer can branch on the
 *  class of stop, and so a NAMED ESCAPE can reference one without a string literal drifting. */
export const HANDOFF_REFUSAL_CODES = {
  /** A required secret was not present in the store. */
  secretAbsent: "secret-absent",
  /** A plan carried a secret placeholder with no value — the act would prompt after approval. */
  underspecified: "plan-underspecified",
  /** The plan's redaction could not be verified to cover every secret it carries. */
  redactionIncomplete: "redaction-incomplete",
  /** The operation this handoff names is not classified as needing a human at all. */
  notAGatedOperation: "not-a-gated-operation",
  /** A measured before/after reading contradicted what the caller expected. */
  unexpectedStateChange: "unexpected-state-change",
} as const;

// ============================================================================
// INVARIANT 1 — THE AGENT NEVER HOLDS THE SECRET
// ============================================================================

/**
 * A secret value, resolved from a store, wrapped so that the leak path that ACTUALLY
 * happens is closed by the type.
 *
 * The realistic leak is not an agent deciding to print a password. It is a template
 * literal — `` `${program} ${args.join(" ")}` `` in a log line, an error message, a
 * `JSON.stringify` of an options object landing in a crash report. Every one of those goes
 * through `toString` or `toJSON`, and both of those here return `<redacted>`.
 *
 * `reveal()` is the single deliberate exit. It is a method call and it is greppable, which
 * is the property that matters: `rg 'reveal()'` enumerates every place in the repo where a
 * secret becomes a plain string, and that list is short enough to read.
 *
 * LIMIT, STATED: this is a HYGIENE type, not a security boundary. The value is in process
 * memory and anything with code execution in this process can read it. It stops accidents,
 * which is what the incident history is made of; it stops no attacker.
 */
export class Secret {
  readonly #value: string;
  /** Where this came from, for the readout. Never the value. */
  readonly origin: string;

  constructor(value: string, origin: string) {
    this.#value = value;
    this.origin = origin;
  }

  /** The one deliberate exit. Greppable on purpose. */
  reveal(): string {
    return this.#value;
  }

  /** True when the store returned an empty value — a present-but-useless credential. */
  get isEmpty(): boolean {
    return this.#value === "";
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  /** Node's `util.inspect` / `console.log` path, which does NOT go through `toString`. */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `Secret(${this.origin}) ${REDACTED}`;
  }
}

export const REDACTED = "<redacted>";

/**
 * A description of a store that ALREADY EXISTS. This module adds no store; it needs to
 * know two things about one — how to read a value out of it, and, crucially, THE EXACT
 * SENTENCE A HUMAN SHOULD BE TOLD when the value is not there.
 *
 * `storeRemedy` is the field this whole file was written for. A remedy that is wrong is
 * worse than none: it costs the reader the time to run it, the time to work out why it
 * failed, and some of their trust that this system's instructions are worth following.
 * So a `SecretSource` is expected to carry a command someone has actually run.
 */
export interface SecretSource {
  /** Short human name of the store, e.g. `"1Password (Zeta service account)"`. */
  readonly storeName: string;
  /** How to READ the value. Injected (§13 noninterference) — returns `undefined` when
   *  absent, and MUST NOT throw on a missing value (absence is an answer, not an error). */
  readonly read: (ref: string) => string | undefined;
  /** The remedy steps shown when `read` returns nothing. Must be non-empty; a source that
   *  cannot say how to populate it is a source that produces dead ends. */
  readonly storeRemedy: (ref: string) => readonly RemedyStep[];
}

/** What a privileged act needs, declared before anything is run. */
export interface SecretRequirement {
  /** The reference the store understands — an env var name, a vault item path, a keychain
   *  service name. Whatever `SecretSource.read` takes. */
  readonly ref: string;
  /** What this credential is FOR, in the operator's terms. Appears in the refusal, so it is
   *  how the reader knows which of several credentials is missing. */
  readonly purpose: string;
}

export type SecretResolution =
  | { readonly ok: true; readonly secret: Secret }
  | { readonly ok: false; readonly refusal: Refusal };

/**
 * Resolve a declared secret from a store, or refuse WITH THE REMEDY THE STORE SUPPLIED.
 *
 * Note what does not happen here: the value is never returned as a bare string, never
 * logged, and never defaulted. An absent credential produces a refusal, not an empty
 * string that flows onward and fails later at a point where the cause is invisible.
 */
export function resolveSecret(requirement: SecretRequirement, source: SecretSource): SecretResolution {
  const raw = source.read(requirement.ref);
  if (raw === undefined || raw === "") {
    return {
      ok: false,
      refusal: refusal({
        code: HANDOFF_REFUSAL_CODES.secretAbsent,
        what: `refusing to proceed: the credential for ${requirement.purpose} is not in ${source.storeName}`,
        why:
          "an agent must not hold this value and must not ask for it interactively, so it can only " +
          "come from the store. Proceeding without it would either fail later at a point where the " +
          "cause is invisible, or push a prompt behind the approval gate — which would have the " +
          "operator approving an act whose authentication had not happened yet.",
        remedy: source.storeRemedy(requirement.ref),
      }),
    };
  }
  return { ok: true, secret: new Secret(raw, `${source.storeName}:${requirement.ref}`) };
}

/**
 * The environment as a store — the LEAST GOOD source, provided because it is what most
 * existing call sites use and a migration needs somewhere to stand.
 *
 * Named honestly: an env var is not a store. It has no access control of its own, it is
 * inherited by every child process, and it appears in `ps e` and in crash dumps. Its one
 * virtue is that a real store can populate it for the life of one command, which is what
 * the `storeRemedy` here tells the reader to do.
 */
export function environmentSecretSource(args: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly storeRemedy: (ref: string) => readonly RemedyStep[];
}): SecretSource {
  return {
    storeName: "the process environment",
    read: (ref) => args.env[ref],
    storeRemedy: args.storeRemedy,
  };
}

/**
 * The OS keystore as a store — the repo's real one, and the source this module was written
 * to be able to point at.
 *
 * `ref` is a Keychain SERVICE NAME (a flat label; there is no vault and no namespace
 * prefix — the convention is `zeta-*`). Reading goes through
 * `src/Core.TypeScript/secrets/keychain-macos.ts`, which is injected here rather than
 * imported so that a test can describe a host with any item present or absent, and so this
 * package does not acquire a hard dependency on the macOS-only path.
 *
 * ── THE REMEDY IS THE POINT, AND IT WAS VERIFIED RATHER THAN GUESSED ────────────────
 *
 * The command below is transcribed from `tools/setup/secret-clip.sh`'s own `usage()`
 * (which prints lines 11–18 of itself, so the spelling cannot drift from the parser):
 *
 *     secret-clip.sh set <name> [--clipboard] [--clear-clipboard]
 *
 * Subcommands are exactly `set` / `get` / `del` — there is no `put`, no `store`, no
 * `list`, and both positionals are mandatory. A remedy that named a subcommand this script
 * does not have would cost the reader the time to run it, the time to work out why it
 * failed, and some of their willingness to follow the next instruction this system gives
 * them. That is why a wrong remedy is worse than none, and why this one names a verb the
 * script's own usage text prints.
 *
 * KNOWN LIMITS, both real and both already tracked in the repo:
 *  - macOS only. `secret-clip.sh` prints "PLANNED, not yet implemented" and exits 3 on
 *    Linux (`secret-tool`) and Windows (DPAPI).
 *  - Items stored to date carry an ACL naming only `security(1)`, so in-process reads
 *    return `errSecAuthFailed` and fall back to the deputy. That is reported in `via`,
 *    never silently — see workitem 081M01028VF087G0R001W0VD0B.
 */
export function keychainSecretSource(args: {
  /** Injected reader (§13 noninterference). In production, wrap
   *  `readGenericPassword(service)` from `src/Core.TypeScript/secrets/keychain-macos.ts`. */
  readonly read: (service: string) => string | undefined;
  /** Extra steps appended after the store command — e.g. how to get the stored value into
   *  the environment variable a legacy call site still reads. */
  readonly thenAlso?: (ref: string) => readonly RemedyStep[];
}): SecretSource {
  return {
    storeName: "the OS keystore (macOS login Keychain)",
    read: args.read,
    storeRemedy: (ref) => [
      {
        why: `store the credential under the keystore name '${ref}' (it never touches this transcript)`,
        command: `tools/setup/secret-clip.sh set ${ref} --clipboard --clear-clipboard`,
        note: "omit --clipboard to type it into a native secure dialog instead; --clear-clipboard wipes it afterwards. Run from the repo root. macOS today; Linux and Windows backends are declared PLANNED and exit 3.",
      },
      {
        why: "confirm it is there without printing it",
        command: `tools/setup/secret-clip.sh get ${ref} >/dev/null && echo present`,
      },
      ...(args.thenAlso?.(ref) ?? []),
    ],
  };
}

// ============================================================================
// INVARIANTS 2 + 3 — FULLY SPECIFIED BEFORE APPROVAL; AUTH BEFORE APPROVAL
// ============================================================================

/**
 * ── SCOPE, NARROWED AFTER ADVERSARIAL REVIEW (2026-08-26) ────────────────────────────
 *
 * The general property is **shown ≡ executed**: whatever the operator reads must be
 * DERIVED from the object the act consumes, never authored beside it. The general
 * MECHANISM for that in this package is already `ceremony-brief.ts`'s
 * `CeremonySubject {label, value}` list, and it predates this module.
 *
 * What follows is the SUBPROCESS SPECIALISATION of that property, and nothing more. It
 * was extracted from a `yubihsm-shell` invocation and it is argv-shaped, which two of the
 * three ceremonies this repo already classifies cannot use: `publish.ts` posts a JSON body
 * to GitHub and `revoke.ts` calls an injected effect. Both correctly reach for
 * `CeremonySubject` instead.
 *
 * That is recorded here rather than fixed by generalising, because building a second
 * general consent surface would FORK THE THING THE HUMAN READS — one consent surface with
 * two authorings is exactly the drift this invariant exists to prevent. A non-subprocess
 * act uses `assertFullySpecified` below (which is act-shape-agnostic) for the ordering
 * guarantee, and `ceremony-brief.ts` for the display.
 */

/**
 * One argument of a planned command. A `Secret` here is revealed into `argv` and redacted
 * in `displayArgv` — by the SAME pass over the SAME array, which is what makes drift
 * between the two impossible rather than merely unlikely.
 */
export type PlanArg = string | Secret;

export interface HandoffPlan {
  /** The gated operation, from the CLOSED set. Not extended here — see the header. */
  readonly operation: FederatedIdentityOperation;
  readonly program: string;
  /** What is actually executed. Contains revealed secrets — never print this. */
  readonly argv: readonly string[];
  /** What the human is shown. Secrets are REPLACED, not omitted, so the command's shape
   *  stays legible and the reader can see there is a credential and where it goes. */
  readonly displayArgv: readonly string[];
  /** For the readout: `program displayArgv...`, safe to print anywhere. */
  readonly displayCommand: string;
}

/**
 * Build a plan, refusing the two ways an act reaches a human under-specified.
 *
 * ── WHY AN EMPTY SECRET IS A REFUSAL AND NOT A PROMPT ────────────────────────────────
 *
 * The tempting alternative is to prompt for the missing credential at the point it is
 * needed. That produces this sequence:
 *
 *     brief shown  →  human approves  →  program starts  →  program asks for a password
 *
 * and the human's approval was given BEFORE the authentication existed. They approved a
 * sentence; what ran was that sentence plus a credential they had not yet supplied and
 * whose prompt they cannot distinguish from any other. Authentication and approval are two
 * separate human acts and the ORDER IS LOAD-BEARING: auth first, then a fully-specified act,
 * then approval. Reversing them makes the approval unevaluable, and an unevaluable approval
 * is the one this repo already refuses to raise (`ceremony-brief.ts`).
 *
 * ── LIMIT, STATED ────────────────────────────────────────────────────────────────────
 *
 * This sees the arguments it is given. A program that fetches a credential by some route
 * this module was never shown — a config file, an agent socket, an interactive fallback
 * inside the binary — will pass this check and still prompt. That is a CALL SITE
 * obligation: pass the credential explicitly, and prefer programs that fail rather than
 * prompt when it is absent.
 */
export function specifySubprocessPlan(args: {
  readonly operation: FederatedIdentityOperation;
  readonly program: string;
  readonly args: readonly PlanArg[];
}): HandoffPlan {
  const classification = ceremonyRequirementFor(args.operation);
  if (classification.requirement !== "biometric-ceremony") {
    refuseWith({
      code: HANDOFF_REFUSAL_CODES.notAGatedOperation,
      what: `refusing to build a handoff plan for '${args.operation}'`,
      why:
        `ceremony-gate.ts classifies it '${classification.requirement}' — ${classification.reason}. ` +
        "A handoff plan exists to be approved by a human; building one for routine work trains the " +
        "operator to approve routine work, which is precisely what makes the real ceremonies unreadable.",
      remedy: [
        {
          why: "run it as ordinary unattended work — no plan, no brief, no gate",
          note: "this operation is already authorized; call it directly.",
        },
        {
          why: "or, if it genuinely needs a human, reclassify it where the decision is reviewable",
          note: "edit the classification in src/Core.TypeScript/federated-identity/ceremony-gate.ts and state the reason there, so the judgement can be reviewed rather than being invented at the prompt.",
        },
      ],
    });
  }
  if (args.program.trim() === "") {
    refuseWith({
      code: HANDOFF_REFUSAL_CODES.underspecified,
      what: "refusing to build a plan with no program",
      why: "the operator would be shown an act with no verb.",
      remedy: [{ why: "name the program the plan executes", note: "pass a non-empty `program`." }],
    });
  }

  const argv: string[] = [];
  const displayArgv: string[] = [];
  for (const [i, a] of args.args.entries()) {
    if (typeof a === "string") {
      argv.push(a);
      displayArgv.push(a);
      continue;
    }
    if (a.isEmpty) {
      refuseWith({
        code: HANDOFF_REFUSAL_CODES.underspecified,
        what: `refusing to build a command whose credential (argument ${i}, from ${a.origin}) is empty`,
        why:
          "the program would prompt for it interactively, AFTER the operator had already approved — " +
          "so the operator would be approving an act whose authentication had not happened yet. " +
          "Authentication and approval are two separate human acts and the order is load-bearing.",
        remedy: [
          {
            why: "put the credential in the store this plan reads from, then re-run",
            note: `the resolver reported its origin as ${a.origin}; that source's own refusal names the exact command to store it.`,
          },
          {
            why: "if the credential is genuinely unavailable, stop here rather than approving",
            note: "declining costs nothing: no plan is executed and no state changes.",
          },
        ],
      });
    }
    argv.push(a.reveal());
    displayArgv.push(REDACTED);
  }

  const displayCommand = `${args.program} ${displayArgv.join(" ")}`.trim();
  // Invariant 3, checked rather than trusted. The two arrays are built by one pass, so a
  // length mismatch is impossible by construction — which is exactly why asserting it here
  // would be a check that cannot fail. What CAN fail, and is therefore worth checking, is a
  // secret's plaintext surviving into the display projection: that happens the moment
  // somebody passes `secret.reveal()` as a plain string arg instead of passing the `Secret`.
  //
  // SUBSTRING, not array-element equality. The first draft used `displayArgv.includes(value)`,
  // which found the credential only when it was an argument ENTIRELY BY ITSELF. Adversarial
  // review, 2026-08-26: the ordinary way people pass a flag is `--pw=${s.reveal()}`, a
  // distinct string that the equality check reports clean while shipping the credential to
  // the operator's terminal. A guard that misses the common spelling is a guard that reads
  // as protection and is not.
  const revealed = args.args.filter((a): a is Secret => a instanceof Secret).map((s) => s.reveal());
  for (const value of revealed) {
    // Short values are skipped deliberately, and the threshold is stated rather than tuned
    // silently: a 1–3 character secret occurs as a substring of ordinary arguments by
    // chance, so scanning for it would refuse every plan and train callers to route around
    // this check. A credential that short has a bigger problem than its rendering.
    if (value.length < 4) continue;
    if (!displayCommand.includes(value)) continue;
    refuseWith({
      code: HANDOFF_REFUSAL_CODES.redactionIncomplete,
      what: "refusing to produce a plan whose operator-facing command contains a credential in plaintext",
      why:
        "a secret reached the display projection, which means it was passed as a plain string " +
        "somewhere as well as a Secret. The brief is printed to a terminal and lands in logs and " +
        "CI transcripts, so this would disclose the credential to everyone who can read them.",
      remedy: [
        {
          why: "pass the credential as the `Secret` itself, never as `secret.reveal()`",
          note: "a `Secret` argument is redacted automatically; a revealed string is indistinguishable from any other argument and cannot be.",
        },
        {
          why: "for a `--flag=value` spelling, split it into two arguments",
          note: 'use `["--password", secret]` rather than `` [`--password=${secret.reveal()}`] `` — the two-argument form is what lets the redaction see the boundary.',
        },
      ],
    });
  }
  return { operation: args.operation, program: args.program, argv, displayArgv, displayCommand };
}

/**
 * The ACT-SHAPE-AGNOSTIC half of invariants 2 and 3, for the acts that are not subprocess
 * invocations — an HTTP request, an injected effect, a library call.
 *
 * Every credential the act will need must be resolved and non-empty BEFORE the operator is
 * asked. That is the whole of the ordering guarantee, stated without reference to argv:
 * authentication first, then a fully-specified act, then approval.
 *
 * ── WHAT THIS CANNOT DO, STATED PLAINLY ─────────────────────────────────────────────
 *
 * It sees the credentials it is HANDED. `ssh-keygen`, `gpg`, `op` and `yubihsm-shell` all
 * prompt on a tty regardless of what was passed, and a library may read a config file this
 * module was never shown. So this refuses the case where the credential is knowably absent;
 * it cannot prove no prompt will appear. Prefer programs that FAIL rather than prompt when a
 * credential is missing, and run ceremonies with stdin closed where the program honours it.
 */
export function assertFullySpecified(args: {
  readonly operation: FederatedIdentityOperation;
  readonly secrets: readonly Secret[];
}): void {
  const classification = ceremonyRequirementFor(args.operation);
  if (classification.requirement !== "biometric-ceremony") {
    refuseWith({
      code: HANDOFF_REFUSAL_CODES.notAGatedOperation,
      what: `refusing to prepare a human handoff for '${args.operation}'`,
      why: `ceremony-gate.ts classifies it '${classification.requirement}' — ${classification.reason}.`,
      remedy: [
        { why: "run it as ordinary unattended work", note: "this operation is already authorized." },
        {
          why: "or reclassify it where the decision is reviewable",
          note: "edit src/Core.TypeScript/federated-identity/ceremony-gate.ts and record the reason there.",
        },
      ],
    });
  }
  for (const s of args.secrets) {
    if (!s.isEmpty) continue;
    refuseWith({
      code: HANDOFF_REFUSAL_CODES.underspecified,
      what: `refusing to raise a ceremony while the credential from ${s.origin} is empty`,
      why:
        "the act would have to obtain it AFTER the operator approved, so the operator would be " +
        "approving an act whose authentication had not happened yet. Authentication and approval " +
        "are two separate human acts and the order is load-bearing.",
      remedy: [
        {
          why: "put the credential in the store this act reads from, then re-run",
          note: `its origin was recorded as ${s.origin}; that source's own refusal names the exact command to store it.`,
        },
        {
          why: "if the credential is genuinely unavailable, stop rather than approving",
          note: "declining costs nothing: no act is performed and no state changes.",
        },
      ],
    });
  }
}

// ============================================================================
// THE LADDER — "one approved command away" is not "broken"
// ============================================================================

/**
 * Three rungs, because a boolean cannot tell an operator the one thing they most need to
 * know. Measured on the working instance, 2026-08-26: a factory-fresh device reported the
 * same exit status as a dead one, and *"you have one approved command left to run"* is the
 * ordinary state of new hardware.
 *
 *   ready      — the prerequisite is satisfied; the caller can proceed
 *   actionable — the subject ANSWERED and lacks the prerequisite. EXPECTED. One act away.
 *   blocked    — something is actually wrong. `stage` names WHICH, and each stage carries
 *                its own refusal, hence its own remedy.
 *
 * The rule that keeps `actionable` honest: it must be reachable ONLY by completing every
 * check that could have failed. A check that could not RUN never wears the answer of a
 * check that ran and said no.
 */
export type Readiness<TStage extends string> =
  | { readonly rung: "ready"; readonly detail: string }
  | { readonly rung: "actionable"; readonly detail: string; readonly nextAct: readonly RemedyStep[] }
  | { readonly rung: "blocked"; readonly stage: TStage; readonly refusal: Refusal };

/**
 * The exit-code mapping, as a total function so it is testable rather than scattered.
 *
 * `3` is the point: a distinct, greppable status for *expected, actionable, not broken*. A
 * caller that collapses it into `1` has thrown away the whole distinction — so the mapping
 * lives here, once.
 */
export function readinessExitCode(r: Readiness<string>): 0 | 1 | 3 {
  switch (r.rung) {
    case "ready":
      return 0;
    case "actionable":
      return 3;
    case "blocked":
      return 1;
  }
}

/** Construct a `blocked` rung, validating the refusal — so no stage can be added without
 *  someone writing down what to do about it. This is invariant 4 reaching the ladder. */
export function blocked<TStage extends string>(stage: TStage, r: Refusal): Readiness<TStage> {
  return { rung: "blocked", stage, refusal: refusal(r) };
}

/** Construct an `actionable` rung. `nextAct` is validated by the same rules as a remedy:
 *  the middle rung's entire value is that it says what the one remaining act IS. */
export function actionable<TStage extends string>(detail: string, nextAct: readonly RemedyStep[]): Readiness<TStage> {
  // Reuse the refusal validator rather than duplicating its rules — an `actionable` rung
  // with no next act is the same defect as a refusal with no remedy, and must not have a
  // second, weaker set of checks. The throwaway refusal is never surfaced.
  refusal({ code: "actionable", what: detail, why: "middle rung", remedy: nextAct });
  return { rung: "actionable", detail, nextAct };
}

/** Render a rung for an operator. `blocked` delegates to `renderRefusal`, so a blocked
 *  ladder and a refused plan look the same to the reader — the remedy is in the same place. */
export function renderReadiness(title: string, r: Readiness<string>): string {
  if (r.rung === "blocked") {
    return [RULE, `  ${title}`, `  STATE       blocked — this is a real failure, not a missing prerequisite.`, `  STAGE       ${r.stage}`, ""].join("\n") + renderRefusal(r.refusal);
  }
  const lines: string[] = [RULE, `  ${title}`, RULE, `  STATE       ${r.rung}`, `  DETAIL      ${r.detail}`];
  if (r.rung === "ready") {
    lines.push("  NEXT        Nothing. The prerequisite is satisfied.");
  } else {
    lines.push("  NEXT        EXPECTED. This is not a failure. One act remains:");
    r.nextAct.forEach((step, i) => {
      lines.push(`                ${i + 1}. ${step.why}`);
      if (step.command !== undefined && step.command.trim() !== "") lines.push(`                   $ ${step.command}`);
      if (step.note !== undefined && step.note.trim() !== "") lines.push(`                   ${step.note}`);
    });
  }
  lines.push(RULE, "");
  return lines.join("\n");
}

// ============================================================================
// INVARIANT 5 — BEFORE/AFTER STATE IS MEASURED
// ============================================================================

/**
 * The reading taken around an act. Both observations are carried, so a caller reporting
 * "nothing changed" is quoting a measurement rather than restating an assumption.
 *
 * The failure this prevents is small and extremely common: a dry run that reports the
 * device untouched because dry runs do not touch devices. That sentence is true and it is
 * not evidence — it is the conclusion assumed. Reading the state before and after turns it
 * into a claim that could have come out the other way, which is the only kind of claim
 * worth printing.
 */
export interface MeasuredAround<TState, TResult> {
  readonly before: TState;
  readonly after: TState;
  readonly changed: boolean;
  readonly result: TResult;
}

/**
 * Thrown when the act failed, carrying the readings taken around the failure.
 *
 * ── WHY THIS TYPE EXISTS (a defect found in adversarial review, 2026-08-26) ──────────
 *
 * The first draft of `measureAround` took an after-reading in its `catch`, compared it,
 * and then threw the original error down BOTH branches of the comparison. The reading was
 * computed and discarded, and a comment claimed "the caller's log now has the fact that
 * state moved" — nothing was logged, attached, or returned. It was a dead branch that a
 * mutation test could have deleted entirely without failing anything: the vacuity class,
 * inside the module written to abolish it, guarding the exact case (a half-done privileged
 * act) that invariant 5 exists for.
 *
 * The `message` deliberately BEGINS with the cause's message, so existing `toThrow(...)`
 * assertions and log greps keep matching, and the measured fact is appended rather than
 * substituted.
 */
export class MeasuredActFailure<TState> extends Error {
  readonly before: TState;
  readonly after: TState;
  readonly changed: boolean;
  constructor(cause: unknown, readings: { before: TState; after: TState; changed: boolean }) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `${causeMessage} — measured around the failure: state ${
        readings.changed
          ? "CHANGED, so the act may be HALF-DONE; do not retry blindly"
          : "unchanged, so the act did not take effect"
      }`,
      { cause },
    );
    this.name = "MeasuredActFailure";
    this.before = readings.before;
    this.after = readings.after;
    this.changed = readings.changed;
  }
}

/**
 * Run `act` between two readings of `probe`, and report both plus whether they differ.
 *
 * `probe` MAY be async. It was synchronous in the first draft, which silently excluded
 * every act whose state lives somewhere you have to ask over a network — a cloud token, a
 * remote KRL, a database — i.e. most of the cases this protocol claims to cover. That was
 * an artifact of the local-hardware instance it was extracted from.
 *
 * `sameState` decides what "unchanged" means; the default is `Object.is`, which is right
 * for a primitive reading (a key handle, a count, a hash) and WRONG for a freshly-allocated
 * object. A caller comparing structures MUST supply a comparator — the default reports
 * every run as changed, and a signal that is always on carries no information.
 *
 * The probe runs even when the act throws, and the readings are CARRIED on the thrown
 * `MeasuredActFailure`: "it failed and left the state alone" and "it failed halfway
 * through" are different outcomes, and the second is the worst one to discover late.
 */
export async function measureAround<TState, TResult>(args: {
  readonly probe: () => TState | Promise<TState>;
  readonly act: () => Promise<TResult> | TResult;
  readonly sameState?: (a: TState, b: TState) => boolean;
}): Promise<MeasuredAround<TState, TResult>> {
  const same = args.sameState ?? Object.is;
  const before = await args.probe();
  let result: TResult;
  try {
    result = await args.act();
  } catch (err) {
    const after = await args.probe();
    throw new MeasuredActFailure(err, { before, after, changed: !same(before, after) });
  }
  const after = await args.probe();
  return { before, after, changed: !same(before, after), result };
}

/** Render a state reading for an operator without producing `[object Object]`, which is
 *  what the remedy below printed before review caught it — a remedy that shows the reader
 *  nothing is the dead end this module exists to abolish, in miniature. */
function describeState(v: unknown): string {
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") {
    return String(v);
  }
  if (v === null || v === undefined) return String(v);
  try {
    return JSON.stringify(v) ?? Object.prototype.toString.call(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}

/**
 * Assert a measured reading matches what the caller expected, refusing WITH a remedy when
 * it does not. Chiefly for the dry-run claim: a plan that says it touched nothing should be
 * able to prove it.
 */
export function expectMeasured<TState, TResult>(
  m: MeasuredAround<TState, TResult>,
  expectation: { readonly changed: boolean; readonly subject: string },
): void {
  if (m.changed === expectation.changed) return;
  refuseWith({
    code: HANDOFF_REFUSAL_CODES.unexpectedStateChange,
    what: `measured state of ${expectation.subject} ${m.changed ? "CHANGED" : "did not change"}, and the caller expected the opposite`,
    why: expectation.changed
      ? "the act was supposed to change this and did not, so it either did nothing or wrote somewhere else. Reporting success here would assert an effect nobody observed."
      : "the act was supposed to leave this alone. A privileged operation that moved state it declared it would not move is the one outcome that must never be discovered later.",
    remedy: [
      {
        why: "read the before/after values recorded on the outcome and decide which one is wrong",
        note: `before=${describeState(m.before)} after=${describeState(m.after)}`,
      },
      {
        why: "if the probe is comparing freshly-allocated objects, supply `sameState`",
        note: "the default comparator is `Object.is`; structural readings need an explicit comparator or every run reports a change.",
      },
    ],
  });
}

// ============================================================================
// INVARIANT 6 — THE ESCAPE HATCH IS EXPLICIT AND NAMED
// ============================================================================

/**
 * A single, named lift of a SINGLE refusal code.
 *
 * ── WHY THIS IS NOT A FLAG ───────────────────────────────────────────────────────────
 *
 * The shape everyone reaches for is `--force` (or `--admin`, whose earlier finding in this
 * repo is that it is an override BUTTON, not an escape hatch). One flag that lifts every
 * refusal has three properties that make it worse than no gate at all:
 *
 *   1. It is used to get past the refusal the user understands, and silently lifts the
 *      several they have never heard of.
 *   2. It has no scope, so nothing about a system's behaviour under it can be reasoned
 *      about — the set of checks that ran is unknown.
 *   3. It removes the incentive to ever fix a refusal that fires too often, because the
 *      workaround is cheaper than the report.
 *
 * A named escape has none of those: it lifts one code, it carries a reason a reviewer can
 * disagree with, and it names who authorized it. It is also a value, not a flag, so
 * granting one is a code change that shows up in a diff.
 */
export interface NamedEscape {
  /** The ONE refusal code this lifts. A wildcard is refused at construction. */
  readonly liftsCode: string;
  /** Why this specific refusal is not applicable here. Reviewable, and disagreeable-with. */
  readonly reason: string;
  /** Who authorized it. Not a self-assertion by the code requesting the escape: gated
   *  classes need a human, and this field is where that shows. */
  readonly authorizedBy: string;
}

/** A wildcard escape is the override button this type exists to prevent. */
const BLANKET_PATTERNS = new Set(["*", "all", "any", "", "force", "admin"]);

/**
 * Construct an escape, refusing the blanket forms. Note this cannot stop somebody writing
 * out every code by hand — nothing can — but it makes doing so a visible list rather than a
 * single innocuous-looking flag, which is the whole difference.
 */
export function namedEscape(e: NamedEscape): NamedEscape {
  const code = e.liftsCode.trim();
  if (BLANKET_PATTERNS.has(code.toLowerCase())) {
    throw new MalformedRefusalError(
      `'${e.liftsCode}' is a blanket escape, and a blanket escape is not an escape hatch — it is an ` +
        "override button. It lifts the refusal you understand together with every refusal you have " +
        "never heard of, and it leaves nothing that can be reasoned about afterwards. Name the ONE " +
        "refusal code this is for.",
    );
  }
  if (e.reason.trim() === "") {
    throw new MalformedRefusalError(`escape for '${code}' states no reason; an unreviewable escape is an unreviewed one`);
  }
  if (e.authorizedBy.trim() === "") {
    throw new MalformedRefusalError(
      `escape for '${code}' names no authorizer. The shadow may INHERIT standing authority and never ` +
        "EXTEND it into a gated class (.claude/rules/no-directives.md), so an escape with no human " +
        "behind it is exactly the extension that rule forbids.",
    );
  }
  return { liftsCode: code, reason: e.reason, authorizedBy: e.authorizedBy };
}

/** Whether a refusal is lifted, and by which escape. Returns the escape so a caller can
 *  LOG it: an escape that fires silently is an escape nobody reviews. */
export function findEscape(r: Refusal, escapes: readonly NamedEscape[]): NamedEscape | undefined {
  return escapes.find((e) => e.liftsCode === r.code);
}

// ============================================================================
// THE COMPOSED ENTRY POINT — one import, one call, the ordering owned by the body
// ============================================================================
//
// ── WHY THIS EXISTS (adversarial review, round 2, 2026-08-26) ────────────────────────
//
// The parts above were shipped first and the review that followed was blunt about it:
// a consumer would now have to learn FOUR modules — `ceremony-gate` (classify),
// `ceremony-brief` (say), this file (protocol), `biometric` (door) — to perform one act.
// The evidence that this is a tax rather than a saving was already in the tree: the two
// gated call sites this repo has shipped, `publish.ts` and `revoke.ts`, reach for two of
// the four and stop.
//
// The sharper half of the objection is the one that changed the design:
//
//   ── AN ORDERING THAT LIVES IN A DOC IS A CALL-SITE OBLIGATION. AN ORDERING THAT LIVES
//      IN A FUNCTION BODY IS A GUARANTEE. ──────────────────────────────────────────────
//
// Invariant 2 (approval follows authentication) was prose everywhere else in this module:
// a call site could resolve its secrets AFTER prompting and nothing would object. Here it
// cannot, because this function resolves every declared credential, refuses if any is
// absent, and only THEN opens the biometric door. The order is not advice; it is the
// sequence of statements below, and there is no argument that reorders them.
//
// It also fixes the discoverability hole, which review named as the highest-value gap:
// `runGatedCeremony` is one symbol to find, and finding it brings the other five
// invariants along whether or not the caller has read this file.

/** The secrets a ceremony resolved, keyed by the `ref` they were declared under. */
export type ResolvedSecrets = ReadonlyMap<string, Secret>;

export type CeremonyOutcome<TState, TResult> =
  /** Stopped before the human was involved. `refusal` names the remedy. */
  | { readonly kind: "refused"; readonly refusal: Refusal; readonly escapedBy?: NamedEscape }
  /** Planned only. The biometric door was never opened and no state was touched. */
  | { readonly kind: "dry-run"; readonly promptLine: string; readonly before: TState }
  /** The operator was asked and said no. A supported, safe outcome. */
  | { readonly kind: "declined"; readonly reason: string; readonly before: TState }
  /** The act ran. `measured` carries the before/after readings. */
  | { readonly kind: "performed"; readonly measured: MeasuredAround<TState, TResult> };

/**
 * Perform one gated act under the whole protocol.
 *
 * The body IS the protocol, in order, and each step names the invariant it carries:
 *
 *   1. classify        — refuse to prompt for routine work            (ceremony-gate)
 *   2. resolve         — every credential from the store, or refuse   (invariant 1)
 *   3. specify         — nothing left to ask for                      (invariants 2, 3)
 *   4. measure         — read the ground truth BEFORE anything        (invariant 5)
 *   5. dry run?        — return without touching the biometric door
 *   6. brief + gate    — the human authenticates, then approves       (invariant 2)
 *   7. act + measure   — and report a reading, not an assumption      (invariant 5)
 *
 * Every refusal it raises carries a remedy (invariant 4) because they are all built
 * through `refusal()`. `escapes` lifts named refusals only (invariant 6) and the escape
 * that fired is RETURNED so a caller can log it — an escape nobody sees is unreviewed.
 *
 * FAIL-CLOSED: `requireBiometric` returns `ok:false` when no door was injected, so a
 * caller that forgot to wire the gate declines rather than silently acting.
 *
 * WHAT IT STILL CANNOT DO — unchanged from the parts, and worth repeating at the surface
 * most people will use: it cannot stop `act` from prompting internally (prefer programs
 * that FAIL over programs that PROMPT), and it cannot tell a real `probe` from a constant.
 */
export async function runGatedCeremony<TState, TResult>(args: {
  readonly operation: FederatedIdentityOperation;
  /** Short imperative summary in the operator's terms. */
  readonly summary: string;
  /** The concrete objects acted on. Read off the objects `act` consumes, never re-derived
   *  from the request — a second derivation is how the shown act drifts from the done one. */
  readonly subjects: readonly CeremonySubject[];
  /** What is true if the operator declines. Must describe a SAFE, well-handled state. */
  readonly ifDeclined: string;
  /** Credentials the act needs. Resolved BEFORE the prompt — that is the whole point. */
  readonly requires?: readonly SecretRequirement[];
  /** Where credentials come from. Required when `requires` is non-empty. */
  readonly source?: SecretSource;
  /** Read the state this act is supposed to change. Runs before and after. */
  readonly probe: () => TState | Promise<TState>;
  /** The act. Receives the resolved secrets; never reads them from ambient state. */
  readonly act: (secrets: ResolvedSecrets) => Promise<TResult> | TResult;
  /** Default TRUE. A dry run never opens the biometric door, so planning cannot habituate. */
  readonly dryRun?: boolean;
  readonly escapes?: readonly NamedEscape[];
  readonly biometricAuth?: BiometricAuth;
  readonly briefFx?: CeremonyBriefEffects;
  readonly sameState?: (a: TState, b: TState) => boolean;
}): Promise<CeremonyOutcome<TState, TResult>> {
  const escapes = args.escapes ?? [];
  const dryRun = args.dryRun ?? true;

  /** Raise a refusal unless a NAMED escape lifts exactly it. */
  const stop = (r: Refusal): CeremonyOutcome<TState, TResult> | undefined => {
    const escape = findEscape(r, escapes);
    return escape === undefined ? { kind: "refused", refusal: r } : undefined;
  };

  // 1. CLASSIFY. `assertGatedCeremony` throws for an `unattended` operation — prompting
  //    for routine work is what makes the real ceremonies unreadable, so it is not
  //    something a caller may handle its way past.
  assertGatedCeremony(args.operation);

  // 2. RESOLVE every declared credential, BEFORE the human is involved. An absent one
  //    refuses with the STORE's own remedy, which is the sentence the operator can act on.
  const resolved = new Map<string, Secret>();
  for (const requirement of args.requires ?? []) {
    if (args.source === undefined) {
      const halt = stop(
        refusal({
          code: HANDOFF_REFUSAL_CODES.secretAbsent,
          what: `refusing to run '${args.operation}': it declares a credential and no source to read it from`,
          why:
            "the agent must not hold the value, so an act that needs one and names no store has no " +
            "way to obtain it except by asking after approval — which inverts the order this protocol exists to fix.",
          remedy: [
            {
              why: "pass the store the credential lives in",
              note: "e.g. `source: keychainSecretSource({ read })`; see docs/protocols/ai-human-secure-handoff.md §3.1.",
            },
          ],
        }),
      );
      if (halt !== undefined) return halt;
      continue;
    }
    const r = resolveSecret(requirement, args.source);
    if (!r.ok) {
      const halt = stop(r.refusal);
      if (halt !== undefined) return halt;
      continue;
    }
    resolved.set(requirement.ref, r.secret);
  }

  // 3. SPECIFY. Nothing may remain to be asked for once the operator has approved.
  try {
    assertFullySpecified({ operation: args.operation, secrets: [...resolved.values()] });
  } catch (err) {
    if (!(err instanceof HandoffRefused)) throw err;
    const halt = stop(err.refusal);
    if (halt !== undefined) return halt;
  }

  // 4. MEASURE the ground truth before anything is decided.
  const before = await args.probe();

  const brief: CeremonyBrief = {
    operation: args.operation,
    summary: args.summary,
    subjects: args.subjects,
    ifDeclined: args.ifDeclined,
    ...requestedBy(args.briefFx?.requester),
  };
  const promptLine = ceremonyPromptLine(brief);

  // 5. DRY RUN returns here, having never touched the biometric door.
  if (dryRun) return { kind: "dry-run", promptLine, before };

  // 6. BRIEF, then GATE. The block goes to the operator's stream; the prompt is DERIVED
  //    from the same brief, so the two cannot describe different acts.
  args.briefFx?.notify?.(renderCeremonyBrief(brief));
  const approval = await requireBiometric(args.biometricAuth, promptLine);
  if (!approval.ok) {
    return { kind: "declined", reason: approval.reason ?? "the operator declined", before };
  }

  // 7. ACT, and measure again. A failure throws `MeasuredActFailure` carrying the readings,
  //    so "failed and touched nothing" is distinguishable from "failed halfway".
  const after = await args.act(resolved);
  const finalState = await args.probe();
  const same = args.sameState ?? Object.is;
  return {
    kind: "performed",
    measured: { before, after: finalState, changed: !same(before, finalState), result: after },
  };
}
