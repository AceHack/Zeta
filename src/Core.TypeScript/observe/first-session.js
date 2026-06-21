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
import { chooseIndex } from "../accelerator/local-llm";
const VENDORS = ["gh", "claude", "codex", "gemini"];
const OPTIONAL_VENDORS = ["claude", "codex", "gemini"];
export const GH_REGISTER_REASON = "GitHub login registers this node in the cluster catalog (load-bearing for self-register)";
export const OPTIONAL_CRED_REASON = {
    gh: GH_REGISTER_REASON,
    claude: "Optional — cloud assistant (Anthropic Claude Code)",
    codex: "Optional — cloud assistant (OpenAI Codex)",
    gemini: "Optional — cloud assistant (Google Gemini)",
};
export function defaultNodeSession() {
    return {
        credentials: { gh: "missing", claude: "missing", codex: "missing", gemini: "missing" },
        complete: false,
    };
}
export function missingVendors(session) {
    return VENDORS.filter((v) => session.credentials[v] === "missing");
}
export function optionalStillMissing(session) {
    return OPTIONAL_VENDORS.filter((v) => session.credentials[v] === "missing");
}
/** Pure oracle: prefer gh setup while missing; else first optional; else complete. */
export function firstSessionOracle(session) {
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
export function buildFirstSessionMenu(session) {
    if (session.complete) {
        return [{ kind: "complete_first_session", reason: "first session already finished" }];
    }
    const lead = firstSessionOracle(session);
    const candidates = [];
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
                reason: `Skip ${vendor} for now — stay on local LLM / add later`,
            });
        }
    }
    if (session.credentials.gh === "missing") {
        candidates.push({
            kind: "skip_credential",
            vendor: "gh",
            reason: "Skip GitHub for now — node self-register will wait until gh is ready",
        });
    }
    if (optionalStillMissing(session).length > 0) {
        candidates.push({
            kind: "skip_optional_credentials",
            reason: "Skip all optional cloud assistants — local LLM + observe only",
        });
        candidates.push({
            kind: "use_local_llm_only",
            reason: "Use local LLM only (Ollama) — no cloud vendor logins this session",
        });
    }
    candidates.push({
        kind: "complete_first_session",
        reason: "Done with setup — drop to normal observe loop",
    });
    const sameLead = (a) => a.kind === lead.kind &&
        ("vendor" in a && "vendor" in lead ? a.vendor === lead.vendor : true);
    const rest = candidates.filter((a) => !sameLead(a));
    return [lead, ...rest];
}
export function firstSessionLabel(action) {
    switch (action.kind) {
        case "setup_credential":
            return `Set up ${action.vendor} (${action.reason})`;
        case "skip_credential":
            return `Skip ${action.vendor} (${action.reason})`;
        case "skip_optional_credentials":
            return action.reason;
        case "use_local_llm_only":
            return action.reason;
        case "complete_first_session":
            return action.reason;
    }
}
export function simulateFirstSession(session, action) {
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
export function canSelfRegister(session) {
    return session.credentials.gh === "ready";
}
const FIRST_SESSION_CHOOSER_INSTRUCTION = "You are the local LLM conductor on a fresh Zeta cluster node. The operator chooses " +
    "which credentials to set up — nothing is forced. GitHub (gh) is needed for cluster " +
    "self-register; claude/codex/gemini are optional. Local LLM-only is always valid.";
/** Context string for chooseIndex — mirrors describeWorld in observe.ts. */
export function describeFirstSession(session) {
    const creds = ["gh", "claude", "codex", "gemini"]
        .map((v) => `${v}=${session.credentials[v]}`)
        .join(", ");
    return `first-session complete=${session.complete}; credentials: ${creds}; canSelfRegister=${canSelfRegister(session)}`;
}
/** Stable key for comparing menu entries in tests. */
export function firstSessionActionKey(action) {
    if (action.kind === "setup_credential" || action.kind === "skip_credential") {
        return `${action.kind}:${action.vendor}`;
    }
    return action.kind;
}
export function firstSessionActionsEqual(a, b) {
    return firstSessionActionKey(a) === firstSessionActionKey(b);
}
/**
 * LLM-driven chooser over buildFirstSessionMenu — same shape as observeWithLlm.
 * On model failure, chooseIndex falls back to index 0 (the oracle lead).
 */
export async function firstSessionWithLlm(session, backend) {
    const menu = buildFirstSessionMenu(session);
    const result = await chooseIndex(backend, {
        context: describeFirstSession(session),
        options: menu.map(firstSessionLabel),
        instruction: FIRST_SESSION_CHOOSER_INSTRUCTION,
    });
    if (result.fallback)
        return firstSessionOracle(session);
    return menu[result.index] ?? firstSessionOracle(session);
}
/** Event log fold — same reducer pattern as observe.fold. */
export function foldFirstSession(initial, events) {
    return events.reduce(simulateFirstSession, initial);
}
/** Choose → simulate loop until complete or maxTicks — mirrors observe.runLoop. */
export async function runFirstSessionLoop(initial, backend, maxTicks = 12) {
    let session = initial;
    const trace = [];
    for (let i = 0; i < maxTicks; i++) {
        if (session.complete)
            break;
        const action = await firstSessionWithLlm(session, backend);
        trace.push(action);
        session = simulateFirstSession(session, action);
        if (session.complete)
            break;
    }
    return { trace, finalSession: session };
}
