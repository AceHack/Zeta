/**
 * org-presentation.ts — the names a person reads, kept apart from the names the machine uses.
 *
 * The register's ids are lowercase and underscored because they are KEYS: `qa_manager`,
 * `brd_approval`, `qa_and_verification`. That is right for a key and wrong for a screen. Every
 * surface built on this register so far printed the keys, so an operations director opening the
 * dashboard read a database dump of their own company.
 *
 * ── WHY A LAYER AND NOT A RENAME ─────────────────────────────────────────────
 * The obvious fix — nicer ids — is the wrong one twice over. Ids travel into filenames, action
 * subjects, evidence refs and the event log, where a space or an ampersand is a hazard; and an id
 * that reads like a sentence invites matching on it, which is how a display string becomes load
 * bearing. So the id stays exactly what it is and gains a LABEL beside it. Everything that renders
 * carries both, which also means a screen can show the pretty name and still let somebody copy the
 * key when they need to talk to the machine.
 *
 * ── ACRONYMS ARE DATA, NOT A RULE ────────────────────────────────────────────
 * Title-casing `qa_uat` gives "Qa Uat", which is worse than the raw key: it looks like somebody
 * tried. The acronym set below is the small piece of knowledge that cannot be derived, and it is
 * enumerated rather than guessed at. A word not in it is title-cased, which is the honest default —
 * a new hat named `sre_lead` reads as "SRE Lead" because `sre` is listed, and one named
 * `foo_engineer` reads as "Foo Engineer" because nobody has said otherwise.
 */

import type { OrgChart } from "./org-chart";

/**
 * Words that are acronyms, not words.
 *
 * Enumerated because there is no rule that distinguishes `qa` from `an`. Kept lowercase and matched
 * case-insensitively so a key's own casing never has to be trusted.
 */
const ACRONYMS: ReadonlySet<string> = new Set([
  "ai",
  "api",
  "brd",
  "cd",
  "ceo",
  "cfo",
  "ci",
  "coo",
  "cto",
  "dst",
  "kpi",
  "mr",
  "mttr",
  "pr",
  "qa",
  "qe",
  "rfp",
  "rmo",
  "sla",
  "sre",
  "tpm",
  "uat",
  "ui",
  "ux",
]);

/** Words that stay lowercase inside a title, unless they lead it. */
const MINOR: ReadonlySet<string> = new Set(["a", "an", "of", "on", "the", "to", "for", "in", "at", "by"]);

/**
 * A snake_case key as a person would write it.
 *
 * `and` becomes `&` because these are department names on a wall chart, not prose — "QA &
 * Verification" is how the sign on the door would read.
 */
export function humanise(key: string): string {
  const words = key.split(/[_\-\s]+/).filter((w) => w.length > 0);
  if (words.length === 0) return key;
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (lower === "and") return "&";
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (i > 0 && MINOR.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * What each gate is CALLED, and what it actually asks.
 *
 * The label is what goes on the stage rail; the question is what a person needs in order to answer
 * one. Both are here rather than in the page, because a dashboard and a CLI showing different words
 * for the same gate is how two people end up believing they approved different things.
 *
 * Written out rather than derived from the key, because the question cannot be derived at all and
 * because a derived label gets `qa_uat` wrong in a way that reads as carelessness.
 */
export const GATE_LABELS: Readonly<Record<string, { readonly label: string; readonly asks: string }>> = {
  business_context_grooming: {
    label: "Business Context",
    asks: "Was the context read from a source somebody else could read too — not recalled?",
  },
  customer_rfp_review: {
    label: "Customer & RFP Review",
    asks: "Does this match what the customer actually asked for?",
  },
  brd_approval: {
    label: "BRD Approval",
    asks: "Are the business requirements right, and worth building?",
  },
  peer_review: {
    label: "Peer Review",
    asks: "Does someone doing the same work agree the requirement was read correctly?",
  },
  architecture_design: {
    label: "Architecture Design",
    asks: "Has the design been written down?",
  },
  architecture_approval: {
    label: "Architecture Approval",
    asks: "Is this the right design — before anybody builds it?",
  },
  system_context: {
    label: "System Context",
    asks: "Do we understand what the system around this does today, and why — before we change it?",
  },
  cost_approval: {
    label: "Cost Approval",
    asks: "Is the money worth it, and is it in budget?",
  },
  adversarial_review: {
    label: "Adversarial Review",
    asks: "What is wrong with this design? Attack it before the customer does.",
  },
  reproduction: {
    label: "Reproduction",
    asks: "Did we actually make this defect happen, and is there a test that fails because of it?",
  },
  implementation_review: {
    label: "Implementation Review",
    asks: "Does the code do what the design said, and is it worth keeping?",
  },
  qa_uat: {
    label: "QA & UAT",
    asks: "Does it work, judged by somebody who did not build it?",
  },
  runtime_validation: {
    label: "Runtime Validation",
    asks: "Did the tests actually run, and did they actually pass?",
  },
  final_architecture_review: {
    label: "Final Architecture Review",
    asks: "Does the built thing address a cause, or a symptom?",
  },
  final_business_validation: {
    label: "Final Business Validation",
    asks: "Does this deliver the outcome that was asked for?",
  },
  release_readiness: {
    label: "Release Readiness",
    asks: "Is there anything left before this can ship?",
  },
};

/**
 * WHAT EACH STEP IS SUPPOSED TO DO — the list, not the sentence.
 *
 * `gateQuestion` gives a reviewer one question. This is the other half: what the step itself
 * committed to doing before anyone judges it. Without it a phase is a name and a verdict, and the
 * only way to tell a thorough step from a cursory one is to already know what a thorough one does.
 *
 * THIS IS THE STANDARD, NOT THE RUN. It says what `brd_approval` is for in every organization that
 * uses this chain. What a particular run actually planned is a different list — see `plan:` in
 * `commandArtifactProducer` — and the page shows them side by side precisely so the difference is
 * visible: a step that planned less than its standard is the interesting case.
 */
export const PHASE_CHECKLIST: Readonly<Record<string, readonly string[]>> = {
  business_context_grooming: [
    "Read the context from a source somebody else can read",
    "Record where it was read from",
    "Say what is NOT known, rather than filling it in",
  ],
  customer_rfp_review: [
    "Compare what was asked for against what is proposed",
    "Name any gap between the two",
  ],
  brd_approval: [
    "State the problem in the customer's terms",
    "Write acceptance criteria that can be tested",
    "Say what is out of scope",
  ],
  peer_review: ["Check the requirement was read correctly", "Raise a misreading before a design defends it"],
  architecture_design: [
    "Write the design down",
    "Name the components that change",
    "Say what could go wrong with this approach",
  ],
  architecture_approval: ["Judge the design against the requirement", "Approve, or send it back with a reason"],
  cost_approval: ["Price the work", "Check it against the budget"],
  adversarial_review: ["Attack the design", "Report what would break it", "Say what you could not break"],
  implementation_review: [
    "Read the diff",
    "Check it does what the design said",
    "Check it is worth keeping",
  ],
  qa_uat: ["Exercise the acceptance criteria", "Report what failed, with evidence"],
  runtime_validation: ["Run the tests", "Report the run, not the intention"],
  final_architecture_review: ["Check the built thing addresses a cause", "Say if it treats a symptom"],
  final_business_validation: ["Check the outcome asked for was delivered"],
  release_readiness: ["List what is left", "Say whether it can ship"],
};

/** What this step is responsible for doing. Empty for a gate nobody has written a list for. */
export function phaseChecklist(gate: string): readonly string[] {
  return PHASE_CHECKLIST[gate] ?? [];
}

/** A gate's short name. Falls back to the humanised key so an unlisted gate still reads. */
export function gateLabel(gate: string): string {
  return GATE_LABELS[gate]?.label ?? humanise(gate);
}

/** The question a gate asks, so somebody approving one knows what they are being asked. */
export function gateQuestion(gate: string): string {
  return GATE_LABELS[gate]?.asks ?? `Approve '${humanise(gate)}'?`;
}

/**
 * A hat's name, from the chart.
 *
 * Falls back to the humanised id rather than throwing: a log can name a hat a later chart no longer
 * has, and refusing to render it would hide history rather than fix it.
 */
export function hatName(chart: OrgChart, hatId: string): string {
  return chart.byId.get(hatId)?.name ?? humanise(hatId);
}

/** The department a hat belongs to, as a person would say it. Empty when the chart has no such hat. */
export function departmentOf(chart: OrgChart, hatId: string): string | undefined {
  const dept = chart.byId.get(hatId)?.departmentId;
  return dept === undefined ? undefined : humanise(dept);
}

/**
 * WHY a blocker left the company, in one line, WITHOUT repeating the question.
 *
 * `whyItLeft` composes the whole sentence — what is stopped, on what, and why — which is right for
 * a log line read on its own. On a card the question is already the headline, so repeating it
 * underneath makes the reader read the same words twice and hunt for the difference. This is the
 * half they have not already read.
 */
export function blockerBecause(exhaustion: {
  readonly kind: string;
  readonly forBlockerKind?: string;
  readonly askedHatIds?: readonly string[];
  readonly what?: string;
}): string {
  switch (exhaustion.kind) {
    case "no_owner_in_org":
      return `Nobody in this company holds ${humanise(exhaustion.forBlockerKind ?? "this")}.`;
    case "owners_could_not_resolve":
      return `Asked ${(exhaustion.askedHatIds ?? []).map(humanise).join(", ")} — they could not resolve it.`;
    case "outside_org_authority":
      return `Not this company's decision to make: ${exhaustion.what ?? "outside its authority"}.`;
    default:
      // An exhaustion this build does not know about still renders, rather than leaving a card with
      // a headline and no reason under it.
      return humanise(exhaustion.kind);
  }
}

/** How senior, in words rather than in the enum's spelling. */
export const LEVEL_LABELS: Readonly<Record<string, string>> = {
  c_suite: "Executive",
  director: "Director",
  manager: "Manager",
  lead: "Lead",
  individual_contributor: "Individual Contributor",
};

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? humanise(level);
}

/**
 * What a work item's state means, said plainly.
 *
 * `in_progress` and "Being worked on" carry the same fact; the second is the one somebody scanning a
 * board reads without translating.
 */
export const STATE_LABELS: Readonly<Record<string, string>> = {
  open: "Not started",
  in_progress: "In progress",
  done: "Delivered",
  canceled: "Cancelled",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? humanise(state);
}

/** What kind of thing a piece of work is. */
export const WORK_TYPE_LABELS: Readonly<Record<string, string>> = {
  goal: "Goal",
  initiative: "Initiative",
  project: "Project",
  task: "Task",
  defect: "Defect",
  incident: "Incident",
  capability_request: "Capability Request",
  review: "Review",
};

export function workTypeLabel(workType: string): string {
  return WORK_TYPE_LABELS[workType] ?? humanise(workType);
}

/** What a room is FOR, and what it owes when it closes. */
export function roomPurposeLabel(anchorType: string): string {
  return humanise(anchorType);
}

/** What a room owes, phrased to sit after the word "Owes". */
export function expectedOutputLabel(output: string): string {
  return output === "gate_result" ? "a gate verdict" : `a ${humanise(output).toLowerCase()}`;
}

/**
 * The ORDER departments appear in, top of the house first.
 *
 * A dashboard that sorted departments alphabetically would open on "Architecture" and bury the
 * executive board in the middle, which is not how anybody reads their own company. Departments not
 * listed keep their relative order after these — a new department appears rather than vanishing.
 */
export const DEPARTMENT_ORDER: readonly string[] = [
  "executive_board_and_governance",
  "program_and_initiative_management",
  "product_and_customer_discovery",
  "business_analysis",
  "architecture",
  "engineering",
  "engineering_management",
  "qa_and_verification",
  "qa_engineering",
  "security_and_compliance",
  "delivery_and_release",
  "operations_and_infrastructure",
  "observability_and_evidence",
  "memory_and_knowledge",
  "documentation_and_project_skills",
  "capability_and_automation_expansion",
];

/** Where a department sorts. Unlisted ones go last, in the order they were found. */
export function departmentRank(departmentId: string): number {
  const at = DEPARTMENT_ORDER.indexOf(departmentId);
  return at === -1 ? DEPARTMENT_ORDER.length : at;
}
