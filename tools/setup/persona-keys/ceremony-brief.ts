// ceremony-brief.ts — THE LAYER THAT DECIDES WHAT TO SAY, AND WHETHER TO ASK AT ALL.
//
// Aaron, 2026-08-24, on why this file exists — verbatim:
//   *"I was pressing the biometric keys when they popped up, I was assuming it was
//    necessary for the testing."*
//
// That is habituation, and it is the correct response to the prompt he was given. The
// standing position is that the biometric IS the authorization
// (`memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md`),
// and an authorization is a DECISION. A decision needs something to decide about:
//
//   ── YOU CANNOT WITHHOLD CONSENT FROM A PROMPT THAT DOES NOT TELL YOU WHAT YOU ARE
//      CONSENTING TO. ────────────────────────────────────────────────────────────────
//
// Measured on `main` at 3ea8a044b, the operator-facing text for a REVOCATION was the
// bare constant `"revoke SSH device cert (KRL)"` — while the cert path, the CA, the KRL
// and the operator-supplied REASON were all in scope four lines above it. Revoking your
// own laptop's cert and revoking a cert you believe an attacker holds produced BYTE-
// IDENTICAL prompts. There is no finger-press that distinguishes those two acts, so the
// gate could not have been carrying the decision it was claimed to carry.
//
// ── WHAT THIS MODULE IS, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────
//
// It is NOT an authentication mechanism. It never prompts, never runs `sudo`, never
// reads a key. It builds the SENTENCE the existing gate (`biometric.ts`) shows, and it
// refuses to build one for an operation the repo's own policy says needs no ceremony.
// The auth mechanism is `biometric.ts` and is owned elsewhere; this file is strictly the
// "what to say / whether to ask" layer above it.
//
// ── THE PROPERTY THAT MAKES IT SAFE: ONE OBJECT, NOT TWO DERIVATIONS ────────────────
//
// A display layer is the easiest place in a system to reintroduce the exact defect it
// was built to cure. The rotation prompt used to name the ports REQUESTED while the
// dispatcher swapped the ports PERFORMED — two independent derivations of "which port",
// which disagreed, so the operator approved a sentence describing a different act.
//
// So `ceremonyPromptLine` and `renderCeremonyBrief` are PURE FUNCTIONS OF ONE
// `CeremonyBrief` VALUE. A call site constructs exactly one brief, from the same objects
// the action consumes, and passes the DERIVED string to `requireBiometric`. The prompt
// cannot drift from the brief because it is not authored separately — it is computed.
// Whether the brief itself is built from the performed objects rather than the requested
// ones remains the CALL SITE's obligation; this module cannot check that, and says so
// rather than implying a guarantee it does not provide (see VACUITY DISCLOSURE below).
//
// ── FEWER PROMPTS, NOT MORE ─────────────────────────────────────────────────────────
//
// Adding a confirmation to cure habituation makes habituation worse: the operator learns
// a longer reflex. This module therefore adds NO prompt. It carries more information on
// the prompts that already exist, and `assertGatedCeremony` REMOVES prompts by refusing
// to raise one for an operation classified `unattended`.
//
// ── VACUITY DISCLOSURE (read before citing this as a guarantee) ─────────────────────
//
// `renderCeremonyBrief` writes to a TERMINAL. On macOS the Touch ID modal itself is
// rendered by `pam_tid` and its text is fixed by the OS — it says that `sudo` wants to
// authenticate a user, and NOTHING in this file can change that string. So this module
// makes the ceremony evaluable ON THE STREAM THE CEREMONY IS RUN FROM; it does not, and
// cannot, put the operation into the system modal. An operator who sees only the modal
// still learns nothing. That is a real limit of this layer, it is why a ceremony must be
// a deliberate foreground act rather than something that surfaces during routine work,
// and it is recorded here so nobody cites this file as having closed that half.
//
// REGISTER: `unmetered`. The renderer is total and every arm is exercised by falsifiers;
// that a briefed operator actually declines more often is a claim nobody has measured.
//
// Anchors (Beacon): habituation to security warnings — Anderson et al., *"How Polymorphic
// Warnings Reduce Habituation in the Brain"* (CHI 2015); Böhme & Köpsell, *"Trained to
// Accept? A Field Experiment on Consent Dialogs"* (CHI 2010) — consent dialogs shaped like
// routine dialogs get click-through, not consent. Informed consent as comprehension rather
// than signature — Faden & Beauchamp, *A History and Theory of Informed Consent* (1986).
// Closed command set (a peer may NAME an operation, never DEFINE one) —
// `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`.
import {
  ceremonyRequirementFor,
  type CeremonyRequirement,
  type FederatedIdentityOperation,
} from "../../../src/Core.TypeScript/federated-identity/ceremony-gate.ts";

export type { FederatedIdentityOperation, CeremonyRequirement };

/**
 * ONE concrete thing the ceremony acts on — a host, a CA name, a key fingerprint, the
 * list of ports actually being swapped. `value` must be read off the object the action
 * consumes, never re-derived from the request.
 *
 * NOTE the standing prohibition: a subject is PUBLIC-facing text. Never put private key
 * material, a seed, or a passphrase in one. Fingerprints and paths are fine; the bytes
 * they point at are not.
 */
export interface CeremonySubject {
  /** Short operator-facing label, e.g. `"host"`, `"CA"`, `"key fingerprint"`. */
  readonly label: string;
  /** The value, already stringified by the caller from the live object. */
  readonly value: string;
}

/** WHO asked. Resolved from the running process, not declared by the caller — a caller
 *  that could name itself could also name someone else. */
export interface CeremonyRequester {
  /** The command line that raised this ceremony, e.g. `"rotate-cli.ts --user aaron --confirm"`. */
  readonly command: string;
  /** The agent/persona on whose behalf it runs, when the environment declares one. */
  readonly agent?: string;
}

/**
 * Everything the operator needs in order to be able to say NO. One value, built once, at
 * the call site, from the objects the action itself consumes.
 */
export interface CeremonyBrief {
  /** The operation, from the CLOSED set in `ceremony-gate.ts`. Reusing that union rather
   *  than inventing a parallel vocabulary is the point: a new capability must be
   *  classified there before it can be briefed here. */
  readonly operation: FederatedIdentityOperation;
  /** A short imperative summary in the operator's terms, e.g. `"Rotate this host's keys"`. */
  readonly summary: string;
  /** The concrete objects acted on. MUST be non-empty — an operation with no named
   *  subject is precisely the unevaluable prompt this module exists to abolish. */
  readonly subjects: readonly CeremonySubject[];
  /** What is true if the operator declines. MUST be stated, and must describe a SAFE,
   *  well-handled state — if declining is painful, people stop declining. */
  readonly ifDeclined: string;
  /** Who asked. Optional: absent renders as an honest "not resolved", never as a guess. */
  readonly requestedBy?: CeremonyRequester;
}

/** Thrown when a brief is malformed, or when a caller tries to raise a ceremony prompt
 *  for an operation the closed set classifies as `unattended`. */
export class CeremonyBriefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CeremonyBriefError";
  }
}

/**
 * REFUSE TO PROMPT FOR ROUTINE WORK. `ceremony-gate.ts` already decides, as a total
 * function over the closed set, which operations need a human. An `unattended` operation
 * that nonetheless pops a Touch ID dialog is not extra safety — it is the habituation
 * source itself, because it teaches the operator that these dialogs accompany ordinary
 * work and mean nothing.
 *
 * So this throws rather than returning a prompt. A caller cannot "handle" its way past it
 * into a prompt, which is what makes it a reduction in prompt count rather than a warning.
 */
export function assertGatedCeremony(operation: FederatedIdentityOperation): void {
  const classification = ceremonyRequirementFor(operation);
  if (classification.requirement !== "biometric-ceremony") {
    throw new CeremonyBriefError(
      `refusing to raise a biometric prompt for '${operation}': ceremony-gate.ts classifies it ` +
        `'${classification.requirement}' — ${classification.reason}. Prompting for routine work is ` +
        "how an operator learns to approve reflexively; if this operation genuinely needs a human, " +
        "reclassify it in ceremony-gate.ts (where the decision is reviewable) rather than prompting here.",
    );
  }
}

/** Reject a brief that cannot carry a decision. Called by both renderers, so an
 *  unevaluable brief fails at the call site instead of reaching the operator. */
function validate(brief: CeremonyBrief): void {
  if (brief.subjects.length === 0) {
    throw new CeremonyBriefError(
      `ceremony '${brief.operation}' declared no subjects — the operator would be asked to approve ` +
        "an operation without being told what it acts on, which is the unevaluable prompt this " +
        "module exists to prevent. Name the objects the action consumes.",
    );
  }
  for (const s of brief.subjects) {
    if (s.value.trim() === "") {
      throw new CeremonyBriefError(`ceremony '${brief.operation}' subject '${s.label}' is empty`);
    }
  }
  if (brief.ifDeclined.trim() === "") {
    throw new CeremonyBriefError(
      `ceremony '${brief.operation}' did not state what happens if the operator declines. Declining ` +
        "must be a genuine, safe, well-handled outcome, and the operator cannot weigh it unstated.",
    );
  }
  if (brief.summary.trim() === "") {
    throw new CeremonyBriefError(`ceremony '${brief.operation}' has an empty summary`);
  }
}

/**
 * The ONE-LINE prompt handed to `requireBiometric`. Derived from the brief — never
 * authored beside it — so it cannot describe a different act than the block below.
 *
 * Deliberately dense rather than pretty: this is the string that reaches a log, a
 * `--dry-run` readout, and the `reason` of a refusal, and every one of those readers is
 * trying to answer "which operation, on what".
 */
export function ceremonyPromptLine(brief: CeremonyBrief): string {
  validate(brief);
  const subjects = brief.subjects.map((s) => `${s.label}=${s.value}`).join(", ");
  return `${brief.summary} [${brief.operation}] (${subjects})`;
}

/** The injectable environment door (§13 noninterference) — the only channel through which
 *  requester resolution touches the process. Tests describe a process; nothing is ambient. */
export interface RequesterEnv {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
}

/**
 * Resolve WHO is asking from the running process itself. Not a caller-declared string: a
 * caller able to name itself is a caller able to name somebody else, and the whole value
 * of this field is that the operator can tell an expected ceremony from a surprising one.
 *
 * The command is rendered from argv with the interpreter and directories stripped, so it
 * reads as the command the operator would recognise having run. ARGUMENT VALUES ARE KEPT
 * — they are what distinguishes `--user aaron` from `--user someone-else`, and no argv
 * position in these CLIs carries a secret (the seed is read from STDIN only, by design;
 * see this package's `description`).
 */
export function resolveRequester(source: RequesterEnv): CeremonyRequester {
  const [, script, ...rest] = source.argv;
  const name = script === undefined ? "(unknown command)" : (script.split("/").pop() ?? script);
  const agent = source.env["ZETA_AGENT"] ?? source.env["CLAUDE_AGENT"];
  return {
    command: [name, ...rest].join(" ").trim(),
    ...(agent !== undefined && agent.trim() !== "" ? { agent } : {}),
  };
}

/** The real process. The only place in this module that reads ambient state. */
export function realRequester(): CeremonyRequester {
  return resolveRequester({ argv: process.argv, env: process.env });
}

const RULE = "─".repeat(74);

/**
 * The operator-facing block, printed to the ceremony's own stream immediately before the
 * gate fires. Four questions, in the order an operator actually asks them: what is being
 * done, to what, who asked, and what happens if I say no.
 *
 * The classification line quotes `ceremony-gate.ts`'s own recorded REASON. That reason was
 * written when the operation was classified, by whoever drew the line — so the operator is
 * reading the policy's justification, not a restatement invented at the prompt.
 */
export function renderCeremonyBrief(brief: CeremonyBrief): string {
  validate(brief);
  const classification = ceremonyRequirementFor(brief.operation);
  const width = Math.max(...brief.subjects.map((s) => s.label.length));
  const lines: string[] = [
    RULE,
    `  CEREMONY — a human decision is required. Read this before you touch the sensor.`,
    RULE,
    `  OPERATION   ${brief.summary}`,
    `              closed-set id: ${brief.operation}`,
    `  ON          ${brief.subjects.map((s) => `${s.label.padEnd(width)}  ${s.value}`).join("\n              ")}`,
  ];
  if (brief.requestedBy === undefined) {
    lines.push(`  REQUESTED   (not resolved — the caller did not declare a requester)`);
  } else {
    lines.push(`  REQUESTED   ${brief.requestedBy.command}`);
    if (brief.requestedBy.agent !== undefined) {
      lines.push(`              on behalf of agent: ${brief.requestedBy.agent}`);
    }
  }
  lines.push(
    `  IF YOU      ${brief.ifDeclined}`,
    `  DECLINE     Declining is a supported outcome. Nothing is half-done.`,
  );
  // The classification is QUOTED from ceremony-gate.ts, never restated here — the operator
  // reads the justification written when the line was drawn.
  //
  // The `unattended` arm is not decoration. If the closed set says this operation needs no
  // human and a prompt is being raised anyway, the operator is being trained to approve
  // routine work, and that is the defect that produced this whole file. Saying so ON THE
  // PROMPT is the only way the mismatch reaches the person paying for it.
  if (classification.requirement === "biometric-ceremony") {
    lines.push(`  WHY GATED   ${classification.reason}`);
  } else {
    lines.push(
      `  NOT GATED   ceremony-gate.ts classifies this '${classification.requirement}' —`,
      `  (MISMATCH)  ${classification.reason}`,
      `              You are being asked to approve something this repo's own policy says`,
      `              needs no ceremony. That is a defect in the CALLER, not a reason to`,
      `              approve: routine prompts are what make real ones unreadable.`,
    );
  }
  lines.push(RULE, `  To decline: dismiss the dialog, or press Esc. Nothing below this line has run yet.`, RULE, "");
  return lines.join("\n");
}

/**
 * The two doors a call site needs to SHOW a brief — both optional, both injectable
 * (§13 noninterference). A call site that provides neither still gets the improved
 * one-line prompt via `ceremonyPromptLine`; it simply does not print the block.
 *
 * Optional ON PURPOSE. Every existing `*Effects` record in this package is constructed by
 * tests as an object literal, and adding a REQUIRED field to those interfaces would break
 * every one of them — a display change is not permitted to cost a security package its
 * test suite. Absent `notify` degrades to "no block printed", never to "no gate".
 */
export interface CeremonyBriefEffects {
  /** Write the operator-facing block. Real callers pass a stderr writer; tests capture. */
  readonly notify?: (block: string) => void;
  /** Resolve who is asking. Real callers pass `realRequester`; tests describe a process. */
  readonly requester?: () => CeremonyRequester;
}

/**
 * Build the optional `requestedBy` fragment for a brief, spread-style.
 *
 * `tsconfig` runs with `exactOptionalPropertyTypes: true`, under which an optional field and
 * a field explicitly set to `undefined` are DIFFERENT types — so `requestedBy: fx.requester?.()`
 * does not typecheck. That strictness is worth conforming to rather than widening the type:
 * "the caller wired no requester" and "the requester resolved to nothing" are genuinely
 * different states, and this module's whole discipline is that an absent fact renders as
 * absent rather than as a guess.
 *
 * Usage matches the conditional-spread idiom already used across this package:
 *   `...requestedBy(fx.requester)`
 */
export function requestedBy(probe: (() => CeremonyRequester) | undefined): { requestedBy?: CeremonyRequester } {
  if (probe === undefined) return {};
  const resolved = probe();
  return { requestedBy: resolved };
}

/** The real doors: the block goes to STDERR, beside the gate's own `🔐` line, so that
 *  redirecting a ceremony's stdout to a file never silently discards the one text the
 *  operator is supposed to read before touching the sensor. */
export function realBriefEffects(): Required<CeremonyBriefEffects> {
  return {
    notify: (block) => {
      process.stderr.write(block);
    },
    requester: realRequester,
  };
}
