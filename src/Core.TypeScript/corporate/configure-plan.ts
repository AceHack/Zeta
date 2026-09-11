/**
 * corporate/configure-plan.ts — setting an organization up, as a conversation an agent can hold.
 *
 * ── WHY THIS IS NOT A PROMPT LOOP ────────────────────────────────────────────
 * The obvious "guided setup" is a wizard: ask a question on the terminal, read a line, repeat. That
 * shape is wrong for this CLI specifically, because the thing driving it is an AI talking to a
 * person in another window. A wizard would put the agent in the position of typing answers into a
 * subprocess on the user's behalf — it cannot ask a follow-up, cannot explain WHY a question is
 * being asked, and cannot let the person change their mind three steps later.
 *
 * So the plan is DATA. `org configure` returns the next question, the reason for it, and the exact
 * command that answers it. The agent asks the person in its own words, runs that command, and asks
 * again. The conversation lives where conversations belong.
 *
 * ── DERIVED FROM STATE, NEVER A STORED POSITION ──────────────────────────────
 * There is no "wizard step 3 of 5" recorded anywhere. Every step reports whether it is satisfied by
 * looking at the organization as it actually is, which buys three properties for free:
 *
 *   - RESUMABLE. Come back a week later and the plan knows what is done.
 *   - IDEMPOTENT. Running a step's command twice does not advance a counter that then lies.
 *   - HONEST. Configuration changed by hand, or by another agent, is reflected immediately — a
 *     stored position would insist a step was done after somebody undid it.
 *
 * ── OPTIONAL STEPS DO NOT NAG ────────────────────────────────────────────────
 * Checkpoints and skill bindings are genuinely optional; most organizations never set either. If
 * `next` kept offering them, "guided setup" would become a questionnaire nobody can finish, and the
 * zero-config path this register works hard to keep would be a path you had to decline four times.
 * So `complete` is decided by the REQUIRED steps alone, and optional ones are offered once in their
 * own list, as suggestions rather than as remaining work.
 */

import { Intake, type OrgRecord } from "./org-registry";
import { CHAIN_BY_TYPE } from "./gate-demand";
import { resolve } from "./skill-binding";
import { ProcessSetting, resolveSetting } from "./practice";

export const ConfigureStep = {
  /** The organization exists at all: it has an id, a store, an intake mode and a verification approach. */
  Create: "create",
  /** Sources are connected. REQUIRED only for a source-synced org. */
  ConnectSources: "connect_sources",
  /**
   * Systems that push work in as it happens, rather than being read on a cycle. Optional.
   *
   * Deliberately named for what it DOES rather than for the mechanism: an operator is deciding
   * whether their tracker should tell this organization when something is assigned, and "webhook"
   * is the answer to a question they have not asked yet.
   */
  ReceiveEvents: "receive_events",
  /** Where the organization stops for a person. Optional. */
  ChooseCheckpoints: "choose_checkpoints",
  /** How this organization works — its process, and the standing instructions every agent reads. */
  StateProcess: "state_process",
  /** Which skill performs which gate. Optional; the repo's own skills are the default. */
  BindSkills: "bind_skills",
  /**
   * How a finished change reaches people: who integrates it, what its merge request says, what it
   * may never carry, and how it is kept current. REQUIRED for an organization that changes a real
   * repository — see `change-request.ts` for why none of it can be a default.
   */
  HandOffChanges: "hand_off_changes",
  /** Something for the organization to actually do. */
  FirstWork: "first_work",
} as const;

export type ConfigureStep = (typeof ConfigureStep)[keyof typeof ConfigureStep];

export interface PlanStep {
  readonly step: ConfigureStep;
  /** What the agent should ask the person, in plain language. Never jargon it would have to translate. */
  readonly ask: string;
  /**
   * Why it is being asked.
   *
   * Carried because an agent relaying a question deserves to be able to answer "why do you need
   * that?" without guessing, and because a person who understands the reason gives a better answer.
   */
  readonly why: string;
  /** The exact command that satisfies this step, with placeholders in angle brackets. */
  readonly command: string;
  readonly satisfied: boolean;
  /** False means the organization is not configured until this is done. */
  readonly required: boolean;
  /** What the organization looks like on this step right now — so the agent can report progress. */
  readonly current: string;
}

export interface ConfigurePlan {
  readonly orgId?: string;
  /** Every REQUIRED step is satisfied. Optional ones never hold this back. */
  readonly complete: boolean;
  /** The next required step, or absent when the organization is configured. */
  readonly next?: PlanStep;
  /** Things that could still be set up. Offered once, never repeated as outstanding work. */
  readonly optional: readonly PlanStep[];
  readonly steps: readonly PlanStep[];
}

/** The plan for an organization that does not exist yet. */
export function planForNothing(): ConfigurePlan {
  const create: PlanStep = {
    step: ConfigureStep.Create,
    ask:
      "What should this organization be called, where should its work live, and does it get its " +
      "goals from you or from Jira and Confluence?",
    why:
      "An organization is a name, a store for its event log, and a decision about where work comes " +
      "from. It also has to say how it proves a change works before it can start — an organization " +
      "that has not said how it verifies is not configured.",
    command:
      "org create --id <id> --name <name> --store <dir> --intake greenfield|source_synced " +
      "--verification authored_scripts|existing_harness|behaviour_specs|manual_walkthrough",
    satisfied: false,
    required: true,
    current: "no organizations are configured",
  };
  return { complete: false, next: create, optional: [], steps: [create] };
}

/**
 * The plan for an organization that exists, read off its current configuration.
 *
 * `hasWork` is whether the organization has anything to do — supplied by the caller because it is a
 * question about the store and this module is the rule.
 *
 * IT COUNTS A QUEUED GOAL, not only decomposed work. A person who states a goal has answered this
 * step; the organization has not run yet, so no cascade node exists for some minutes. Counting only
 * nodes made the plan ask the same question again immediately after it was answered, which is the
 * nagging this whole shape is meant to avoid — and worse, it invited the person to state the goal
 * twice.
 */
export function planFor(org: OrgRecord, hasWork: boolean): ConfigurePlan {
  const sourceSynced = org.intake === Intake.SourceSynced;
  const gates = [...new Set(Object.values(CHAIN_BY_TYPE).flat())];
  // WHAT THIS ORGANIZATION CHOSE, not what resolves. The register now defaults a few gates, and
  // counting those here told a brand-new organization its skills were configured — so the step was
  // never offered and an operator could not discover that binding existed.
  const boundGates = gates.filter((g) => {
    const r = resolve(org.skills, g);
    return r.bound && r.byDefault !== true;
  });

  const create: PlanStep = {
    step: ConfigureStep.Create,
    ask: "",
    why: "The organization exists and has said how it verifies.",
    command: "",
    satisfied: true,
    required: true,
    current: `'${org.orgId}' is ${org.intake}, ${org.autonomy}, verifying by ${org.policy.verification}`,
  };

  const sources: PlanStep = {
    step: ConfigureStep.ConnectSources,
    ask:
      "Which Jira project and which Confluence spaces should this organization read? I will need " +
      "the path to a file holding your API token — not the token itself.",
    why:
      "This organization takes its goals and its backlog from your existing systems, so it needs " +
      "to know which ones. Sources are read-only: nothing is ever written back to your tracker. " +
      "The credential stays in a file because anything passed on the command line is visible to " +
      "every other process on the machine.",
    command:
      "org source add --kind jira|confluence|git --source-id <id> --location <url> " +
      "--auth-file <path> --select <query>",
    // A greenfield org needs no sources, so the step is satisfied by not applying — which is
    // different from being skipped, and `current` says which it is.
    satisfied: !sourceSynced || org.sources.length > 0,
    required: sourceSynced,
    current: sourceSynced
      ? org.sources.length === 0
        ? "no sources connected; this organization would read an empty backlog forever"
        : `reading ${org.sources.map((s) => `${s.id} (${s.kind})`).join(", ")}`
      : "not needed — you are the customer for this organization, so goals come from you",
  };

  const hooks = org.webhooks ?? [];
  const unverified = hooks.filter((h) => h.scheme === "none");
  const events: PlanStep = {
    step: ConfigureStep.ReceiveEvents,
    ask:
      "Should any of these systems tell this organization the moment something changes — a new " +
      "triage ticket, an epic assigned to you — instead of waiting to be read again?",
    why:
      "Reading a source is a pull: work assigned at 09:02 is not seen until the next cycle. A " +
      "system that pushes closes that gap, and the delivery lands in the same inbox everything " +
      "else does, so nothing downstream changes. Two things are worth deciding out loud. The " +
      "provider signs its deliveries and this needs the path to a file holding the shared secret " +
      "— an endpoint anybody can reach is an endpoint anybody can put work into. And arrival is " +
      "not execution: a delivery is filed immediately and picked up on the next cycle, so no " +
      "stranger and no retry storm decides how often this company works.",
    command:
      "org webhook add --source <configured source id> --scheme hmac_sha256_hex|hmac_sha256_prefixed|none " +
      "--signature-header <header> --secret-file <path> [--preset linear] [--map field=path] " +
      "[--accept-type <type> --type-path <path>]",
    satisfied: hooks.length > 0,
    // OPTIONAL, and it stays optional even for a source-synced organization. Polling is a complete
    // answer; a plan that treated pushing as outstanding work would make "guided setup" something
    // you have to decline, which is the nagging this whole shape exists to avoid.
    required: false,
    current:
      // WHAT THE OPERATOR CAN ACT ON, derived from the record rather than from a stored position.
      // The three states are genuinely different advice, and the middle one is the trap: `org
      // webhook add` refuses a source it does not recognise, so offering the command to somebody
      // with nothing connected would send them into a refusal.
      hooks.length === 0
        ? org.sources.length === 0
          ? "nothing pushes work in — and there are no sources yet for a hook to feed, so connect one first"
          : `nothing pushes work in; ${org.sources.map((src) => src.id).join(", ")} would be read on a cycle instead`
        : `${String(hooks.length)} receiving: ${hooks.map((h) => `/hooks/${h.sourceId}`).join(", ")}` +
          (unverified.length === 0
            ? ""
            : // SAID EVERY TIME ANYBODY LOOKS. An unverified hook is a decision somebody made, and a
              // decision nobody is reminded of is indistinguishable from an accident.
              ` — UNVERIFIED: ${unverified.map((h) => h.sourceId).join(", ")} accept work from anyone who can reach them`),
  };

  const checkpoints: PlanStep = {
    step: ConfigureStep.ChooseCheckpoints,
    ask:
      "Do you want to sign off on anything yourself before the team carries on — the requirements, " +
      "the approach, both, or neither?",
    why:
      "A checkpoint is where the organization stops and waits for you. Grooming stops after the " +
      "requirements are written; approach stops after the design. Both are the last moments where " +
      "a 'no' is cheap. Choosing neither is a real answer and means the team runs on its own.",
    command: "org create ... --checkpoint grooming --checkpoint approach",
    satisfied: org.humanCheckpoints.length > 0,
    required: false,
    current:
      org.humanCheckpoints.length === 0
        ? "no checkpoints — fully agentic, nothing waits for you"
        : `stops at ${org.humanCheckpoints.join(" and ")}`,
  };

  // ── HOW THIS ORGANIZATION WORKS ────────────────────────────────────────────
  // Asked BEFORE the per-gate binding below, because it is the more general question. An operator
  // who has stated their process often needs no binding at all, and asking the narrow question
  // first invites them to answer the broad one in the wrong place.
  const statedPractices = (org.practices ?? []).length;
  const statedDirectives = (org.directives ?? []).length;
  const process: PlanStep = {
    step: ConfigureStep.StateProcess,
    ask:
      "How does this organization work? What a BRD has to contain, whether a test comes before the " +
      "code, what solving a defect means here — and whether any of that differs for a particular " +
      "programme or a particular stage of one.",
    why:
      "Two organizations with the same chart and the same steps can work completely differently, and " +
      "none of that difference fits in a skill id. A practice attaches an ordered set of skills AND " +
      "the process in your own words to a step, a verb, or a kind of work, and it can be scoped to " +
      "one programme so a pilot and the release beside it need not follow the same process. " +
      "Unstated is a real answer: the register states the few practices it has earned and the rest " +
      "is however the repository and the agent see fit.",
    command:
      "org practice bind --subject-kind gate|verb|work_type --subject <id> " +
      "[--skill <s> ...] [--directive \"<how you do it>\"] --why <why> [--for <workId>]",
    satisfied: statedPractices > 0 || statedDirectives > 0,
    required: false,
    current:
      statedPractices === 0 && statedDirectives === 0
        ? "nothing stated — following the register's own practices, and its standing instruction to " +
          "prefer the skills each repository already provides"
        : `${String(statedPractices)} practice(s) and ${String(statedDirectives)} directive(s) stated here`,
  };

  const skills: PlanStep = {
    step: ConfigureStep.BindSkills,
    ask:
      "Are there particular skills you want used for particular steps — a specific review skill for " +
      "architecture, say, or your own QA skill? You can also give one project its own set.",
    why:
      "By default every step uses whatever skills the repository already provides, which is what " +
      "most organizations stay on. Binding is an override for when you want a specific skill on a " +
      "specific step, and it can be scoped to one project so different work can follow different " +
      "pipelines.",
    command: "org skill bind --gate <gate> --skill <skill> --source repo|marketplace|local [--for <workId>]",
    satisfied: boundGates.length > 0,
    required: false,
    current:
      boundGates.length === 0
        ? `no bindings — all ${String(gates.length)} steps use the repository's own skills`
        : `${String(boundGates.length)} of ${String(gates.length)} steps bound`,
  };

  // ── HOW A FINISHED CHANGE REACHES PEOPLE ───────────────────────────────────
  // Required for an organization that changes a real repository, because every answer here is the
  // operator's: whether software reaches a trunk without a person, what a reviewer reads first, what
  // evidence stays with the organization, and whether a branch under review may be updated.
  const changesRepos = org.sources.some((src) => String(src.kind) === "git");
  const delivery = resolveSetting(org.settings ?? [], ProcessSetting.Delivery, []).value;
  const cr = org.changeRequests;
  const handoff: PlanStep = {
    step: ConfigureStep.HandOffChanges,
    ask:
      "When a change is finished, does the team merge it itself or open a merge request for people to " +
      "review? If merge requests: what must each one say (for example: problem statement, whether it was " +
      "reproduced and if not what gave it away, root cause, resolution steps, how the fix was confirmed), " +
      "what must never be committed into your repositories (screenshots, the team's own notes), and when " +
      "the target branch moves on, should the team merge it into the request or only flag that it is behind? " +
      "And when a reviewer comments: once the team has decided (fixed it, or decided not to), should it reply " +
      "on the thread with what it changed or why not, and resolve the thread - reply only - or say nothing there?",
    why:
      "A merge request is what your reviewers read, so its sections are your convention, not ours. The " +
      "team produces evidence - screenshots, step documents - that belongs with the team, and a pattern " +
      "list keeps it out of your repositories. Bringing a request up to date changes a branch people are " +
      "reviewing, so it is your call; rebasing is not offered because it needs a force-push. Feedback on " +
      "a request - comments, updates, the target moving - reaches the team as action items on the work, " +
      "and the team decides what to do about them. Answering a reviewer speaks in your name on their " +
      "thread, and resolving closes a conversation a person opened, so both are your call too.",
    command:
      "org setting bind --setting delivery --value human_review|merge --why <why>  and then  " +
      "org change-requests set --section \"<Heading>=<what it must state>\" ... [--keep-out <glob> ...] " +
      "--sync merge_target|flag_only --replies reply_and_resolve|reply|none --why <why>",
    satisfied: !changesRepos || (delivery !== undefined && (delivery === "merge" || (cr !== undefined && cr.replies !== undefined))),
    required: changesRepos,
    current: !changesRepos
      ? "not needed - this organization changes no repository"
      : delivery === undefined
        ? "nobody has said whether the team merges its own changes or hands them to people"
        : delivery === "merge"
          ? "the team merges its own changes"
          : cr === undefined
            ? "changes go to people for review, but nobody has said what a merge request says or how it is kept current"
            : `merge requests carry ${cr.sections.map((x) => x.heading).join(" / ")}; ` +
              `${cr.keepOut.length === 0 ? "nothing kept out" : `keeping out ${cr.keepOut.join(", ")}`}; ` +
              `kept current by ${cr.sync}; ` +
              (cr.replies === undefined ? "nobody has said whether reviewers' comments are answered" : `reviewers' comments: ${cr.replies}`),
  };

  const work: PlanStep = {
    step: ConfigureStep.FirstWork,
    ask: sourceSynced
      ? "Shall I pull in what your tracker already has and show you what the team would pick up?"
      : "What outcome do you want? I will put it to the business team as a customer goal.",
    why: sourceSynced
      ? "Nothing has been read from your sources yet, so the organization has no work. Once it has, " +
        "`demand` shows which step each piece is on."
      : "This organization takes its goals from you. Stating one is what gives the C-suite something " +
        "to break into initiatives, projects and tasks.",
    command: sourceSynced ? "demand --org <id>" : "goal --title <outcome> --reason <why it matters>",
    satisfied: hasWork,
    required: true,
    current: hasWork ? "the organization has work in hand" : "nothing to do yet",
  };

  const steps = [create, sources, events, checkpoints, process, skills, handoff, work];
  const required = steps.filter((s) => s.required);
  const complete = required.every((s) => s.satisfied);
  const next = required.find((s) => !s.satisfied);

  return {
    orgId: org.orgId,
    complete,
    ...(next === undefined ? {} : { next }),
    optional: steps.filter((s) => !s.required && !s.satisfied),
    steps,
  };
}
