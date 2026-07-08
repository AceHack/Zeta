import { chooseIndex } from "../accelerator/local-llm.js";
const VENDORS = ["gh", "claude", "codex", "gemini"], OPTIONAL_VENDORS = ["claude", "codex", "gemini"], VENDOR_LABELS = {
  gh: "GitHub sign-in",
  claude: "Claude (cloud)",
  codex: "Codex (cloud)",
  gemini: "Gemini (cloud)"
};
export const GH_REGISTER_REASON = "needed so this computer can join the cluster (first target today; more providers later)", GH_SKIP_CONTINUE_LATER = "you can finish GitHub later on this computer (local console) or over SSH, then join the cluster", OPTIONAL_CRED_REASON = {
  gh: GH_REGISTER_REASON,
  claude: "optional cloud helper \u2014 only if you asked for cloud setup",
  codex: "optional cloud helper \u2014 only if you asked for cloud setup",
  gemini: "optional cloud helper \u2014 only if you asked for cloud setup"
};
export function defaultNodeSession() {
  return {
    credentials: { gh: "missing", claude: "missing", codex: "missing", gemini: "missing" },
    complete: !1,
    cloudHelpersOffered: !1
  };
}
export function missingVendors(session) {
  return VENDORS.filter((v) => session.credentials[v] === "missing");
}
export function optionalStillMissing(session) {
  return OPTIONAL_VENDORS.filter((v) => session.credentials[v] === "missing");
}
export function firstSessionOracle(session) {
  if (session.complete)
    return { kind: "complete_first_session", reason: "first login already finished" };
  if (session.credentials.gh === "missing")
    return { kind: "setup_credential", vendor: "gh", reason: GH_REGISTER_REASON };
  if (!session.cloudHelpersOffered)
    return {
      kind: "use_local_llm_only",
      reason: "Stay on this computer (local) \u2014 recommended; cloud helpers are optional"
    };
  const nextOptional = optionalStillMissing(session)[0];
  if (nextOptional !== void 0)
    return {
      kind: "setup_credential",
      vendor: nextOptional,
      reason: OPTIONAL_CRED_REASON[nextOptional]
    };
  return {
    kind: "complete_first_session",
    reason: "You are done \u2014 this computer can keep working"
  };
}
export function buildFirstSessionMenu(session) {
  if (session.complete)
    return [{ kind: "complete_first_session", reason: "first login already finished" }];
  const lead = firstSessionOracle(session), candidates = [];
  if (session.credentials.gh === "missing") {
    candidates.push({
      kind: "setup_credential",
      vendor: "gh",
      reason: OPTIONAL_CRED_REASON.gh
    });
    candidates.push({
      kind: "skip_credential",
      vendor: "gh",
      reason: GH_SKIP_CONTINUE_LATER
    });
  }
  if (session.credentials.gh !== "missing" && !session.cloudHelpersOffered) {
    candidates.push({
      kind: "use_local_llm_only",
      reason: "Stay on this computer (local) \u2014 recommended"
    });
    candidates.push({
      kind: "offer_cloud_helpers",
      reason: "Show optional cloud helpers (Claude / Codex / Gemini)"
    });
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login"
    });
  }
  if (session.cloudHelpersOffered && optionalStillMissing(session).length > 0) {
    for (const vendor of optionalStillMissing(session)) {
      candidates.push({
        kind: "setup_credential",
        vendor,
        reason: OPTIONAL_CRED_REASON[vendor]
      });
      candidates.push({
        kind: "skip_credential",
        vendor,
        reason: `skip ${VENDOR_LABELS[vendor]} for now; stay local and add later`
      });
    }
    candidates.push({
      kind: "skip_optional_credentials",
      reason: "Skip all optional cloud helpers; stay local"
    });
    candidates.push({
      kind: "use_local_llm_only",
      reason: "Use only what is on this computer (local)"
    });
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login"
    });
  }
  if (session.credentials.gh !== "missing" && session.cloudHelpersOffered && optionalStillMissing(session).length === 0)
    candidates.push({
      kind: "complete_first_session",
      reason: "Finish first login"
    });
  const sameLead = (a) => a.kind === lead.kind && ("vendor" in a && "vendor" in lead ? a.vendor === lead.vendor : !0), rest = candidates.filter((a) => !sameLead(a)), seen = new Set, ordered = [lead, ...rest], out = [];
  for (const a of ordered) {
    const key = firstSessionActionKey(a);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
export function firstSessionLabel(action) {
  switch (action.kind) {
    case "setup_credential":
      return `Set up ${VENDOR_LABELS[action.vendor]} \u2014 ${action.reason}`;
    case "skip_credential":
      return `Skip ${VENDOR_LABELS[action.vendor]} \u2014 ${action.reason}`;
    case "skip_optional_credentials":
    case "offer_cloud_helpers":
    case "use_local_llm_only":
    case "complete_first_session":
      return action.reason;
  }
}
export function simulateFirstSession(session, action) {
  if (session.complete)
    return session;
  switch (action.kind) {
    case "setup_credential":
      return {
        ...session,
        credentials: { ...session.credentials, [action.vendor]: "ready" }
      };
    case "skip_credential":
      return {
        ...session,
        credentials: { ...session.credentials, [action.vendor]: "skipped" }
      };
    case "offer_cloud_helpers":
      return {
        ...session,
        cloudHelpersOffered: !0
      };
    case "skip_optional_credentials":
      return {
        ...session,
        credentials: {
          ...session.credentials,
          claude: session.credentials.claude === "missing" ? "skipped" : session.credentials.claude,
          codex: session.credentials.codex === "missing" ? "skipped" : session.credentials.codex,
          gemini: session.credentials.gemini === "missing" ? "skipped" : session.credentials.gemini
        }
      };
    case "use_local_llm_only":
      return {
        ...session,
        credentials: {
          gh: session.credentials.gh,
          claude: session.credentials.claude === "missing" ? "skipped" : session.credentials.claude,
          codex: session.credentials.codex === "missing" ? "skipped" : session.credentials.codex,
          gemini: session.credentials.gemini === "missing" ? "skipped" : session.credentials.gemini
        },
        complete: !0
      };
    case "complete_first_session":
      return { ...session, complete: !0 };
  }
}
export function canSelfRegister(session) {
  return session.credentials.gh === "ready";
}
const FIRST_SESSION_CHOOSER_INSTRUCTION = "You help someone set up a new Zeta computer. Speak plainly. GitHub sign-in is the first-target step so the computer can join the cluster; more providers and local-only come later. Prefer staying local. Only show cloud helpers after the person asks. Nothing is forced.";
export function describeFirstSession(session) {
  const creds = ["gh", "claude", "codex", "gemini"].map((v) => `${v}=${session.credentials[v]}`).join(", ");
  return `first-session complete=${session.complete}; cloudHelpersOffered=${session.cloudHelpersOffered}; credentials: ${creds}; canSelfRegister=${canSelfRegister(session)}`;
}
export function firstSessionActionKey(action) {
  if (action.kind === "setup_credential" || action.kind === "skip_credential")
    return `${action.kind}:${action.vendor}`;
  return action.kind;
}
export function firstSessionActionsEqual(a, b) {
  return firstSessionActionKey(a) === firstSessionActionKey(b);
}
export async function firstSessionWithLlm(session, backend) {
  const menu = buildFirstSessionMenu(session), result = await chooseIndex(backend, {
    context: describeFirstSession(session),
    options: menu.map(firstSessionLabel),
    instruction: FIRST_SESSION_CHOOSER_INSTRUCTION
  });
  if (result.fallback)
    return firstSessionOracle(session);
  return menu[result.index] ?? firstSessionOracle(session);
}
export function foldFirstSession(initial, events) {
  return events.reduce(simulateFirstSession, initial);
}
export async function runFirstSessionLoop(initial, backend, maxTicks = 12) {
  let session = initial;
  const trace = [];
  for (let i = 0;i < maxTicks; i++) {
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
