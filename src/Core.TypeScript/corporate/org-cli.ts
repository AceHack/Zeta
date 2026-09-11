/**
 * corporate/org-cli.ts — the executable behind `cli-surface.ts`.
 *
 * ── EVERY DECLARED COMMAND IS WIRED ──────────────────────────────────────────
 * The surface table is what `describe` prints, so a command listed there and not implemented here
 * would teach a driving agent to call something that does nothing — the reader-with-no-writer
 * failure pointed at an AI instead of at a data path. `cli-surface.test.ts` asserts the table and
 * this dispatcher agree, so the table cannot grow a command without this file gaining a handler.
 *
 * Commands that are designed but not yet wired are therefore ABSENT FROM THE TABLE rather than
 * present and inert. They are listed in `PLANNED` below so the intent is recorded somewhere a
 * reader will find it, and so nothing has to be remembered.
 *
 * ── IO IS INJECTED ───────────────────────────────────────────────────────────
 * `main` takes its filesystem and its clock. That is what lets the whole surface be tested without
 * a store on disk, and it is the same discipline the ports use everywhere else in this register.
 */

import { readBlockers } from "./blocker-outbox";
import { FEEDBACK_FIELDS, GITLAB_FEEDBACK_MAP, isSignatureScheme, type WebhookConfig } from "./webhook-intake";
import { checksFromRoster, selectChecks, type CheckBinding } from "./check-roster";
import { isDefaultMethod, methodsFor } from "./method-defaults";
import {
  declinePractice,
  directivesInForce,
  isDeclined,
  practicesInForce,
  PracticeSubjectKind,
  renderPractice,
  resolvePractice,
  subjectRosterFor,
  ProcessSetting,
  SETTING_VALUES,
  validateDirective,
  validatePractice,
  validateSetting,
  type Practice,
  type PracticeSkill,
  type PracticeSubject,
  type SettingBinding,
} from "./practice";
import { DEFAULT_DIRECTIVES, DEFAULT_PRACTICES } from "./practice-defaults";
import { repoSkillsIn } from "./repo-skills";
import { ACTION_KINDS } from "../observe/action-reconciliation";
import { CROSS_VERIFY_AUDITS } from "../ci/cross-verify-roster";
import { LINEAR_SEVERITY_MAP, LINEAR_WEBHOOK_MAP } from "./linear-source";
import { answeredBlockers } from "./human-blocker";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  addOrg,
  addSource,
  EMPTY_REGISTRY,
  orgById,
  parseRegistry,
  updateOrg,
  serializeRegistry,
  type OrgRecord,
  type Registry,
  type SourceConfig,
  type SourceKind,
  type Autonomy,
  type Intake,
  looksLikeSecret,
} from "./org-registry";
import {
  CHAIN_BY_TYPE,
  chainOf,
  demandFor,
  gateDemand,
  gatesComplete,
  reworkOnly,
  type GateStep,
} from "./gate-demand";
import { basePolicy, type VerificationApproach } from "./org-policy";
import { foldOrganization } from "./org-fold";
import { appendEvent, readEvents } from "./org-store";
import { nodeById } from "./goal-cascade";
import type { OrgChart } from "./org-chart";
import { acceptAction, actionEvent, HumanActionKind, type HumanAction } from "./human-action";
import { appendAction, readActions } from "./action-queue";
import { checkpointStops, unstaffableRaises } from "./unstaffable-gate";
import { openBlockers } from "./human-blocker";
import { humanGatesFor, type GateKind, type HumanCheckpoint } from "./quality-gate";
import { bindingsOf, resolve, SkillSource, validateBinding, type SkillBinding }
  from "./skill-binding";
import { planFor, planForNothing } from "./configure-plan";
import { validateChangeRequests, type AfterOpenStep, type ChangeRequestConfig, type ChangeRequestSection, type ReplyPolicy, type SyncMethod } from "./change-request";
import {
  Exit,
  flagValue,
  flagValues,
  hasFlag,
  helpText,
  matchCommand,
  parseFlags,
  surfaceJson,
} from "./cli-surface";

/**
 * Designed and deliberately NOT in the surface table until wired.
 *
 * Each needs a running loop rather than a queued request — `schedule` and `agenda` write calendar
 * blocks a live cycle owns, `study` opens a bounded session, `watch` tails events as they land.
 * Recorded here rather than shipped as stubs.
 */
export const PLANNED: readonly string[] = ["schedule", "agenda", "study", "watch"];


/**
 * The queue a person's requests wait in, and the identity they are recorded under.
 *
 * `action-queue.ts` is deliberately the dullest possible transport — one JSON file per action, in a
 * directory the run reads. The CLI writes there rather than reaching into a running cycle, which
 * keeps the property that makes the whole arrangement safe: a person says something, the
 * organization considers it on its own terms, and there is never a second writer racing the first.
 */
export function actionsDir(storeDir: string): string {
  return `${storeDir}/actions`;
}

/**
 * WHO acted. An identity, never "the operator" — a role is nobody anyone can ask afterwards.
 *
 * Falls back to the OS user rather than to a constant, because a shared machine with everything
 * recorded as `operator` produces an audit trail that cannot answer its only question.
 */
function operatorOf(explicit: string | undefined, env: Readonly<Record<string, string | undefined>>): string {
  const named = explicit ?? env["ORG_OPERATOR"] ?? env["USERNAME"] ?? env["USER"];
  return named !== undefined && named.trim() !== "" ? named.trim() : "unknown-operator";
}

export interface CliDeps {
  readonly readFile: (path: string) => string | undefined;
  readonly writeFile: (path: string, content: string) => void;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
  /** Where the registry lives when `--registry` is not given. */
  readonly registryPath: string;
  readonly nowMs: number;
  /** Read for `--as` fallback. Injected so a test can pin the operator. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Mints action ids. Injected so a run is replayable. */
  readonly newId: (prefix: string) => string;
  /**
   * The org chart the raise-derivation reads.
   *
   * Injected rather than rebuilt per command: `unstaffableRaises` asks the chart who could author
   * and who could approve a gate, and a chart assembled differently here than in the runtime would
   * answer those questions differently — so the CLI would report a staffing gap the org does not
   * have, or miss one it does.
   */
  readonly chart: OrgChart;
}

function loadRegistry(deps: CliDeps, path: string): { readonly registry: Registry } | { readonly reason: string } {
  const raw = deps.readFile(path);
  // A MISSING registry is an EMPTY one, not an error: an operator's first command should not be
  // "initialise". A malformed one IS an error, because silently starting over would discard
  // configuration somebody wrote.
  if (raw === undefined) return { registry: EMPTY_REGISTRY };
  const parsed = parseRegistry(raw);
  return parsed.ok ? { registry: parsed.registry } : { reason: parsed.reason };
}

function emit(deps: CliDeps, json: boolean, value: unknown, text: () => string): void {
  deps.out(json ? JSON.stringify(value, null, 2) : text());
}

/** Resolve which org to act on: `--org`, or the only one when there is exactly one. */
function resolveOrg(
  registry: Registry,
  wanted: string | undefined,
): { readonly org: OrgRecord } | { readonly reason: string } {
  if (wanted !== undefined) {
    const org = orgById(registry, wanted);
    return org === undefined ? { reason: `no organization called '${wanted}'` } : { org };
  }
  if (registry.orgs.length === 1) {
    const only = registry.orgs[0];
    if (only !== undefined) return { org: only };
  }
  if (registry.orgs.length === 0) {
    return { reason: "no organizations are configured; run `org create` first" };
  }
  return {
    reason: `--org is required: ${registry.orgs.map((o) => o.orgId).join(", ")}`,
  };
}

function stepLine(s: GateStep): string {
  const mark = s.rework ? `rework x${String(s.attempt)}` : "new";
  return `  ${s.workId}  ${s.gate}  (${mark})  ${s.title}`;
}

export async function main(argv: readonly string[], deps: CliDeps): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    deps.out(helpText());
    return Exit.Ok;
  }

  const matched = matchCommand(argv);
  if (matched === undefined) {
    deps.err(`unknown command '${argv.join(" ")}'. Run with no arguments for the list.`);
    return Exit.Usage;
  }
  const { command, rest } = matched;

  const parsed = parseFlags(command, rest);
  if (!parsed.ok) {
    deps.err(parsed.reason);
    return Exit.Usage;
  }
  const flags = parsed.flags;
  const json = hasFlag(flags, "--json");
  const registryPath = deps.registryPath;

  if (command.name === "describe") {
    deps.out(json ? surfaceJson() : helpText());
    return Exit.Ok;
  }

  const loaded = loadRegistry(deps, registryPath);
  if ("reason" in loaded) {
    deps.err(loaded.reason);
    return Exit.Usage;
  }
  let registry = loaded.registry;

  switch (command.name) {
    case "org configure": {
      // The ONE command that works with no organization configured. Everything else needs an org
      // to act on; this is what tells you how to get one, so refusing here would leave a person
      // with nothing to run first.
      const wanted = flagValue(flags, "--org");
      if (registry.orgs.length === 0 || (wanted === undefined && registry.orgs.length > 1)) {
        const plan = registry.orgs.length === 0 ? planForNothing() : undefined;
        if (plan !== undefined) {
          emit(deps, json, plan, () =>
            `not configured yet\n  next: ${plan.next?.ask ?? ""}\n  run:  ${plan.next?.command ?? ""}\n`,
          );
          return Exit.Ok;
        }
      }
      const chosen = resolveOrg(registry, wanted);
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      // "Has work" is a question about the event log, so it is answered here and handed to the
      // rule rather than the rule reaching for a store it should not know about.
      // Work in hand is decomposed work OR a goal the person has already stated. Counting only the
      // former asked for a goal again seconds after one was given, because the organization had not
      // run yet — so the plan nagged, and invited a duplicate goal.
      const decomposed = foldOrganization(readEvents(chosen.org.storeDir)).cascade.nodes.length > 0;
      const queuedGoal = readActions(actionsDir(chosen.org.storeDir)).some(
        (a) => a.kind === HumanActionKind.SubmitGoal,
      );
      const hasWork = decomposed || queuedGoal;
      const plan = planFor(chosen.org, hasWork);
      emit(deps, json, plan, () =>
        (plan.complete
          ? `'${chosen.org.orgId}' is configured\n`
          : `'${chosen.org.orgId}' needs one more thing\n  next: ${plan.next?.ask ?? ""}\n  run:  ${plan.next?.command ?? ""}\n`)
        + plan.steps.map((st) => `  [${st.satisfied ? "x" : " "}] ${st.step}  ${st.current}`).join("\n")
        + "\n",
      );
      return Exit.Ok;
    }

    case "org list": {
      const view = registry.orgs.map((o) => ({
        orgId: o.orgId,
        name: o.name,
        intake: o.intake,
        autonomy: o.autonomy,
        verification: o.policy.verification,
        sources: o.sources.map((s) => ({ id: s.id, kind: s.kind, location: s.location })),
        storeDir: o.storeDir,
      }));
      emit(deps, json, { orgs: view }, () =>
        view.length === 0
          ? "no organizations configured\n"
          : `${view
              .map(
                (o) =>
                  `${o.orgId}  ${o.name}\n    ${o.intake} · ${o.autonomy} · verifies by ${o.verification}\n` +
                  `    sources: ${o.sources.length === 0 ? "none" : o.sources.map((s) => `${s.id}(${s.kind})`).join(", ")}`,
              )
              .join("\n")}\n`,
      );
      return Exit.Ok;
    }

    case "org create": {
      const org: OrgRecord = {
        orgId: flagValue(flags, "--id") ?? "",
        name: flagValue(flags, "--name") ?? "",
        storeDir: flagValue(flags, "--store") ?? "",
        intake: (flagValue(flags, "--intake") ?? "") as Intake,
        autonomy: (flagValue(flags, "--autonomy") ?? "directed") as Autonomy,
        policy: basePolicy(
          flagValue(flags, "--id") ?? "",
          (flagValue(flags, "--verification") ?? "") as VerificationApproach,
        ),
        sources: [],
        humanCheckpoints: flagValues(flags, "--checkpoint") as readonly HumanCheckpoint[],
        // EMPTY IS THE DEFAULT. `org skill bind` adds overrides later; an org that never binds
        // anything runs on the repo's own skills, which is the path most stay on.
        skills: [],
        createdAtMs: deps.nowMs,
      };
      const added = addOrg(registry, org);
      if (!added.ok) {
        deps.err(added.reason);
        return Exit.Refused;
      }
      deps.writeFile(registryPath, serializeRegistry(added.registry));
      emit(deps, json, { created: org.orgId, org }, () => `created '${org.orgId}'\n`);
      return Exit.Ok;
    }

    case "org source add": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) {
        deps.err(chosen.reason);
        return Exit.NotFound;
      }
      const source: SourceConfig = {
        kind: (flagValue(flags, "--kind") ?? "") as SourceKind,
        id: flagValue(flags, "--source-id") ?? "",
        location: flagValue(flags, "--location") ?? "",
        ...(flagValue(flags, "--auth-file") === undefined
          ? {}
          : { authFile: flagValue(flags, "--auth-file") as string }),
        ...(flagValues(flags, "--select").length === 0
          ? {}
          : { select: flagValues(flags, "--select") }),
      };
      const updated = addSource(registry, chosen.org.orgId, source);
      if (!updated.ok) {
        deps.err(updated.reason);
        return Exit.Refused;
      }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));
      emit(deps, json, { org: chosen.org.orgId, source }, () =>
        `connected ${source.kind} source '${source.id}' to '${chosen.org.orgId}'\n`,
      );
      return Exit.Ok;
    }

    case "org skill bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const scope = flagValue(flags, "--for");
      const market = flagValue(flags, "--marketplace");
      const binding: SkillBinding = {
        gate: (flagValue(flags, "--gate") ?? "") as GateKind,
        skill: flagValue(flags, "--skill") ?? "",
        source: (flagValue(flags, "--source") ?? "") as SkillSource,
        ...(scope === undefined ? {} : { scopeWorkId: scope }),
        ...(market === undefined ? {} : { marketplace: market }),
      };
      // Checked here rather than only at write time, so the message names the binding the operator
      // just typed instead of a validation failure over the whole file.
      const check = validateBinding(binding);
      if (!check.ok) { deps.err(check.reason); return Exit.Refused; }

      const updated = updateOrg(registry, {
        ...chosen.org,
        skills: [...chosen.org.skills, binding],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      deps.writeFile(registryPath, serializeRegistry(updated.registry));
      emit(deps, json, { org: chosen.org.orgId, binding }, () =>
        `'${binding.skill}' now performs '${binding.gate}'` +
        `${scope === undefined ? " organization-wide" : ` for ${scope}`}` + "\n",
      );
      return Exit.Ok;
    }

    case "org skill list": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const ancestry = flagValues(flags, "--for");

      // Every gate the org's work types actually owe, resolved. Listing only the BOUND ones would
      // answer "what did I configure" and not "what will run", and the second is the question an
      // operator has when something behaved unexpectedly.
      const gates = [...new Set(Object.values(CHAIN_BY_TYPE).flat())];
      const resolved = gates.map((g) => resolve(chosen.org.skills, g, ancestry));
      const view = {
        bound: bindingsOf(chosen.org.skills),
        resolved: resolved.map((r) => ({
          // `byDefault` TRAVELS. Without it a gate the REGISTER defaulted renders exactly like
          // one this operator chose, and the listing reports a decision nobody made.
          gate: r.gate, bound: r.bound, byDefault: r.byDefault === true, skill: r.skill ?? "(repo default)",
          source: r.source ?? "repo", scopeWorkId: r.scopeWorkId, because: r.because,
        })),
        defaults: resolved.filter((r) => !r.bound).length,
        // COUNTED SEPARATELY because a default is neither of the other two. Folding it into
        // `bound` credits the operator with a choice they never made; folding it into
        // `defaults` claims the repository supplies a skill the REGISTER supplied.
        byDefault: resolved.filter((r) => r.byDefault === true).length,
      };
      emit(deps, json, view, () =>
        `${String(view.bound.length)} bound here; ${String(view.byDefault)} by default; `
        + `${String(view.defaults)} gate(s) on whatever the repository provides` + "\n"
        + view.resolved.filter((r) => r.bound)
            .map((r) => `  ${r.gate}  ${r.skill}  (${r.byDefault === true ? "default" : r.source})`)
            .join("\n") + "\n",
      );
      return Exit.Ok;
    }

    case "org webhook add": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const sourceId = flagValue(flags, "--source") ?? "";
      // THE HOOK MUST FEED A SOURCE THAT EXISTS. Without this an operator typos the id, the CLI
      // accepts it, `serve-hooks` publishes an endpoint, and deliveries are refused with "no hook at
      // this path" - which reads as the provider being wrong.
      if (!chosen.org.sources.some((src) => src.id === sourceId)) {
        const known = chosen.org.sources.map((src) => src.id).join(", ") || "none";
        deps.err(`no source '${sourceId}' in '${chosen.org.orgId}' - configured: ${known}`);
        return Exit.NotFound;
      }

      const scheme = flagValue(flags, "--scheme") ?? "";
      if (!isSignatureScheme(scheme)) {
        deps.err(`'${scheme}' is not a signature scheme`);
        return Exit.Refused;
      }
      const secretFile = flagValue(flags, "--secret-file");
      // A PATH, NEVER A SECRET - the same refusal `org source add` applies to credentials, for the
      // same reason: this value is written to a file and reaches argv, and both are world-readable.
      if (secretFile !== undefined && looksLikeSecret(secretFile)) {
        deps.err("--secret-file takes a PATH, not the secret itself");
        return Exit.Refused;
      }
      if (scheme !== "none" && (secretFile === undefined || secretFile.trim() === "")) {
        deps.err(`'${scheme}' signs its deliveries, so --secret-file is required`);
        return Exit.Refused;
      }
      if (scheme !== "none" && (flagValue(flags, "--signature-header") ?? "").trim() === "") {
        deps.err(`'${scheme}' needs --signature-header - which header carries the digest`);
        return Exit.Refused;
      }

      // A PRESET FILLS FIELD NAMES, NOTHING ELSE. It is offered so an operator need not look up what
      // Linear calls a title, and every value it writes is visible in the registry and overridable -
      // which is the difference between a convenience and a hardcoded integration.
      const preset = flagValue(flags, "--preset");
      const given = flagValues(flags, "--map");
      // WHAT A DELIVERY IS: new work (the default), or feedback on a change already in front of
      // people - which becomes an action item on its work, never new work.
      const purposeRaw = (flagValue(flags, "--purpose") ?? (preset === "gitlab-feedback" ? "change_feedback" : "intake")).trim();
      if (purposeRaw !== "intake" && purposeRaw !== "change_feedback") {
        deps.err(`'${purposeRaw}' is not a purpose - intake or change_feedback`);
        return Exit.Refused;
      }
      const map = given.length > 0
        ? given
        : preset === "linear"
          ? [...LINEAR_WEBHOOK_MAP]
          : preset === "gitlab-feedback"
            ? [...GITLAB_FEEDBACK_MAP]
            : [];
      if (purposeRaw === "change_feedback") {
        const unknown = map.map((p) => p.slice(0, Math.max(0, p.indexOf("=")))).filter((f) => !(FEEDBACK_FIELDS as readonly string[]).includes(f));
        if (unknown.length > 0) {
          deps.err(`a feedback hook maps ${FEEDBACK_FIELDS.join(", ")} - not ${unknown.join(", ")}`);
          return Exit.Refused;
        }
      }
      if (map.length === 0) {
        deps.err("--map is required (or --preset): without it nothing knows which field is the title");
        return Exit.Refused;
      }
      const severityGiven = flagValues(flags, "--severity-map");
      const severityMap = severityGiven.length > 0 ? severityGiven : preset === "linear" ? [...LINEAR_SEVERITY_MAP] : [];
      const itemPath = flagValue(flags, "--item-path") ?? (preset === "linear" ? "data" : undefined);
      const typePath = flagValue(flags, "--type-path") ?? (preset === "linear" ? "action" : undefined);

      const hook: WebhookConfig = {
        sourceId,
        scheme,
        ...(flagValue(flags, "--signature-header") === undefined ? {} : { signatureHeader: flagValue(flags, "--signature-header") as string }),
        ...(secretFile === undefined ? {} : { secretFile }),
        ...(itemPath === undefined ? {} : { itemPath }),
        map,
        ...(severityMap.length === 0 ? {} : { severityMap }),
        ...(flagValues(flags, "--accept-type").length === 0 ? {} : { acceptTypes: flagValues(flags, "--accept-type") }),
        ...(typePath === undefined ? {} : { typePath }),
        ...(purposeRaw === "change_feedback" ? { purpose: "change_feedback" as const } : {}),
      };

      // ONE HOOK PER SOURCE. Two would mean two secrets on one endpoint and no way to say which
      // delivery should have matched which - so a second add REPLACES, and says so.
      const existing = chosen.org.webhooks ?? [];
      const replaced = existing.some((w) => w.sourceId === sourceId);
      const withHook: OrgRecord = {
        ...chosen.org,
        webhooks: [...existing.filter((w) => w.sourceId !== sourceId), hook],
      };
      const updated = updateOrg(registry, withHook);
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, hook, replaced }, () =>
        `${replaced ? "replaced" : "added"} the hook for '${sourceId}' on '${chosen.org.orgId}'\n` +
        (scheme === "none"
          ? `  UNVERIFIED - anyone who can reach the endpoint can add work to this organization\n`
          : `  verified by '${hook.signatureHeader ?? ""}' against ${secretFile ?? ""}\n`) +
        `  receive with: serve-hooks --org ${chosen.org.orgId} --inbox <dir>\n` +
        `  then run the organization with --inbox <dir> so deliveries are ingested\n`,
      );
      return Exit.Ok;
    }

    case "org webhook list": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const hooks = chosen.org.webhooks ?? [];
      emit(deps, json, { org: chosen.org.orgId, webhooks: hooks }, () => {
        if (hooks.length === 0) {
          // NOT SILENCE. "No hooks" and "this org only polls" are the same fact said two ways, and
          // the second is the one an operator can act on.
          return `'${chosen.org.orgId}' accepts no webhooks - it only reads what it is pointed at\n`;
        }
        return hooks
          .map((w) =>
            `  POST /hooks/${w.sourceId}\n` +
            `    ${w.scheme === "none" ? "UNVERIFIED - anyone who can reach this can add work" : `verified by '${w.signatureHeader ?? ""}'`}\n` +
            `    reads the item at '${w.itemPath ?? "(the whole delivery)"}'\n` +
            `    accepts ${w.acceptTypes === undefined || w.acceptTypes.length === 0 ? "every delivery type" : w.acceptTypes.join(", ")}\n`,
          )
          .join("");
      });
      return Exit.Ok;
    }

    case "org method bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const kind = (flagValue(flags, "--kind") ?? "").trim();
      const skillId = (flagValue(flags, "--skill") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      if (kind === "") { deps.err("--kind is required"); return Exit.Usage; }
      if (skillId === "") { deps.err("--skill is required"); return Exit.Usage; }
      // A METHOD WITH NO REASON IS AN INSTRUCTION. An agent handed one has no way to tell whether
      // it still applies to what it is actually doing, so it follows it because it arrived.
      if (why === "") { deps.err("--why is required: a method with no reason is an instruction"); return Exit.Usage; }

      // THE KIND MUST BE A VERB THAT EXISTS. A method attached to a misspelled action is offered to
      // nobody, and reports itself as configured — the vacuity class, entered through a typo.
      if (!ACTION_KINDS.includes(kind)) {
        deps.err(`'${kind}' is not an action kind — see 'describe' for the grammar`);
        return Exit.NotFound;
      }

      const existing = chosen.org.methods ?? [];
      const replaced = existing.some((m) => m.kind === kind);
      const updated = updateOrg(registry, {
        ...chosen.org,
        methods: [...existing.filter((m) => m.kind !== kind), { kind, skillId, why }],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, kind, skillId, why, replaced }, () =>
        `${replaced ? "replaced the method for" : "bound"} '${skillId}' to '${kind}' on '${chosen.org.orgId}'\n` +
        `  the runtime hands this id to the agent and never opens it\n`,
      );
      return Exit.Ok;
    }

    case "org method unbind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const kind = (flagValue(flags, "--kind") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      if (kind === "") { deps.err("--kind is required"); return Exit.Usage; }
      // DECLINING CARRIES ITS REASON TOO. Turning a default off is a decision somebody made,
      // and the next person to read this configuration deserves to know why it was made.
      if (why === "") { deps.err("--why is required: declining a method is a decision, not an absence"); return Exit.Usage; }
      if (!ACTION_KINDS.includes(kind)) {
        deps.err(`'${kind}' is not an action kind — see 'describe' for the grammar`);
        return Exit.NotFound;
      }

      const existing = chosen.org.methods ?? [];
      // An EMPTY skill id is how the record says 'no method here' — see `methodsFor`. It is a
      // suppression rather than a deletion, because deleting the row would let the default come
      // straight back and the operator's decision would silently evaporate.
      const updated = updateOrg(registry, {
        ...chosen.org,
        methods: [...existing.filter((m) => m.kind !== kind), { kind, skillId: "", why }],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, kind, declined: true, why }, () =>
        `'${kind}' now carries no method on '${chosen.org.orgId}'\n` +
        `  because ${why}\n`,
      );
      return Exit.Ok;
    }

    case "org method list": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      // WHAT IS IN FORCE, not what was typed. Reporting only the organization's own bindings
      // said "attaches no methods" about an organization that was in fact grilling its
      // requirements — the CLI describing a configuration file rather than the running system.
      const configured = chosen.org.methods ?? [];
      const inForce = methodsFor(chosen.org);
      emit(deps, json, { org: chosen.org.orgId, configured, inForce }, () => {
        if (inForce.length === 0) {
          return `'${chosen.org.orgId}' has no methods in force — every verb is taken the way it always was\n`;
        }
        const rows = inForce
          .map((m) => `  ${m.kind}\n    ${m.skillId}  (${isDefaultMethod(m) ? "default" : "chosen here"})\n    because ${m.why}\n`)
          .join("");
        return configured.length === 0
          ? `${rows}  nothing was bound — these are the organization's defaults; 'org method bind' replaces one\n`
          : rows;
      });
      return Exit.Ok;
    }

    case "org setting bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const name = (flagValue(flags, "--setting") ?? "").trim();
      const value = (flagValue(flags, "--value") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      const scope = (flagValue(flags, "--for") ?? "").trim();
      if (name === "") { deps.err(`--setting is required — known: ${Object.values(ProcessSetting).join(", ")}`); return Exit.Usage; }
      if (value === "") { deps.err("--value is required"); return Exit.Usage; }

      const binding: SettingBinding = {
        setting: name as ProcessSetting,
        value,
        ...(scope === "" ? {} : { scope }),
        why,
      };
      const valid = validateSetting(binding);
      if (!valid.ok) { deps.err(valid.reason); return Exit.Refused; }

      const existing = chosen.org.settings ?? [];
      const sameKey = (b: SettingBinding) => b.setting === binding.setting && (b.scope ?? "") === scope;
      const replaced = existing.some(sameKey);
      const updated = updateOrg(registry, {
        ...chosen.org,
        settings: [...existing.filter((b) => !sameKey(b)), binding],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, setting: binding, replaced }, () =>
        `${replaced ? "changed" : "set"} '${name}' to '${value}'` +
        `${scope === "" ? " organization-wide" : ` for '${scope}'`} on '${chosen.org.orgId}'\n` +
        `  because ${why}\n`,
      );
      return Exit.Ok;
    }

    case "org setting unbind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const name = (flagValue(flags, "--setting") ?? "").trim();
      const scope = (flagValue(flags, "--for") ?? "").trim();
      if (name === "") { deps.err("--setting is required"); return Exit.Usage; }

      const existing = chosen.org.settings ?? [];
      const sameKey = (b: SettingBinding) => b.setting === name && (b.scope ?? "") === scope;
      if (!existing.some(sameKey)) {
        deps.err(`'${name}' is not set${scope === "" ? " organization-wide" : ` for '${scope}'`} on '${chosen.org.orgId}'`);
        return Exit.NotFound;
      }
      // DELETED, not suppressed. Unlike a practice there is no register default to come back: unset
      // means the MECHANICAL default applies, which is what removing this returns the item to.
      const updated = updateOrg(registry, { ...chosen.org, settings: existing.filter((b) => !sameKey(b)) });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));
      emit(deps, json, { org: chosen.org.orgId, setting: name, scope, removed: true }, () =>
        `'${name}'${scope === "" ? "" : ` for '${scope}'`} is unset: the mechanical default applies again\n`,
      );
      return Exit.Ok;
    }

    case "org change-requests set": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const sections: ChangeRequestSection[] = [];
      for (const raw of flagValues(flags, "--section")) {
        const at = raw.indexOf("=");
        if (at <= 0) { deps.err(`--section '${raw}' must be '<Heading>=<what it must state>'`); return Exit.Usage; }
        sections.push({ heading: raw.slice(0, at).trim(), states: raw.slice(at + 1).trim() });
      }
      // WHAT FOLLOWS AN OPENED REQUEST is asked, always: `none` is an answer, silence is not.
      const afterOpenRaw = flagValues(flags, "--after-open").map((v) => v.trim());
      const afterOpen: AfterOpenStep[] = [];
      if (!(afterOpenRaw.length === 1 && afterOpenRaw[0] === "none")) {
        for (const raw of afterOpenRaw) {
          const at = raw.indexOf("=");
          if (at <= 0) { deps.err(`--after-open '${raw}' must be '<kind>=<text>' (e.g. comment=aireview) or 'none'`); return Exit.Usage; }
          afterOpen.push({ kind: raw.slice(0, at).trim() as AfterOpenStep["kind"], body: raw.slice(at + 1).trim() });
        }
      }
      const config: ChangeRequestConfig = {
        sections,
        keepOut: flagValues(flags, "--keep-out").map((v) => v.trim()).filter((v) => v !== ""),
        sync: (flagValue(flags, "--sync") ?? "").trim() as SyncMethod,
        // Asked here, always: an absent answer is refused below rather than stored as "not stated".
        replies: (flagValue(flags, "--replies") ?? "").trim() as ReplyPolicy,
        afterOpen,
        why: (flagValue(flags, "--why") ?? "").trim(),
      };
      const valid = validateChangeRequests(config);
      if (!valid.ok) { deps.err(valid.reason); return Exit.Refused; }
      const replaced = chosen.org.changeRequests !== undefined;
      const updated = updateOrg(registry, { ...chosen.org, changeRequests: config });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));
      emit(deps, json, { org: chosen.org.orgId, changeRequests: config, replaced }, () =>
        `${replaced ? "changed" : "stated"} how '${chosen.org.orgId}' writes merge requests: ` +
        `${sections.map((x) => x.heading).join(" / ")}; kept current by ${config.sync}; reviewers answered: ${config.replies}` +
        `; once open: ${afterOpen.length === 0 ? "nothing" : afterOpen.map((s) => `${s.kind} '${s.body}'`).join(", ")}` +
        `${config.keepOut.length === 0 ? "" : `; never adds ${config.keepOut.join(", ")}`}\n  because ${config.why}\n`,
      );
      return Exit.Ok;
    }

    case "org change-requests show": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const cr = chosen.org.changeRequests;
      emit(deps, json, { org: chosen.org.orgId, changeRequests: cr ?? null }, () =>
        cr === undefined
          ? `'${chosen.org.orgId}' has not said how its merge requests are written - 'org configure' names the step\n`
          : [
              `merge requests on '${chosen.org.orgId}' carry, in order:`,
              ...cr.sections.map((x) => `  ## ${x.heading}\n     ${x.states}`),
              cr.keepOut.length === 0 ? "  a change may add anything" : `  a change may never add: ${cr.keepOut.join(", ")}`,
              `  kept current by: ${cr.sync}`,
              `  reviewers' comments: ${cr.replies ?? "NOT STATED - run 'org change-requests set' with --replies"}`,
              `  once a request is open: ${cr.afterOpen === undefined ? "NOT STATED - run 'org change-requests set' with --after-open" : cr.afterOpen.length === 0 ? "nothing" : cr.afterOpen.map((s) => `${s.kind} '${s.body}'`).join(", ")}`,
              `  because ${cr.why}`,
              "",
            ].join("\n"),
      );
      return Exit.Ok;
    }

    case "org practice bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const kindRaw = (flagValue(flags, "--subject-kind") ?? "").trim();
      const id = (flagValue(flags, "--subject") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      const directive = (flagValue(flags, "--directive") ?? "").trim();
      const skillIds = flagValues(flags, "--skill").map((v) => v.trim()).filter((v) => v !== "");
      const sources = flagValues(flags, "--source").map((v) => v.trim()).filter((v) => v !== "");
      const marketplaces = flagValues(flags, "--marketplace").map((v) => v.trim());
      const scopeWorkId = (flagValue(flags, "--for") ?? "").trim();

      if (kindRaw === "") { deps.err("--subject-kind is required: gate, verb or work_type"); return Exit.Usage; }
      if (id === "") { deps.err("--subject is required"); return Exit.Usage; }
      if (why === "") { deps.err("--why is required: a practice with no reason is an instruction"); return Exit.Usage; }

      const kinds = Object.values(PracticeSubjectKind) as readonly string[];
      if (!kinds.includes(kindRaw)) {
        deps.err(`'${kindRaw}' is not a subject kind — known: ${kinds.join(", ")}`);
        return Exit.NotFound;
      }
      const kind = kindRaw as PracticeSubjectKind;

      // ONE SOURCE FOR ALL, OR ONE EACH. Any other count is a pairing the operator did not state and
      // this CLI would have to guess at — and a guess here silently attaches a skill to the wrong
      // marketplace. Refused with the two shapes that do work.
      if (sources.length > 1 && sources.length !== skillIds.length) {
        deps.err(
          `${String(sources.length)} --source flag(s) for ${String(skillIds.length)} --skill flag(s): ` +
          `pass one --source for all of them, or one per skill in the same order`,
        );
        return Exit.Usage;
      }
      const skills: PracticeSkill[] = skillIds.map((skill, i) => {
        const source = (sources.length === 1 ? sources[0] : sources[i]) ?? SkillSource.Repo;
        const marketplace = (marketplaces.length === 1 ? marketplaces[0] : marketplaces[i]) ?? "";
        return {
          skill,
          source: source as PracticeSkill["source"],
          ...(marketplace === "" ? {} : { marketplace }),
        };
      });

      const subject: PracticeSubject = { kind, id };
      const practice: Practice = {
        subject,
        skills,
        ...(directive === "" ? {} : { directive }),
        why,
        ...(scopeWorkId === "" ? {} : { scopeWorkId }),
      };
      const valid = validatePractice(practice);
      if (!valid.ok) { deps.err(valid.reason); return Exit.Refused; }

      const existing = chosen.org.practices ?? [];
      const sameKey = (a: Practice) =>
        a.subject.kind === kind && a.subject.id === id && (a.scopeWorkId ?? "") === scopeWorkId;
      const replaced = existing.some(sameKey);
      const updated = updateOrg(registry, {
        ...chosen.org,
        practices: [...existing.filter((a) => !sameKey(a)), practice],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, practice, replaced }, () =>
        `${replaced ? "replaced the practice for" : "stated the practice for"} ${String(kind)} '${id}'` +
        `${scopeWorkId === "" ? "" : ` under '${scopeWorkId}'`} on '${chosen.org.orgId}'` + "\n" +
        renderPractice(resolvePractice([practice], subject, scopeWorkId === "" ? [] : [scopeWorkId])) + "\n",
      );
      return Exit.Ok;
    }

    case "org practice unbind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const kindRaw = (flagValue(flags, "--subject-kind") ?? "").trim();
      const id = (flagValue(flags, "--subject") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      const scopeWorkId = (flagValue(flags, "--for") ?? "").trim();
      if (kindRaw === "" || id === "") { deps.err("--subject-kind and --subject are required"); return Exit.Usage; }
      // DECLINING CARRIES ITS REASON. A default that cannot be turned off is a mandate, and choosing
      // "no process here" is a decision the next reader deserves the reason for.
      if (why === "") { deps.err("--why is required: declining a practice is a decision, not an absence"); return Exit.Usage; }

      const kinds = Object.values(PracticeSubjectKind) as readonly string[];
      if (!kinds.includes(kindRaw)) {
        deps.err(`'${kindRaw}' is not a subject kind — known: ${kinds.join(", ")}`);
        return Exit.NotFound;
      }
      const kind = kindRaw as PracticeSubjectKind;
      if (!subjectRosterFor(kind).includes(id)) {
        deps.err(`'${id}' is not a ${String(kind)} — see 'describe' for the grammar`);
        return Exit.NotFound;
      }

      const existing = chosen.org.practices ?? [];
      const sameKey = (a: Practice) =>
        a.subject.kind === kind && a.subject.id === id && (a.scopeWorkId ?? "") === scopeWorkId;
      // A SUPPRESSION, not a deletion. Removing the row would let the register's default come
      // straight back and the operator's decision would silently evaporate.
      const declined = declinePractice({ kind, id }, why, scopeWorkId === "" ? undefined : scopeWorkId);
      const updated = updateOrg(registry, {
        ...chosen.org,
        practices: [...existing.filter((a) => !sameKey(a)), declined],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, subject: { kind, id }, declined: true, why }, () =>
        `${String(kind)} '${id}' now carries no practice on '${chosen.org.orgId}'\n  because ${why}\n`,
      );
      return Exit.Ok;
    }

    case "org practice list": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const ancestry = flagValues(flags, "--for");

      // WHAT IS IN FORCE, not what was typed — the lesson `org method list` and `org skill list`
      // both had to learn. An organization following the register's practices has a process.
      const inForce = practicesInForce(chosen.org.practices ?? [], DEFAULT_PRACTICES)
        .filter((row) => !isDeclined(row.practice));
      const directives = directivesInForce(chosen.org.directives, DEFAULT_DIRECTIVES);

      // WHAT THE REPOSITORIES THEMSELVES OFFER. The standing instruction says to prefer a
      // repository's own skills; without this the instruction is prose about a directory nobody
      // looked in, and "the repository has none" reads identically to "nobody checked".
      const repos = chosen.org.sources
        // GIT SOURCES ONLY: a tracker or a wiki has no skills directory to read. `id` rather
        // than `sourceId` — the registry names it `id`, and the earlier spelling silently
        // produced `undefined` in every row of the listing.
        .filter((src) => src.kind === ("git" as SourceKind))
        .map((src) => ({ sourceId: src.id, skills: repoSkillsIn(src.location) }));

      const view = {
        org: chosen.org.orgId,
        stated: (chosen.org.practices ?? []).length,
        inForce: inForce.map((row) => ({
          subject: row.practice.subject,
          byDefault: row.byDefault,
          skills: row.practice.skills,
          ...(row.practice.directive === undefined ? {} : { directive: row.practice.directive }),
          why: row.practice.why,
          ...(row.practice.scopeWorkId === undefined ? {} : { scopeWorkId: row.practice.scopeWorkId }),
        })),
        directives: directives.map((row) => ({ ...row.directive, byDefault: row.byDefault })),
        // LISTED HERE rather than in a command of their own: a setting is the same configuration
        // answering the same question, and a second listing is a second place to forget to look.
        settings: (chosen.org.settings ?? []).map((b) => ({
          ...b,
          legalValues: SETTING_VALUES[b.setting],
        })),
        repoSkills: repos,
        resolvedFor: ancestry,
      };

      emit(deps, json, view, () => {
        const out: string[] = [];
        out.push(`${String(view.inForce.length)} practice(s) in force; ${String(view.stated)} stated here`);
        for (const row of inForce) {
          const where = row.practice.scopeWorkId === undefined ? "" : ` under '${row.practice.scopeWorkId}'`;
          out.push(`  ${String(row.practice.subject.kind)} ${row.practice.subject.id}${where}  (${row.byDefault ? "default" : "stated here"})`);
          const rendered = renderPractice(
            resolvePractice([row.practice], row.practice.subject, ancestry, DEFAULT_PRACTICES),
          );
          if (rendered !== "") out.push(rendered);
        }
        const settings = chosen.org.settings ?? [];
        out.push(
          settings.length === 0
            ? `no process settings — every mechanical decision takes its default`
            : `${String(settings.length)} process setting(s)`,
        );
        for (const b of settings) {
          out.push(`  ${String(b.setting)} = ${b.value}${b.scope === undefined ? "  (organization-wide)" : `  for ${b.scope}`}`);
          out.push(`    because ${b.why}`);
        }
        out.push(`${String(directives.length)} standing directive(s)`);
        for (const row of directives) {
          out.push(`  ${row.directive.id}  (${row.byDefault ? "default" : "stated here"})`);
          out.push(`    ${row.directive.text}`);
          out.push(`    because ${row.directive.why}`);
        }
        for (const repo of repos) {
          out.push(
            repo.skills.length === 0
              ? `  ${repo.sourceId} offers no skills of its own`
              : `  ${repo.sourceId} offers ${String(repo.skills.length)} skill(s): ${repo.skills.map((k) => k.name).join(", ")}`,
          );
        }
        return out.join("\n") + "\n";
      });
      return Exit.Ok;
    }

    case "org directive bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const id = (flagValue(flags, "--id") ?? "").trim();
      const text = (flagValue(flags, "--text") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      if (id === "") { deps.err("--id is required"); return Exit.Usage; }
      if (text === "") { deps.err("--text is required: use 'org directive unbind' to decline one"); return Exit.Usage; }
      const valid = validateDirective({ id, text, why });
      if (!valid.ok) { deps.err(valid.reason); return Exit.Refused; }

      const existing = chosen.org.directives ?? [];
      const replaced = existing.some((d) => d.id === id);
      const updated = updateOrg(registry, {
        ...chosen.org,
        directives: [...existing.filter((d) => d.id !== id), { id, text, why }],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, id, text, why, replaced }, () =>
        `${replaced ? "replaced" : "stated"} the standing directive '${id}' on '${chosen.org.orgId}'\n  ${text}\n  because ${why}\n`,
      );
      return Exit.Ok;
    }

    case "org directive unbind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const id = (flagValue(flags, "--id") ?? "").trim();
      const why = (flagValue(flags, "--why") ?? "").trim();
      if (id === "") { deps.err("--id is required"); return Exit.Usage; }
      if (why === "") { deps.err("--why is required: declining a directive is a decision, not an absence"); return Exit.Usage; }

      const existing = chosen.org.directives ?? [];
      // EMPTY TEXT IS THE SUPPRESSION, for the same reason an empty skill id suppresses a method:
      // deleting the row would let the register's default return and erase the decision.
      const updated = updateOrg(registry, {
        ...chosen.org,
        directives: [...existing.filter((d) => d.id !== id), { id, text: "", why }],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      emit(deps, json, { org: chosen.org.orgId, id, declined: true, why }, () =>
        `'${id}' no longer holds on '${chosen.org.orgId}'\n  because ${why}\n`,
      );
      return Exit.Ok;
    }

    case "org check bind": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const gate = (flagValue(flags, "--gate") ?? "").trim();
      if (gate === "") { deps.err("--gate is required"); return Exit.Usage; }

      const wanted = flagValues(flags, "--check");
      if (wanted.length === 0) { deps.err("--check is required (repeatable)"); return Exit.Usage; }

      // AN ID NOTHING MATCHES IS REFUSED HERE, not discovered at gate time. A binding that matches
      // nothing is a gate that verifies nothing, and it would report itself as configured.
      const roster = checksFromRoster(CROSS_VERIFY_AUDITS);
      const picked = selectChecks(roster.specs, wanted);
      if (picked.unknown.length > 0) {
        deps.err(`no check(s) called ${picked.unknown.join(", ")} — see 'org check list' for what exists`);
        return Exit.NotFound;
      }

      const scopeWorkId = flagValue(flags, "--for");
      const existing = chosen.org.checks ?? [];
      const binding: CheckBinding = {
        gate,
        checkIds: wanted,
        ...(scopeWorkId === undefined ? {} : { scopeWorkId }),
      };
      // ONE BINDING PER (gate, scope). Two would mean two answers to "what verifies this gate" with
      // no way to say which, so a second bind REPLACES and says so.
      const replaced = existing.some((b) => b.gate === gate && b.scopeWorkId === scopeWorkId);
      const updated = updateOrg(registry, {
        ...chosen.org,
        checks: [...existing.filter((b) => !(b.gate === gate && b.scopeWorkId === scopeWorkId)), binding],
      });
      if (!updated.ok) { deps.err(updated.reason); return Exit.Refused; }
      registry = updated.registry;
      deps.writeFile(registryPath, serializeRegistry(registry));

      const unproven = picked.selected.filter((c) => c.falsifier === undefined).map((c) => c.id);
      emit(deps, json, { org: chosen.org.orgId, binding, unproven }, () =>
        `${replaced ? "replaced" : "bound"} ${String(wanted.length)} check(s) to '${gate}'` +
        `${scopeWorkId === undefined ? "" : ` for '${scopeWorkId}'`} on '${chosen.org.orgId}'\n` +
        (unproven.length === 0
          ? "  every one of them can prove it is able to fail\n"
          : `  UNPROVEN — nothing shows these can fail, so their green is not evidence: ${unproven.join(", ")}\n`),
      );
      return Exit.Ok;
    }

    case "org check list": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const roster = checksFromRoster(CROSS_VERIFY_AUDITS);
      const bindings = chosen.org.checks ?? [];
      emit(
        deps,
        json,
        { org: chosen.org.orgId, bindings, available: roster.specs.map((c) => ({ id: c.id, title: c.title, falsifier: c.falsifier !== undefined })), unpaired: roster.unpaired },
        () => {
          if (bindings.length === 0) {
            // NOT SILENCE. "No bindings" and "gates are judged by the review port" are one fact said
            // two ways, and only the second tells an operator what is actually happening.
            return (
              `'${chosen.org.orgId}' binds no checks — its gates are answered by the review port\n` +
              `  ${String(roster.specs.length)} check(s) are available to bind; ` +
              `${String(roster.specs.length - roster.unpaired.length)} of them can prove they are able to fail\n`
            );
          }
          return bindings
            .map((b) => {
              const picked = selectChecks(roster.specs, b.checkIds);
              const weak = picked.selected.filter((c) => c.falsifier === undefined).map((c) => c.id);
              return (
                `  ${b.gate}${b.scopeWorkId === undefined ? "" : ` (for ${b.scopeWorkId})`}\n` +
                `    ${b.checkIds.join(", ")}\n` +
                (weak.length === 0 ? "" : `    UNPROVEN: ${weak.join(", ")}\n`)
              );
            })
            .join("");
        },
      );
      return Exit.Ok;
    }

    case "questions": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      // READ FROM THE OUTBOX AND THE QUEUE, never from a stored "open" flag. The two can disagree,
      // and the disagreement always surfaces the same way: a person is asked something they have
      // already answered.
      const outbox = flagValue(flags, "--outbox") ?? "";
      const raised = readBlockers(outbox);
      const queued = readActions(actionsDir(chosen.org.storeDir));
      const open = openBlockers(raised, queued);
      const answered = answeredBlockers(raised, queued);
      const showAll = hasFlag(flags, "--all");

      const rows = [
        ...open.map((b) => ({
          blockerId: b.blockerId,
          askedBy: b.byHatId,
          blocking: b.blocking,
          question: b.about,
          unblocks: b.unblocks,
          answer: undefined as string | undefined,
        })),
        ...(showAll
          ? answered.map(({ blocker, answer }) => ({
              blockerId: blocker.blockerId,
              askedBy: blocker.byHatId,
              blocking: blocker.blocking,
              question: blocker.about,
              unblocks: blocker.unblocks,
              answer: String(answer.detail?.["answer"] ?? answer.reason),
            }))
          : []),
      ];

      emit(deps, json, { open: open.length, answered: answered.length, questions: rows }, () => {
        if (rows.length === 0) {
          // AN EMPTY LIST IS NOT SILENCE. "Nothing has been asked" and "the outbox you named holds
          // nothing" are different facts, and a reader who cannot tell them apart concludes the
          // organization is content when it may simply have been pointed at the wrong directory.
          return raised.length === 0
            ? "no questions in " + outbox + " - nothing has been asked, or the run was given a different --blockers path\n"
            : "all " + String(raised.length) + " question(s) in " + outbox + " have been answered\n";
        }
        const lines = rows.map((r) => {
          const head = "  " + r.blockerId + "\n    " + r.askedBy + " on " + r.blocking + " asks: " + r.question;
          const tail = r.answer === undefined
            ? "\n    answers: " + r.unblocks + "\n    answer --blocker " + r.blockerId + " --answer '...'"
            : "\n    answered: " + r.answer;
          return head + tail;
        });
        return lines.join("\n") + "\n";
      });
      return Exit.Ok;
    }

    case "demand": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) {
        deps.err(chosen.reason);
        return Exit.NotFound;
      }
      const folded = foldOrganization(readEvents(chosen.org.storeDir));
      const all = gateDemand({ cascade: folded.cascade, evaluations: folded.gateEvaluations });
      const work = flagValue(flags, "--work");
      let ready = hasFlag(flags, "--rework") ? reworkOnly(all) : all.ready;
      if (work !== undefined) ready = ready.filter((s) => s.workId === work);
      const blocked = work === undefined ? all.blocked : all.blocked.filter((b) => b.workId === work);

      emit(deps, json, { ready, blocked }, () =>
        `${ready.length} ready\n${ready.map(stepLine).join("\n")}\n` +
        `${blocked.length} blocked\n${blocked.map((b) => `  ${b.workId}  ${b.gate}  ${b.because}`).join("\n")}\n`,
      );
      return Exit.Ok;
    }

    case "task": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) {
        deps.err(chosen.reason);
        return Exit.NotFound;
      }
      const workId = flagValue(flags, "--work") ?? "";
      const folded = foldOrganization(readEvents(chosen.org.storeDir));
      const node = nodeById(folded.cascade, workId);
      if (node === undefined) {
        deps.err(`no work item '${workId}' in '${chosen.org.orgId}'`);
        return Exit.NotFound;
      }
      const chain = chainOf(node);
      const evaluations = folded.gateEvaluations.filter((e) => e.workId === workId);
      const all = gateDemand({ cascade: folded.cascade, evaluations: folded.gateEvaluations });
      const view = {
        workId,
        title: node.title,
        workType: node.workType,
        state: node.state,
        ownerHatId: node.ownerHatId,
        assigneeHatId: node.assigneeHatId,
        chain,
        gatesComplete: gatesComplete(node, workId, folded.gateEvaluations),
        ran: evaluations.map((e) => ({
          gate: e.gate,
          outcome: e.outcome,
          byHatId: e.byHatId,
          reason: e.reason,
          atMs: e.atMs,
          evidenceRefs: e.evidenceRefs,
        })),
        owes: demandFor(all, workId),
        blocked: all.blocked.filter((b) => b.workId === workId),
      };
      emit(deps, json, view, () =>
        `${workId}  ${node.title}\n` +
        `  type ${node.workType} · state ${node.state} · owner ${node.ownerHatId}\n` +
        `  gates: ${chain.join(" -> ")}\n` +
        `  ran: ${view.ran.length === 0 ? "nothing yet" : view.ran.map((r) => `${r.gate}=${r.outcome}`).join(", ")}\n` +
        `  owes: ${view.owes.map((s) => s.gate).join(", ") || "nothing"}\n`,
      );
      return Exit.Ok;
    }

    case "inbox": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }
      const folded = foldOrganization(readEvents(chosen.org.storeDir));
      const demand = gateDemand({ cascade: folded.cascade, evaluations: folded.gateEvaluations });

      // TWO SIGNALS, and they are different facts a person acts on differently.
      //
      // `asked` is the organization discovering it cannot proceed — a blocker it raised OUT.
      // `checkpoint` is a stop the operator CONFIGURED. A first cut of this command had neither
      // and fell back to listing every ready step, which reported five items as waiting on a
      // person when nobody had asked about any of them. A queue that cries wolf stops being read.
      const answered = readActions(actionsDir(chosen.org.storeDir));
      const asked = openBlockers(folded.blockers, answered);
      const stops = checkpointStops(demand, humanGatesFor(chosen.org.humanCheckpoints));

      // What the org WOULD raise if it ran now — reported so an operator can see a structural
      // gap before an agent trips over it, and marked as unraised so it is not confused with a
      // question somebody actually asked.
      const wouldRaise = unstaffableRaises({
        chart: deps.chart,
        demand,
        byHatId: chosen.org.policy.orgId,
        atMs: deps.nowMs,
      });

      const view = {
        asked: asked.map((b) => ({
          blockerId: b.blockerId, blocking: b.blocking, about: b.about,
          unblocks: b.unblocks, why: b.why, byHatId: b.byHatId,
        })),
        checkpoint: stops.map((s) => ({
          workId: s.workId, gate: s.gate, title: s.title, rework: s.rework, why: s.why,
        })),
        unraised: wouldRaise.raises.map((b) => ({ blocking: b.blocking, about: b.about })),
        escalatedInternally: wouldRaise.escalations.length,
      };
      emit(deps, json, view, () =>
        view.asked.length === 0 && view.checkpoint.length === 0
          ? `nothing is waiting on you\n`
          : `${String(view.asked.length)} asked of you\n`
            + view.asked.map((b) => `  ${b.blocking}  ${b.about}`).join("\n") + "\n"
            + `${String(view.checkpoint.length)} at a checkpoint\n`
            + view.checkpoint.map((s) => `  ${s.workId}  ${s.gate}  ${s.title}`).join("\n") + "\n",
      );
      return Exit.Ok;
    }

    case "approve":
    case "reject":
    case "comment":
    case "answer":
    case "goal": {
      const chosen = resolveOrg(registry, flagValue(flags, "--org"));
      if ("reason" in chosen) { deps.err(chosen.reason); return Exit.NotFound; }

      const kind =
        command.name === "approve" ? HumanActionKind.ApproveGate
        : command.name === "reject" ? HumanActionKind.RejectGate
        : command.name === "comment" ? HumanActionKind.PostToRoom
        : command.name === "answer" ? HumanActionKind.AnswerBlocker
        : HumanActionKind.SubmitGoal;

      // AN ANSWER'S SUBJECT IS THE QUESTION. `answerFor` looks a reply up by `subjectId === blockerId`,
      // so filing it against the work item would leave the question open forever while the reply sat
      // in the queue looking answered.
      const subjectId =
        flagValue(flags, "--blocker") ?? flagValue(flags, "--work") ?? flagValue(flags, "--title") ?? "";
      const reason = flagValue(flags, "--reason") ?? flagValue(flags, "--body") ?? "";
      const gate = flagValue(flags, "--gate");
      // `detail.answer` IS THE ANSWER; `--reason` is why you answered. `acceptAction` refuses an
      // answer whose `detail.answer` is empty, precisely so the two cannot be confused.
      const answerText = flagValue(flags, "--answer");

      // Built as raw and pushed through `acceptAction` rather than constructed directly, so the
      // CLI inherits the SAME refusals the queue applies to every other writer. Constructing a
      // HumanAction here would let the CLI enqueue something the runtime would later reject, and
      // the person would never learn which of their requests was dropped.
      const verdict = acceptAction({
        actionId: deps.newId("act"),
        kind,
        byHuman: operatorOf(flagValue(flags, "--as"), deps.env),
        atMs: deps.nowMs,
        subjectId,
        reason,
        // ONE `detail`, chosen once. Two conditional spreads of the SAME KEY silently drop
        // whichever came first, so an approval that also carried an answer would lose its gate and
        // be refused for a field it had supplied.
        ...(gate !== undefined
          ? { detail: { gate } }
          : answerText !== undefined
            ? { detail: { answer: answerText } }
            : {}),
      });
      if (!verdict.ok) { deps.err(verdict.reason); return Exit.Refused; }
      const action: HumanAction = verdict.action;

      // A work item that does not exist is NOT FOUND, checked before the queue is touched — an
      // approval for a typo'd id would otherwise sit in the queue forever looking like a decision.
      // A BLOCKER ID IS NOT A WORK ITEM. The existence check below looks the subject up in the
      // cascade, and a question's id lives in the outbox instead — so an answer would be refused as
      // "no such work item" for a question the organization itself had just asked.
      if (kind !== HumanActionKind.SubmitGoal && kind !== HumanActionKind.AnswerBlocker) {
        const folded = foldOrganization(readEvents(chosen.org.storeDir));
        if (nodeById(folded.cascade, subjectId) === undefined) {
          deps.err(`no work item '${subjectId}' in '${chosen.org.orgId}'`);
          return Exit.NotFound;
        }
      }

      appendAction(action, actionsDir(chosen.org.storeDir));
      // Queued AND recorded. The queue is what the run consumes; the event is the permanent record,
      // and a request that was considered and declined still has to be visible afterwards.
      appendEvent(actionEvent(action, deps.newId("evt")), chosen.org.storeDir);

      emit(deps, json, { queued: action }, () =>
        `queued ${action.kind} on '${action.subjectId}' as ${action.byHuman}\n`,
      );
      return Exit.Ok;
    }

    default: {
      // Unreachable while the table and this switch agree, which a test asserts. Kept as a loud
      // refusal rather than a silent fallthrough so a table entry added without a handler fails
      // where somebody will see it.
      deps.err(`'${command.name}' is declared but not wired`);
      return Exit.Usage;
    }
  }
}


/**
 * ── THE ENTRYPOINT THIS CLI DID NOT HAVE ─────────────────────────────────────
 * `main` takes its file IO, its clock, its id minting and its org chart as `CliDeps`, which is the
 * right shape — every one of those is a thing a test needs to pin. But a grep for who CONSTRUCTS a
 * `CliDeps` returned exactly two files: this one, and `org-cli.test.ts`. There was no production
 * caller. So the whole surface — creating an organization, connecting a source, binding a skill,
 * stating a goal, approving a gate — was reachable only from a test with fake file IO, and a person
 * following the guided setup had nothing to run. A CLI nobody can invoke is not a CLI.
 *
 * This is the reader-with-no-writer pattern inverted: a complete, tested writer with no way in.
 *
 * The registry path is where the list of organizations lives. `ORG_REGISTRY` names it outright;
 * otherwise it sits under `ORG_HOME` (or the user's home), so a second org created tomorrow joins
 * the first instead of starting a new list somewhere else.
 */
export function realCliDeps(): CliDeps {
  const home = process.env["ORG_HOME"] ?? process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".";
  const registryPath = process.env["ORG_REGISTRY"] ?? joinPath(home, ".agent-org", "registry.json");
  const chart = buildOrgChart(SEED_HATS);
  // A chart that will not build is not something to paper over with an empty one: every staffing
  // answer this CLI gives would then be silently wrong. Fail where it can be seen.
  if (!chart.ok) throw new Error(`the seeded org chart is invalid: ${chart.reason}`);
  let minted = 0;
  return {
    readFile: (path: string) => {
      try {
        return readFileSync(path, "utf-8");
      } catch {
        // MISSING IS EMPTY, NOT AN ERROR — `loadRegistry` already says so, and a first-ever command
        // must not fail because the file it is about to create does not exist yet.
        return undefined;
      }
    },
    writeFile: (path: string, content: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf-8");
    },
    out: (line: string) => process.stdout.write(line),
    err: (line: string) => process.stderr.write(line),
    registryPath,
    nowMs: Date.now(),
    env: process.env,
    // Time plus a counter: two orgs created in the same millisecond still get distinct ids, and the
    // id says when it was minted, which is what makes a queued action legible months later.
    newId: (prefix: string) => {
      minted += 1;
      return `${prefix}-${String(Date.now())}-${String(minted)}`;
    },
    chart: chart.chart,
  };
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), realCliDeps());
}
