/**
 * first-session.ts — post-login choose-your-own-adventure for credential setup.
 *
 * Vertical slice (usb/zflash trajectory): local LLM conductor asks which creds
 * to set up after console login. `gh` is load-bearing for zeta-self-register;
 * claude / codex / gemini are optional enrichment paths.
 *
 * Intentionally NOT merged into the core NextAction union yet — golden-vectors
 * lock nine kinds for cross-language parity. This module is the first-session
 * hat/vertical; observe integration is a follow-up slice.
 *
 * Society validation: S0 pure tests here; S2 install smoke for gh; S6 physical boot.
 *
 * LLM chooser reuses the observe DU pattern (`chooseIndex`, mock backend,
 * closed-loop fold) — see first-session-llm.test.ts.
 */

import { chooseIndex, type ModelBackend } from "../accelerator/local-llm";

export type CredVendor = "gh" | "claude" | "codex" | "gemini";

export type CredStatus = "missing" | "ready" | "skipped";

export interface NodeSessionState {
  readonly credentials: Readonly<Record<CredVendor, CredStatus>>;
  readonly complete: boolean;
}

export type FirstSessionAction =
  | { readonly kind: "setup_credential"; readonly vendor: CredVendor; readonly reason: string }
  | { readonly kind: "skip_credential"; readonly vendor: CredVendor; readonly reason: string }
  | { readonly kind: "skip_optional_credentials"; readonly reason: string }
  | { readonly kind: "use_local_llm_only"; readonly reason: string }
  | { readonly kind: "complete_first_session"; readonly reason: string };

const VENDORS: readonly CredVendor[] = ["gh", "claude", "codex", "gemini"];

const OPTIONAL_VENDORS: readonly CredVendor[] = ["claude", "codex", "gemini"];

const VENDOR_LABELS: Readonly<Record<CredVendor, string>> = {
  gh: "GitHub sign-in (gh)",
  claude: "Claude Code cloud helper (claude)",
  codex: "OpenAI Codex cloud helper (codex)",
  gemini: "Google Gemini cloud helper (gemini)",
};

export const GH_REGISTER_REASON =
  "load-bearing for node self-register in the cluster catalog";

export const OPTIONAL_CRED_REASON: Readonly<Record<CredVendor, string>> = {
  gh: GH_REGISTER_REASON,
  claude: "optional cloud helper; skip safely and add later",
  codex: "optional cloud helper; skip safely and add later",
  gemini: "optional cloud helper; skip safely and add later",
};

export function defaultNodeSession(): NodeSessionState {
  return {
    credentials: { gh: "missing", claude: "missing", codex: "missing", gemini: "missing" },
    complete: false,
  };
}

export function missingVendors(session: NodeSessionState): readonly CredVendor[] {
  return VENDORS.filter((v) => session.credentials[v] === "missing");
}

export function optionalStillMissing(session: NodeSessionState): readonly CredVendor[] {
  return OPTIONAL_VENDORS.filter((v) => session.credentials[v] === "missing");
}

/** Pure oracle: prefer gh setup while missing; else first optional; else complete. */
export function firstSessionOracle(session: NodeSessionState): FirstSessionAction {
  if (session.complete) {
    return { kind: "complete_first_session", reason: "first session already finished" };
  }
  if (session.credentials.gh === "missing") {
    return { kind: "setup_credential", vendor: "gh", reason: GH_REGISTER_REASON };
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
    reason: "required path satisfied — gh ready or skipped; optional creds resolved",
  };
}

/** Adventure menu: setup/skip per missing vendor + society escape hatches. */
export function buildFirstSessionMenu(session: NodeSessionState): FirstSessionAction[] {
  if (session.complete) {
    return [{ kind: "complete_first_session", reason: "first session already finished" }];
  }

  const lead = firstSessionOracle(session);
  const candidates: FirstSessionAction[] = [];

  for (const vendor of missingVendors(session)) {
    candidates.push({
      kind: "setup_credential",
      vendor,
      reason: OPTIONAL_CRED_REASON[vendor],
    });
    if (vendor !== "gh") {
      candidates.push({
        kind: "skip_credential",
        vendor,
        reason: `skip ${VENDOR_LABELS[vendor]} for now; stay local and add later`,
      });
    }
  }

  if (session.credentials.gh === "missing") {
    candidates.push({
      kind: "skip_credential",
      vendor: "gh",
      reason: "node self-register will wait until GitHub sign-in is ready",
    });
  }

  if (optionalStillMissing(session).length > 0) {
    candidates.push({
      kind: "skip_optional_credentials",
      reason: "Skip optional cloud helpers; local LLM + observe only",
    });
    candidates.push({
      kind: "use_local_llm_only",
      reason: "Use local LLM only (Ollama); no cloud helper sign-ins this session",
    });
  }

  candidates.push({
    kind: "complete_first_session",
    reason: "Finish first login; drop to the normal observe loop",
  });

  const sameLead = (a: FirstSessionAction): boolean =>
    a.kind === lead.kind &&
    ("vendor" in a && "vendor" in lead ? a.vendor === lead.vendor : true);

  const rest = candidates.filter((a) => !sameLead(a));
  return [lead, ...rest];
}

export function firstSessionLabel(action: FirstSessionAction): string {
  switch (action.kind) {
    case "setup_credential":
      return `Set up ${VENDOR_LABELS[action.vendor]} (${action.reason})`;
    case "skip_credential":
      return `Skip ${VENDOR_LABELS[action.vendor]} (${action.reason})`;
    case "skip_optional_credentials":
      return action.reason;
    case "use_local_llm_only":
      return action.reason;
    case "complete_first_session":
      return action.reason;
  }
}

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
  "You are the local LLM conductor on a fresh Zeta cluster node. The operator chooses " +
  "which credentials to set up; nothing is forced. GitHub sign-in (gh) is load-bearing " +
  "for cluster self-register. Claude/Codex/Gemini are optional cloud helpers; local " +
  "LLM-only is always valid.";

/** Context string for chooseIndex — mirrors describeWorld in observe.ts. */
export function describeFirstSession(session: NodeSessionState): string {
  const creds = (["gh", "claude", "codex", "gemini"] as const)
    .map((v) => `${v}=${session.credentials[v]}`)
    .join(", ");
  return `first-session complete=${session.complete}; credentials: ${creds}; canSelfRegister=${canSelfRegister(session)}`;
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

/** Choose → simulate loop until complete or maxTicks — mirrors observe.runLoop. */
export async function runFirstSessionLoop(
  initial: NodeSessionState,
  backend: ModelBackend,
  maxTicks = 12,
): Promise<{ readonly trace: FirstSessionAction[]; readonly finalSession: NodeSessionState }> {
  let session = initial;
  const trace: FirstSessionAction[] = [];
  for (let i = 0; i < maxTicks; i++) {
    if (session.complete) break;
    const action = await firstSessionWithLlm(session, backend);
    trace.push(action);
    session = simulateFirstSession(session, action);
    if (session.complete) break;
  }
  return { trace, finalSession: session };
}
