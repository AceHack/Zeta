/**
 * first-session.ts — post-login credential setup for a fresh cluster node.
 *
 * Vertical slice (usb/zflash trajectory): numbered menu (default) or optional
 * `--llm` chooser. GitHub (`gh`) is the first-target required provider for
 * zeta-self-register today — not the only future provider; local-only and
 * other clouds come later. Claude / Codex / Gemini stay optional and appear
 * only after the operator asks for cloud setup (Aaron 2026-07-08).
 *
 * Intentionally NOT merged into the core NextAction union yet — golden-vectors
 * lock nine kinds for cross-language parity. This module is the first-session
 * hat/vertical; observe integration is a follow-up slice.
 *
 * Society validation: S0 pure tests here; S2 install smoke for gh; S6 physical boot.
 *
 * Audience: regular-person tool for non-tech (often neurodivergent) minds that
 * work well with AI — not a tech-nerd console. Wording can iterate; clarity wins.
 */

import { chooseIndex, type ModelBackend } from "../accelerator/local-llm";
import { clampTicks, type TickBudget } from "./tick-budget";

export type CredVendor = "gh" | "claude" | "codex" | "gemini";

export type CredStatus = "missing" | "ready" | "skipped";

export interface NodeSessionState {
  readonly credentials: Readonly<Record<CredVendor, CredStatus>>;
  readonly complete: boolean;
  /** When false, optional cloud helpers stay hidden; local is the default after gh. */
  readonly cloudHelpersOffered: boolean;
}

export type FirstSessionAction =
  | { readonly kind: "setup_credential"; readonly vendor: CredVendor; readonly reason: string }
  | { readonly kind: "skip_credential"; readonly vendor: CredVendor; readonly reason: string }
  | { readonly kind: "skip_optional_credentials"; readonly reason: string }
  | { readonly kind: "offer_cloud_helpers"; readonly reason: string }
  | { readonly kind: "use_local_llm_only"; readonly reason: string }
  | { readonly kind: "complete_first_session"; readonly reason: string };

const VENDORS: readonly CredVendor[] = ["gh", "claude", "codex", "gemini"];

const OPTIONAL_VENDORS: readonly CredVendor[] = ["claude", "codex", "gemini"];

const VENDOR_LABELS: Readonly<Record<CredVendor, string>> = {
  gh: "GitHub sign-in",
  claude: "Claude (cloud)",
  codex: "Codex (cloud)",
  gemini: "Gemini (cloud)",
};

export const GH_REGISTER_REASON =
  "needed so this computer can join the cluster (first target today; more providers later)";

/** Shown when the operator skips GitHub — how to finish later without being stuck. */
export const GH_SKIP_CONTINUE_LATER =
  "you can finish GitHub later on this computer (local console) or over SSH, then join the cluster";

export const OPTIONAL_CRED_REASON: Readonly<Record<CredVendor, string>> = {
  gh: GH_REGISTER_REASON,
  claude: "optional cloud helper — only if you asked for cloud setup",
  codex: "optional cloud helper — only if you asked for cloud setup",
  gemini: "optional cloud helper — only if you asked for cloud setup",
};

export function defaultNodeSession(): NodeSessionState {
  return {
    credentials: { gh: "missing", claude: "missing", codex: "missing", gemini: "missing" },
    complete: false,
    cloudHelpersOffered: false,
  };
}

export function missingVendors(session: NodeSessionState): readonly CredVendor[] {
  return VENDORS.filter((v) => session.credentials[v] === "missing");
}

export function optionalStillMissing(session: NodeSessionState): readonly CredVendor[] {
  return OPTIONAL_VENDORS.filter((v) => session.credentials[v] === "missing");
}

/** Pure oracle: gh first; then stay local by default; cloud only after offer. */
export function firstSessionOracle(session: NodeSessionState): FirstSessionAction {
  if (session.complete) {
    return { kind: "complete_first_session", reason: "first login already finished" };
  }
  if (session.credentials.gh === "missing") {
    return { kind: "setup_credential", vendor: "gh", reason: GH_REGISTER_REASON };
  }
  if (!session.cloudHelpersOffered) {
    return {
      kind: "use_local_llm_only",
      reason: "Stay on this computer (local) — recommended; cloud helpers are optional",
    };
  }
  const nextOptional = optionalStillMissing(session)[0];
  if (nextOptional !== undefined) {
    return {
      kind: "setup_credential",
      vendor: nextOptional,
      reason: OPTIONAL_CRED_REASON[nextOptional],
    };
  }
  return {
    kind: "complete_first_session",
    reason: "You are done — this computer can keep working",
  };
}

/** Numbered menu: plain language; cloud vendors hidden until offer_cloud_helpers. */
export function buildFirstSessionMenu(session: NodeSessionState): FirstSessionAction[] {
  if (session.complete) {
    return [{ kind: "complete_first_session", reason: "first login already finished" }];
  }

  const lead = firstSessionOracle(session);
  const candidates: FirstSessionAction[] = [];

  if (session.credentials.gh === "missing") {
    candidates.push({
      kind: "setup_credential",
      vendor: "gh",
      reason: OPTIONAL_CRED_REASON.gh,
    });
    candidates.push({
      kind: "skip_credential",
      vendor: "gh",
      reason: GH_SKIP_CONTINUE_LATER,
    });
  }

  if (session.credentials.gh !== "missing" && !session.cloudHelpersOffered) {
    candidates.push({
      kind: "use_local_llm_only",
      reason: "Stay on this computer (local) — recommended",
    });
    candidates.push({
      kind: "offer_cloud_helpers",
      reason: "Show optional cloud helpers (Claude / Codex / Gemini)",
    });
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login",
    });
  }

  if (session.cloudHelpersOffered && optionalStillMissing(session).length > 0) {
    for (const vendor of optionalStillMissing(session)) {
      candidates.push({
        kind: "setup_credential",
        vendor,
        reason: OPTIONAL_CRED_REASON[vendor],
      });
      candidates.push({
        kind: "skip_credential",
        vendor,
        reason: `skip ${VENDOR_LABELS[vendor]} for now; stay local and add later`,
      });
    }
    candidates.push({
      kind: "skip_optional_credentials",
      reason: "Skip all optional cloud helpers; stay local",
    });
    candidates.push({
      kind: "use_local_llm_only",
      reason: "Use only what is on this computer (local)",
    });
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login",
    });
  }

  if (session.credentials.gh !== "missing" && session.cloudHelpersOffered && optionalStillMissing(session).length === 0) {
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login",
    });
  }

  const sameLead = (a: FirstSessionAction): boolean =>
    a.kind === lead.kind &&
    ("vendor" in a && "vendor" in lead ? a.vendor === lead.vendor : true);

  const rest = candidates.filter((a) => !sameLead(a));
  // Deduplicate by action key while preserving lead-first order.
  const seen = new Set<string>();
  const ordered = [lead, ...rest];
  const out: FirstSessionAction[] = [];
  for (const a of ordered) {
    const key = firstSessionActionKey(a);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export function firstSessionLabel(action: FirstSessionAction): string {
  switch (action.kind) {
    case "setup_credential":
      return `Set up ${VENDOR_LABELS[action.vendor]} — ${action.reason}`;
    case "skip_credential":
      return `Skip ${VENDOR_LABELS[action.vendor]} — ${action.reason}`;
    case "skip_optional_credentials":
    case "offer_cloud_helpers":
    case "use_local_llm_only":
    case "complete_first_session":
      return action.reason;
  }
}

/**
 * PURE. The name is the contract: this is the *simulation*, and it has never had
 * a real-world effect for any action kind. Read the table below before assuming
 * a passing test here says anything about whether a stranger's choice landed.
 *
 * ── Where the durable effects actually live ──────────────────────────────────
 * `simulateFirstSession` is the transition function; `first-session-run.ts`
 * (`applyAction` + the loop) is the only thing that touches disk or spawns a
 * CLI. Per action kind, as of 2026-08-18:
 *
 * | action                     | real effect                                        | where              |
 * |----------------------------|----------------------------------------------------|--------------------|
 * | `setup_credential`         | vendor CLI runs (`gh auth login`, …) → credentials  | executor + journal |
 * | `skip_credential`          | journal line                                        | journal            |
 * | `skip_optional_credentials`| journal line                                        | journal            |
 * | `offer_cloud_helpers`      | journal line                                        | journal            |
 * | `use_local_llm_only`       | journal line + completion marker                    | journal + marker   |
 * | `complete_first_session`   | journal line + completion marker                    | journal + marker   |
 *
 * Before the journal existed the middle four rows read "none" — they were pure
 * state transitions over a record discarded at process exit, so a person who
 * deliberately skipped GitHub and a person who never reached the question left
 * byte-identical evidence. `first-session-journal.ts` closed that; the marker
 * (an ISO timestamp) was and still is the only *other* durable artifact.
 *
 * Two things remain deliberately NOT real here, and both are decisions above
 * this module's pay grade:
 *   1. Credential acquisition is delegated to external vendor CLIs we do not
 *      own — `executeSetupCredential` shells out. Nothing here verifies a token.
 *   2. The journal is local, unsigned and unreplicated. Promoting "this person
 *      chose local-only" to a claim any peer should trust is an identity /
 *      attestation surface and belongs to the distributed-IdP work
 *      (ADR 2026-07-08), not to a fold over a JSONL file.
 */
export function simulateFirstSession(session: NodeSessionState, action: FirstSessionAction): NodeSessionState {
  if (session.complete) {
    return session;
  }

  switch (action.kind) {
    case "setup_credential":
      return {
        ...session,
        credentials: { ...session.credentials, [action.vendor]: "ready" },
      };
    case "skip_credential":
      return {
        ...session,
        credentials: { ...session.credentials, [action.vendor]: "skipped" },
      };
    case "offer_cloud_helpers":
      return {
        ...session,
        cloudHelpersOffered: true,
      };
    case "skip_optional_credentials":
      return {
        ...session,
        credentials: {
          ...session.credentials,
          claude: session.credentials.claude === "missing" ? "skipped" : session.credentials.claude,
          codex: session.credentials.codex === "missing" ? "skipped" : session.credentials.codex,
          gemini: session.credentials.gemini === "missing" ? "skipped" : session.credentials.gemini,
        },
      };
    case "use_local_llm_only":
      return {
        ...session,
        credentials: {
          gh: session.credentials.gh,
          claude: session.credentials.claude === "missing" ? "skipped" : session.credentials.claude,
          codex: session.credentials.codex === "missing" ? "skipped" : session.credentials.codex,
          gemini: session.credentials.gemini === "missing" ? "skipped" : session.credentials.gemini,
        },
        complete: true,
      };
    case "complete_first_session":
      return { ...session, complete: true };
  }
}

/** Whether zeta-self-register may proceed (gh ready). */
export function canSelfRegister(session: NodeSessionState): boolean {
  return session.credentials.gh === "ready";
}

const FIRST_SESSION_CHOOSER_INSTRUCTION =
  "You help someone set up a new Zeta computer. Speak plainly. GitHub sign-in is " +
  "the first-target step so the computer can join the cluster; more providers and " +
  "local-only come later. Prefer staying local. Only show cloud helpers after the " +
  "person asks. Nothing is forced.";

/** Context string for chooseIndex — mirrors describeWorld in observe.ts. */
export function describeFirstSession(session: NodeSessionState): string {
  const creds = (["gh", "claude", "codex", "gemini"] as const)
    .map((v) => `${v}=${session.credentials[v]}`)
    .join(", ");
  return (
    `first-session complete=${session.complete}; cloudHelpersOffered=${session.cloudHelpersOffered}; ` +
    `credentials: ${creds}; canSelfRegister=${canSelfRegister(session)}`
  );
}

/** Stable key for comparing menu entries in tests. */
export function firstSessionActionKey(action: FirstSessionAction): string {
  if (action.kind === "setup_credential" || action.kind === "skip_credential") {
    return `${action.kind}:${action.vendor}`;
  }
  return action.kind;
}

export function firstSessionActionsEqual(a: FirstSessionAction, b: FirstSessionAction): boolean {
  return firstSessionActionKey(a) === firstSessionActionKey(b);
}

/**
 * LLM-driven chooser over buildFirstSessionMenu — same shape as observeWithLlm.
 * On model failure, chooseIndex falls back to index 0 (the oracle lead).
 */
export async function firstSessionWithLlm(
  session: NodeSessionState,
  backend: ModelBackend,
): Promise<FirstSessionAction> {
  const menu = buildFirstSessionMenu(session);
  const result = await chooseIndex(backend, {
    context: describeFirstSession(session),
    options: menu.map(firstSessionLabel),
    instruction: FIRST_SESSION_CHOOSER_INSTRUCTION,
  });
  if (result.fallback) return firstSessionOracle(session);
  return menu[result.index] ?? firstSessionOracle(session);
}

/** Event log fold — same reducer pattern as observe.fold. */
export function foldFirstSession(
  initial: NodeSessionState,
  events: readonly FirstSessionAction[],
): NodeSessionState {
  return events.reduce(simulateFirstSession, initial);
}

/**
 * The longest advancing path through this state machine, MEASURED — not chosen.
 *
 * `first-session-budget.test.ts` walks every state reachable from
 * `defaultNodeSession()` under the menu the operator is actually offered, and
 * takes the longest simple path. It comes out at 6 today, by the witness
 * `setup gh → offer cloud → setup claude → setup codex → setup gemini →
 * complete` over 115 reachable states. The constant is pinned here and the test
 * recomputes it: add an action kind that lengthens the path and the test goes
 * red rather than the loop silently truncating a legitimate session.
 */
export const FIRST_SESSION_ADVANCING_TICKS = 6;

/**
 * Budget for the pure choose→simulate loop.
 *
 * Exactly the measured diameter, with no headroom, and that is a *measurement*
 * rather than a preference: every menu action changes the state (0 non-advancing
 * transitions across all 115 reachable states — the test checks this), so this
 * loop cannot spend a tick without progressing, and a tick past the diameter
 * could only ever run on an already-complete session.
 *
 * Replaces a bare `maxTicks = 12`. 12 was not wrong — it was unexplained, and
 * twice the number needed with nothing recording why.
 */
export const FIRST_SESSION_LLM_TICK_BUDGET: TickBudget = {
  name: "first-session-llm-loop",
  maxTicks: FIRST_SESSION_ADVANCING_TICKS,
  chosenBy: "Otto (shadow), 2026-08-17 — derived, not picked",
  rationale:
    "Equal to the measured longest advancing path (6) because this loop has no " +
    "non-advancing tick: every action in buildFirstSessionMenu changes the " +
    "session, verified exhaustively over all 115 reachable states. Headroom here " +
    "would buy nothing but unexplained slack.",
};

/** Choose → simulate loop until the session completes or the budget is spent. */
export async function runFirstSessionLoop(
  initial: NodeSessionState,
  backend: ModelBackend,
  budget: TickBudget = FIRST_SESSION_LLM_TICK_BUDGET,
): Promise<{ readonly trace: FirstSessionAction[]; readonly finalSession: NodeSessionState }> {
  let session = initial;
  const trace: FirstSessionAction[] = [];
  const maxTicks = clampTicks(budget);
  for (let i = 0; i < maxTicks; i++) {
    if (session.complete) break;
    const action = await firstSessionWithLlm(session, backend);
    trace.push(action);
    session = simulateFirstSession(session, action);
    if (session.complete) break;
  }
  return { trace, finalSession: session };
}
