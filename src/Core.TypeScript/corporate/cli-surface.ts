/**
 * corporate/cli-surface.ts — the command surface, as DATA an agent can read.
 *
 * ── WHY THE SURFACE IS A VALUE ───────────────────────────────────────────────
 * `run-org.ts` grew sixty flags on one entry point. A person can learn that; an AI driving the
 * organization on someone's behalf cannot, because nothing tells it what exists. It has to be told
 * the flags in a prompt, and the prompt goes stale the moment a flag is added — the drift is
 * invisible until the AI calls something that no longer exists.
 *
 * So the commands are declared here as a table, and `org describe --json` prints it. The AI asks
 * the binary what it can do, and the answer is generated from the same value the parser uses, so
 * the two cannot disagree. That is the whole design: ONE declaration, used for parsing, for help,
 * and for discovery.
 *
 * ── EXIT CODES CARRY MEANING ─────────────────────────────────────────────────
 * A driving agent branches on the exit code before it parses anything, so the codes distinguish
 * kinds of failure rather than all being 1. `REFUSED` in particular is not an error: the
 * organization declining to do something is a normal, expected answer — a gate held by policy, an
 * org that will not start work it has no hat for — and an agent that treats it as a crash will
 * retry forever.
 */

/** Exit codes. An agent reads these before it reads stdout. */
import { ProcessSetting } from "./practice";
import { CHECKPOINT_VALUES } from "./quality-gate";

/**
 * The setting names and every legal value, DERIVED from the roster rather than restated.
 *
 * Both were literals while there was one setting, and adding a second would have left the CLI
 * refusing its name — a surface listing fewer knobs than exist is the same defect as one listing
 * more. Per-setting validity is still `validateSetting`'s; this only stops the parser refusing a
 * value that some OTHER setting accepts.
 */
const SETTING_NAMES: readonly string[] = Object.values(ProcessSetting);

export const Exit = {
  Ok: 0,
  /** The command ran and the organization declined. Not a failure of the CLI. */
  Refused: 2,
  /** The arguments were wrong — unknown command, missing required flag, bad value. */
  Usage: 3,
  /** Something the command needed was absent: no such org, no store, no such work item. */
  NotFound: 4,
  /** A port failed — the tracker, the repository, the model. Retryable in principle. */
  PortFailure: 5,
} as const;

export type Exit = (typeof Exit)[keyof typeof Exit];

export interface FlagSpec {
  readonly name: string;
  /** One line. What an agent needs to decide whether to pass it. */
  readonly what: string;
  readonly required?: boolean;
  /** Absent for boolean flags. */
  readonly takesValue?: boolean;
  /** The closed set of legal values, when there is one. */
  readonly oneOf?: readonly string[];
  /** Named so a reader knows a token must never be passed here. */
  readonly isPath?: boolean;
}

export interface CommandSpec {
  /** Space-separated, e.g. `org create`. Matched longest-first so `org create` beats `org`. */
  readonly name: string;
  readonly what: string;
  /** What an agent should do with the result — the half a usage string never carries. */
  readonly then?: string;
  readonly flags: readonly FlagSpec[];
  /** Whether this command CHANGES anything. An agent can dry-run the read-only surface freely. */
  readonly writes: boolean;
}

const ORG_FLAG: FlagSpec = {
  name: "--org",
  what: "Which organization to act on. Required once more than one exists.",
  takesValue: true,
};

const JSON_FLAG: FlagSpec = {
  name: "--json",
  what: "Emit machine-readable JSON on stdout. Always pass this when driving programmatically.",
};

/**
 * Every command. The order is the order `describe` lists them, which is roughly the order an agent
 * setting up an organization would use them.
 *
 * ── ONLY WIRED COMMANDS APPEAR HERE ──────────────────────────────────────────
 * `describe` is what a driving agent reads to learn what exists, so a command listed and not
 * implemented would teach it to call something inert — and it would find out at run time, on a real
 * organization. `org-cli.PLANNED` records the designed-but-unwired ones; they join this table when
 * they have a handler, and a test asserts the table and the dispatcher agree.
 */
export const COMMANDS: readonly CommandSpec[] = [
  {
    name: "describe",
    what: "Print this whole surface as JSON: every command, flag, and exit code.",
    then: "Read this first. It is generated from the same table the parser uses, so it cannot go stale.",
    flags: [JSON_FLAG],
    writes: false,
  },
  {
    name: "org configure",
    what: "The guided setup, as a plan: what is already configured, what is still needed, and the exact command for the next step.",
    then: "Read `next`, ask the person that question in your own words, run its `command`, then call this again. `optional` holds things worth offering once — never nag. Done when `complete` is true.",
    flags: [
      ORG_FLAG,
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "org list",
    what: "List configured organizations with their intake mode, autonomy and sources.",
    flags: [JSON_FLAG],
    writes: false,
  },
  {
    name: "org create",
    what: "Create an organization. Verification approach is required — an org that has not said how it verifies is not configured.",
    then: "Refused with exit 2 if the id is taken, or if a source-synced org names no sources. Follow with `org source add`, then `demand` to see what it owes.",
    flags: [
      { name: "--id", what: "Short id: lowercase letters, digits, dash, underscore. Used as --org elsewhere.", required: true, takesValue: true },
      { name: "--name", what: "Human-readable name, shown in `org list`.", required: true, takesValue: true },
      { name: "--store", what: "Directory for this org's event log and documents.", required: true, takesValue: true, isPath: true },
      {
        name: "--intake",
        what: "greenfield: you are the customer and state goals. source_synced: goals come from Jira and Confluence.",
        required: true,
        takesValue: true,
        oneOf: ["greenfield", "source_synced"],
      },
      {
        name: "--autonomy",
        what: "directed: works only what you hand it. autonomous: raises its own work from its sources.",
        takesValue: true,
        oneOf: ["directed", "autonomous"],
      },
      {
        name: "--checkpoint",
        what: "A gate where this org stops for you. Repeatable; omit for a fully agentic org.",
        takesValue: true,
        oneOf: CHECKPOINT_VALUES,
      },
      {
        name: "--verification",
        what: "How this org proves a change works.",
        required: true,
        takesValue: true,
        oneOf: ["authored_scripts", "existing_harness", "behaviour_specs", "manual_walkthrough"],
      },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org source add",
    what: "Connect a source. Sources are READ-ONLY; nothing is ever written back to your tracker.",
    then: "Pass a credential as --auth-file, a PATH to a file. Never pass a token itself; argv is world-readable — a value that looks like one is refused with exit 2.",
    flags: [
      ORG_FLAG,
      { name: "--kind", what: "Source type. Jira and Linear supply epics and work, Confluence business docs, git the code.", required: true, takesValue: true, oneOf: ["jira", "confluence", "git", "linear"] },
      { name: "--source-id", what: "Distinguishes two sources of the same kind.", required: true, takesValue: true },
      { name: "--location", what: "Base URL or repository path.", required: true, takesValue: true },
      { name: "--auth-file", what: "PATH to a file holding the credential. Read at call time, never stored.", takesValue: true, isPath: true },
      { name: "--select", what: "What to read: JQL, project keys, space keys, a subdirectory. Repeatable.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org method bind",
    what: "Say HOW a verb should be taken — attach a skill to an action an agent can choose. Optional; a verb with no method is taken the way it always was.",
    then: "The runtime never opens the skill; it hands the id to the agent, whose harness resolves it. `org method list` shows what resolves where. Bind `requirement-grilling` to `request_information` to make asking an interview rather than a single question.",
    flags: [
      ORG_FLAG,
      { name: "--kind", what: "The action kind, as `observe` names it — e.g. request_information, draft_business_doc, review_artifact.", required: true, takesValue: true },
      { name: "--skill", what: "Skill id the agent's harness resolves. Opaque here: this CLI never opens it.", required: true, takesValue: true },
      { name: "--why", what: "Why this method applies here, so an agent can tell whether it still does. A method with no reason is an instruction.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org method unbind",
    what: "Decline a method for a verb, including one this organization gets by default. The verb is then taken with no method at all.",
    then: "A default that cannot be turned off is a mandate. Declining is a real answer and it carries its reason, which `org method list` shows beside it.",
    flags: [
      ORG_FLAG,
      { name: "--kind", what: "The action kind to leave without a method.", required: true, takesValue: true },
      { name: "--why", what: "Why this verb should carry no method. Declining is a decision, not an absence.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org method list",
    what: "Which verbs carry a method, and why each one was attached.",
    then: "A verb with no method is not unmanaged — it is taken the way it always was. That is the normal case and is reported as such.",
    flags: [ORG_FLAG, JSON_FLAG],
    writes: false,
  },
  {
    name: "org setting bind",
    what: "Set what the process DOES at a decision the runtime makes mechanically — e.g. whether an epic carries a feature branch.",
    then: "Scope it with --for, which takes a work id OR a ticket key. `integration_branch=direct` on a stabilization epic sends its children straight to the trunk; unset, the shape decides. Shown by `org practice list` with the rest of the process.",
    flags: [
      ORG_FLAG,
      { name: "--setting", what: "Which knob. Refused if it is not one this register knows.", required: true, takesValue: true, oneOf: SETTING_NAMES },
      { name: "--value", what: "Its value — one this setting accepts, or for a list setting a comma list of what it may name. Checked against the setting itself; refused, never defaulted.", required: true, takesValue: true },
      { name: "--why", what: "Why the process works this way here. A knob with no reason is indistinguishable from a typo.", required: true, takesValue: true },
      { name: "--for", what: "A work id or ticket key this applies to, and everything under it. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org setting unbind",
    what: "Unset a process setting. The mechanical default applies again.",
    then: "Removed rather than suppressed: unset means the default decides, which is what removing this returns the item to.",
    flags: [
      ORG_FLAG,
      { name: "--setting", what: "Which knob to unset.", required: true, takesValue: true, oneOf: SETTING_NAMES },
      { name: "--for", what: "The scope to unset it at. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org change-requests set",
    what: "State how a finished change is put in front of people: the sections every merge request must carry, what a change may never add, and how an open request is kept current.",
    then: "Required before an organization that hands work to people can run against a real repository. Replaces the whole statement - repeat every --section you want kept. Feedback on an open request (comments, updates, the target moving) arrives as action items on its work, and the organization decides what to do about each.",
    flags: [
      ORG_FLAG,
      { name: "--section", what: "`<Heading>=<what it must state>`, repeatable, in order. Every description the organization writes must carry each heading.", required: true, takesValue: true },
      { name: "--keep-out", what: "A path pattern a change may never add (`*.png`, `docs/task-*/**`). Repeatable. The handoff refuses a change that adds one.", takesValue: true },
      { name: "--sync", what: "When the target moves on: merge it into the request (`merge_target`), or only record that the request is behind (`flag_only`).", required: true, takesValue: true, oneOf: ["merge_target", "flag_only"] },
      { name: "--replies", what: "Once the team has decided about a reviewer's comment: reply on the thread with what was changed (or why not) and resolve it (`reply_and_resolve`), reply only (`reply`), or say nothing on the thread (`none`).", required: true, takesValue: true, oneOf: ["reply_and_resolve", "reply", "none"] },
      { name: "--after-open", what: "What the team does once, right after it opens a merge request: `comment=<text>` posts that comment (e.g. `comment=aireview` to start the AI review). Repeatable, in order. `none` says nothing happens.", required: true, takesValue: true },
      { name: "--why", what: "Why merge requests are written this way here.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org change-requests show",
    what: "How this organization's merge requests are written and kept current.",
    then: "Nothing stated, on an organization that hands work to people, means it cannot run against a real repository yet: `org configure` names the step.",
    flags: [ORG_FLAG, JSON_FLAG],
    writes: false,
  },
  {
    name: "org practice bind",
    what: "State HOW this organization does something — an ordered chain of skills and the process in your own words. Optional; unstated subjects are done however the repository and the agent see fit.",
    then: "Scope it with --for to give one program, or one STAGE of a program, its own process. Order is precedence: the first skill is what to reach for, the rest are what to reach for when it does not apply. `org practice list` shows what is in force.",
    flags: [
      ORG_FLAG,
      { name: "--subject-kind", what: "What this governs: a gate, a verb as `observe` names it, or a kind of work.", required: true, takesValue: true, oneOf: ["gate", "verb", "work_type"] },
      { name: "--subject", what: "Which one — e.g. brd_approval, draft_business_doc, defect. A name no roster has is refused.", required: true, takesValue: true },
      { name: "--skill", what: "A skill to reach for. Repeatable, and ORDER IS PRECEDENCE.", takesValue: true },
      { name: "--source", what: "Where a skill comes from. Pass one for all of them, or one per --skill in the same order.", takesValue: true, oneOf: ["repo", "marketplace", "local"] },
      { name: "--marketplace", what: "Which marketplace, for a skill whose source is one. Paired with --skill like --source is.", takesValue: true },
      { name: "--directive", what: "The process, in your own words. The half no skill id can carry — an agent reads this.", takesValue: true },
      { name: "--why", what: "Why this is the practice here. A practice with no reason is an order.", required: true, takesValue: true },
      { name: "--for", what: "Restrict to one work item and everything under it. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org practice unbind",
    what: "Decline a practice for a subject, including one this organization gets by default. The subject is then done however the repository and the agent see fit.",
    then: "A default that cannot be turned off is a mandate. Declining is a real answer and it carries its reason.",
    flags: [
      ORG_FLAG,
      { name: "--subject-kind", what: "gate, verb or work_type.", required: true, takesValue: true, oneOf: ["gate", "verb", "work_type"] },
      { name: "--subject", what: "Which one to leave without a practice.", required: true, takesValue: true },
      { name: "--why", what: "Why this subject should carry no practice. Declining is a decision, not an absence.", required: true, takesValue: true },
      { name: "--for", what: "Decline only under this work item. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org practice list",
    what: "The process this organization actually follows: every practice in force, every standing directive, and the skills each connected repository offers of its own.",
    then: "Pass --for to resolve as a specific work item would. The repository listing is what makes the standing 'prefer the repo's own skills' directive checkable rather than prose — a repository with none is stated as such.",
    flags: [
      ORG_FLAG,
      { name: "--for", what: "Resolve as this work item would, nearest scope first. Repeatable, nearest first.", takesValue: true },
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "org directive bind",
    what: "State something that holds regardless of what is being done — a standing instruction every agent reads.",
    then: "Keyed by --id, so stating it again replaces it rather than adding a second that disagrees. The register ships one by default: prefer the skills of the repository you are working in.",
    flags: [
      ORG_FLAG,
      { name: "--id", what: "Short stable name: lowercase letters, digits, dashes. What a replacement matches on.", required: true, takesValue: true },
      { name: "--text", what: "The instruction, in your own words.", required: true, takesValue: true },
      { name: "--why", what: "Why it holds here. A directive with no reason is an order.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org directive unbind",
    what: "Decline a standing directive, including one this organization gets by default.",
    then: "The decision is recorded rather than the row deleted — deleting it would let the default return and erase the choice.",
    flags: [
      ORG_FLAG,
      { name: "--id", what: "Which directive no longer holds.", required: true, takesValue: true },
      { name: "--why", what: "Why it does not hold here.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org check bind",
    what: "Answer a gate by RUNNING checks instead of asking for an opinion. Optional; a gate with no binding is judged exactly as before.",
    then: "The checks run in the change's own checkout and the verdict is recorded against the git TREE, so an unchanged tree reuses it and a changed one cannot. A check with no falsifier reports UNPROVEN rather than passing — see `org check list`.",
    flags: [
      ORG_FLAG,
      { name: "--gate", what: "Which gate these checks answer, as named in `task` or `demand` output.", required: true, takesValue: true },
      { name: "--check", what: "A check id from the roster, repeatable. An id nothing matches is refused, not ignored.", required: true, takesValue: true },
      { name: "--for", what: "Restrict to one work item and everything under it. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org check list",
    what: "Which checks answer which gate, and which of them can prove they are able to fail.",
    then: "A check with no falsifier is listed as UNPROVEN. That is not a warning to silence — a green nobody can falsify is indistinguishable from a green that means something.",
    flags: [ORG_FLAG, JSON_FLAG],
    writes: false,
  },
  {
    name: "org skill bind",
    what: "Bind a skill to a gate. Optional — a gate with no binding uses whatever the repo provides.",
    then: "Scope it to a work item with --for to give one project its own pipeline. `org skill list` shows what resolves where.",
    flags: [
      ORG_FLAG,
      { name: "--gate", what: "Which gate this skill performs, as named in `task` or `demand` output.", required: true, takesValue: true },
      { name: "--skill", what: "Skill to invoke: a slash-command name, a marketplace id, or a path.", required: true, takesValue: true },
      {
        name: "--source",
        what: "repo: whatever the checkout provides. marketplace: installed by name. local: a path in your tree.",
        required: true,
        takesValue: true,
        oneOf: ["repo", "marketplace", "local"],
      },
      { name: "--marketplace", what: "Which marketplace it came from. Required when --source is marketplace.", takesValue: true },
      { name: "--for", what: "Restrict to one work item and everything under it. Omit for organization-wide.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org skill list",
    what: "Every gate this organization has bound, and what each unbound gate falls back to.",
    then: "Pass --for to see what a specific work item would actually resolve to, including which scope won.",
    flags: [
      ORG_FLAG,
      { name: "--for", what: "Resolve as this work item would, nearest scope first. Repeatable, nearest first.", takesValue: true },
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "demand",
    what: "What gate steps the organization owes right now, and what is blocked and why.",
    then: "Each ready step is one gate on one item. Schedule them with `schedule`, or act on one directly.",
    flags: [
      ORG_FLAG,
      { name: "--rework", what: "Only steps that came back from a failed review." },
      { name: "--work", what: "Only this work item.", takesValue: true },
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "task",
    what: "Everything about one work item: its gates, who holds it, what has run, and what it is waiting on.",
    flags: [
      ORG_FLAG,
      { name: "--work", what: "Work item id, e.g. ELERA-149570, as listed by `demand`.", required: true, takesValue: true },
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "inbox",
    what: "The two things that actually need a person: blockers the org raised, and gates you configured as checkpoints.",
    then: "Empty is a real answer — an org with no checkpoints and nothing raised is not waiting on you. Answer with `approve`, `reject` or `comment`.",
    flags: [
      ORG_FLAG,
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "approve",
    what: "Approve a gate as the operator, where the organization asked a person to decide.",
    then: "Queued for the organization to consider on its own terms; it is a request on the record, not a direct write to state. Refused with exit 2 if the action is malformed.",
    flags: [
      ORG_FLAG,
      { name: "--work", what: "Work item id, e.g. ELERA-149570, as listed by `demand`.", required: true, takesValue: true },
      { name: "--gate", what: "Which gate, as named in `task` or `demand` output.", required: true, takesValue: true },
      { name: "--reason", what: "Why. Recorded on the action and read by whoever picks the work up.", required: true, takesValue: true },
      { name: "--as", what: "Who is acting. Defaults to $ORG_OPERATOR, else the OS user.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "reject",
    what: "Send a gate back with a reason. The item returns to that gate as rework, ahead of anything after it.",
    then: "The reason travels with the work down its recovery path — this is the channel that actually turns work around. Refused with exit 2 if malformed.",
    flags: [
      ORG_FLAG,
      { name: "--work", what: "Work item id, e.g. ELERA-149570, as listed by `demand`.", required: true, takesValue: true },
      { name: "--gate", what: "Which gate, as named in `task` or `demand` output.", required: true, takesValue: true },
      { name: "--reason", what: "Why. The agent redoing the work reads this.", required: true, takesValue: true },
      { name: "--as", what: "Who is acting. Defaults to $ORG_OPERATOR, else the OS user.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "comment",
    what: "Leave a note on a work item, as the operator, on the record.",
    then: "HONEST LIMIT: the note is recorded and visible, and nothing in the runtime reads it back to the agent yet. To turn work around today use `reject`, whose reason travels with the work.",
    flags: [
      ORG_FLAG,
      { name: "--work", what: "Work item id, e.g. ELERA-149570, as listed by `demand`.", required: true, takesValue: true },
      { name: "--body", what: "What you want to say. Use @hat to address a particular hat.", required: true, takesValue: true },
      { name: "--as", what: "Who is acting. Defaults to $ORG_OPERATOR, else the OS user.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "questions",
    what: "What the organization's agents have asked you. Read this when a gate is waiting on an answer.",
    then: "Answer with `answer --blocker <id> --answer '...'`, then run the organization again. The answer is handed back to the agent that asked.",
    flags: [
      ORG_FLAG,
      { name: "--outbox", what: "Where the run raises blockers. The same path you passed it as --blockers.", required: true, takesValue: true },
      { name: "--all", what: "Include questions already answered." },
      JSON_FLAG,
    ],
    writes: false,
  },
  {
    name: "org webhook add",
    what: "Let a system push work in. Deliveries land in the inbox and the next cycle picks them up.",
    then: "Run `serve-hooks --org <id> --inbox <dir>` to receive them, and point the provider at POST /hooks/<source>. Nothing starts a cycle on its own — arrival and execution are separate on purpose.",
    flags: [
      ORG_FLAG,
      { name: "--source", what: "Which configured source this feeds, by its id. One hook per source, one secret per hook.", required: true, takesValue: true },
      {
        name: "--scheme",
        what: "How the provider signs. hmac_sha256_hex: a bare hex digest (Linear). hmac_sha256_prefixed: 'sha256=<hex>' (GitHub). shared_token: the header carries the secret itself (GitLab's X-Gitlab-Token) - use over TLS. none: UNVERIFIED - anyone who can reach the endpoint can add work.",
        required: true,
        takesValue: true,
        oneOf: ["hmac_sha256_hex", "hmac_sha256_prefixed", "shared_token", "none"],
      },
      { name: "--signature-header", what: "Header carrying the signature, e.g. linear-signature or x-hub-signature-256.", takesValue: true },
      { name: "--secret-file", what: "PATH to the shared secret. Never the secret itself - argv is world-readable and a value that looks like one is refused.", takesValue: true },
      { name: "--item-path", what: "Where the work item sits in the delivery, dotted, e.g. 'data'. Omit if the delivery IS the item.", takesValue: true },
      { name: "--map", what: "field=path, repeatable: externalId=identifier, title=title, body=description. The same mapping language the polled tracker uses.", takesValue: true },
      { name: "--severity-map", what: "raw=critical|high|medium|low, repeatable. Trackers do not share a severity vocabulary.", takesValue: true },
      { name: "--accept-type", what: "A delivery type to accept, repeatable. OMIT TO ACCEPT ALL - naming them is how 'only assignments start work' is said without code.", takesValue: true },
      { name: "--type-path", what: "Where the delivery's type lives, e.g. 'action'. Needed to use --accept-type.", takesValue: true },
      { name: "--preset", what: "Fill --map and --severity-map with a known provider's field names, which you can then override. gitlab-feedback is GitLab merge-request events as feedback (implies --purpose change_feedback).", takesValue: true, oneOf: ["linear", "gitlab-feedback"] },
      { name: "--purpose", what: "What a delivery is: intake (new work, the default) or change_feedback (something that happened to a change already in front of people - it becomes an action item on that work, never new work).", takesValue: true, oneOf: ["intake", "change_feedback"] },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "org webhook list",
    what: "The hooks this organization accepts, and whether each one is verified.",
    then: "An UNVERIFIED hook is listed as such. That is a decision somebody made, not a default, and it should be visible every time you look.",
    flags: [ORG_FLAG, JSON_FLAG],
    writes: false,
  },
  {
    name: "answer",
    what: "Answer a question one of the organization's agents raised, so the gate that asked can be attempted again.",
    then: "The answer is handed back to the agent that asked it, not filed in a log. Nothing in between interprets it.",
    flags: [
      ORG_FLAG,
      { name: "--blocker", what: "Which question, by id, as named in the run's output and the outbox.", required: true, takesValue: true },
      { name: "--answer", what: "The answer itself. This is what the agent acts on.", required: true, takesValue: true },
      { name: "--reason", what: "Why you answered that way. Required: human actions are audited like agent ones. Recorded beside the answer, never used in its place.", required: true, takesValue: true },
      { name: "--as", what: "Who is acting. Defaults to $ORG_OPERATOR, else the OS user.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
  {
    name: "goal",
    what: "State a goal as the customer. The organization decomposes it into initiatives, projects and tasks.",
    then: "Follow with `demand` to see what it decided to do about it.",
    flags: [
      ORG_FLAG,
      { name: "--title", what: "The outcome you want, in one line.", required: true, takesValue: true },
      { name: "--reason", what: "Why it matters, and what done looks like.", required: true, takesValue: true },
      { name: "--as", what: "Who is acting. Defaults to $ORG_OPERATOR, else the OS user.", takesValue: true },
      JSON_FLAG,
    ],
    writes: true,
  },
];

/** Every command name, longest first — so `org source add` matches before `org`. */
export function commandNames(): readonly string[] {
  return [...COMMANDS.map((c) => c.name)].sort((a, b) => b.length - a.length);
}

export function commandByName(name: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.name === name);
}

/**
 * Match argv against the table, longest name first.
 *
 * Returns the command and the arguments AFTER its name, so a caller never has to know how many
 * words the name was.
 */
export function matchCommand(
  argv: readonly string[],
): { readonly command: CommandSpec; readonly rest: readonly string[] } | undefined {
  const joined = argv.join(" ");
  for (const name of commandNames()) {
    if (joined === name || joined.startsWith(`${name} `)) {
      const command = commandByName(name);
      if (command === undefined) continue;
      return { command, rest: argv.slice(name.split(" ").length) };
    }
  }
  return undefined;
}

export type ParseResult =
  | { readonly ok: true; readonly flags: ReadonlyMap<string, readonly string[]> }
  | { readonly ok: false; readonly reason: string };

/**
 * Parse the flags of one command against its own spec.
 *
 * Unknown flags are REFUSED rather than ignored. An agent that mistypes a flag and is silently
 * obeyed anyway gets a result that answers a different question than the one it asked, and it has
 * no way to notice — which is the worst failure available to a machine-driven interface.
 */
export function parseFlags(command: CommandSpec, argv: readonly string[]): ParseResult {
  const spec = new Map(command.flags.map((f) => [f.name, f]));
  const out = new Map<string, string[]>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;
    if (!token.startsWith("--")) {
      return { ok: false, reason: `unexpected argument '${token}'; '${command.name}' takes flags only` };
    }
    const flag = spec.get(token);
    if (flag === undefined) {
      return {
        ok: false,
        reason: `'${command.name}' has no flag '${token}'. It accepts: ${command.flags.map((f) => f.name).join(", ")}`,
      };
    }
    if (flag.takesValue !== true) {
      out.set(token, [...(out.get(token) ?? []), "true"]);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, reason: `'${token}' needs a value` };
    }
    if (flag.oneOf !== undefined && !flag.oneOf.includes(value)) {
      return {
        ok: false,
        reason: `'${token}' must be one of ${flag.oneOf.join(", ")} — got '${value}'`,
      };
    }
    out.set(token, [...(out.get(token) ?? []), value]);
    i++;
  }

  for (const flag of command.flags) {
    if (flag.required === true && !out.has(flag.name)) {
      return { ok: false, reason: `'${command.name}' requires ${flag.name}: ${flag.what}` };
    }
  }
  return { ok: true, flags: out };
}

export function flagValue(flags: ReadonlyMap<string, readonly string[]>, name: string): string | undefined {
  return flags.get(name)?.[0];
}

export function flagValues(flags: ReadonlyMap<string, readonly string[]>, name: string): readonly string[] {
  return flags.get(name) ?? [];
}

export function hasFlag(flags: ReadonlyMap<string, readonly string[]>, name: string): boolean {
  return flags.has(name);
}

/** The whole surface, as the JSON `describe` prints. */
export function surfaceJson(): string {
  return `${JSON.stringify(
    {
      exitCodes: Object.fromEntries(Object.entries(Exit).map(([k, v]) => [k.toLowerCase(), v])),
      commands: COMMANDS,
    },
    null,
    2,
  )}\n`;
}

/** Human-readable help, generated from the same table. */
export function helpText(): string {
  const lines: string[] = ["org — drive an agent organization", ""];
  for (const c of COMMANDS) {
    lines.push(`  ${c.name}${c.writes ? "" : "   (read-only)"}`);
    lines.push(`      ${c.what}`);
    if (c.then !== undefined) lines.push(`      -> ${c.then}`);
  }
  lines.push("", "Exit codes: 0 ok · 2 refused · 3 usage · 4 not found · 5 port failure");
  lines.push("Pass --json on any command to drive it programmatically.");
  return `${lines.join("\n")}\n`;
}
