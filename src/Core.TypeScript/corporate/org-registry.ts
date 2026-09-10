/**
 * corporate/org-registry.ts — many organizations, each with its own sources and disposition.
 *
 * ── WHY A REGISTRY AND NOT A `--store` FLAG ──────────────────────────────────
 * An organization was a directory passed on the command line. That is enough to RUN one and not
 * enough to HAVE several: nothing recorded which Jira project an org reads, whether it may raise its
 * own work, or how it verifies — so every invocation had to restate all of it, and two orgs on one
 * machine differed only by whichever flags the caller last typed.
 *
 * This is the record. `org create` writes one, every other command reads it, and the AI driving the
 * CLI names an org instead of reassembling its configuration each time.
 *
 * ── CREDENTIALS ARE PATHS, NEVER VALUES ──────────────────────────────────────
 * A source carries `authFile` — WHERE the token is read from at call time — and never the token.
 * The registry is a JSON file on disk and the CLI's arguments show up in process listings, so a
 * secret in either is a secret published to every process on the machine. `validateOrg` REFUSES a
 * config whose `authFile` looks like a credential rather than a path, because the failure is
 * otherwise silent and permanent: nobody notices a working token in a config file.
 *
 * ── SOURCES ARE READ-ONLY, AND THAT IS STRUCTURAL ────────────────────────────
 * `DataSourcePort` is `read()`/`query()`; there is no write. An org can be configured to read a
 * Confluence space and a Jira project and cannot be configured to write back to either, which is
 * why the shape below has no notion of a destination.
 */

import { stringCompare } from "../collation/collation.ts";
import { isVerificationApproach, validateOrgPolicy, type OrgPolicy } from "./org-policy";
import type { CheckBinding } from "./check-roster";
import type { Method as MethodBinding } from "../observe/observe";
import { HumanCheckpoint } from "./quality-gate";
import { validateBindings, type SkillBinding } from "./skill-binding";
import {
  validateDirective,
  validatePractices,
  type Directive,
  type Practice,
} from "./practice";

/** How work ENTERS an organization. Never affects which gates apply — see `gate-demand`. */
export const Intake = {
  /**
   * The AI is the customer. Goals are stated by the operator and groomed into work by the business
   * hats. For greenfield, where there is no tracker to sync from.
   */
  Greenfield: "greenfield",
  /** Goals and work come from connected sources — Confluence for docs, Jira for epics. */
  SourceSynced: "source_synced",
} as const;

export type Intake = (typeof Intake)[keyof typeof Intake];

/** How much the organization starts on its own. */
export const Autonomy = {
  /** Works only what it is handed. Nothing starts without the operator. */
  Directed: "directed",
  /** Reads its sources, raises its own work items, and carries them to the gates that need a human. */
  Autonomous: "autonomous",
} as const;

export type Autonomy = (typeof Autonomy)[keyof typeof Autonomy];

export const SourceKind = {
  Jira: "jira",
  Confluence: "confluence",
  Git: "git",
  Linear: "linear",
} as const;

export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

export interface SourceConfig {
  readonly kind: SourceKind;
  /** Distinguishes two sources of the same kind — "elera-jira", "payments-wiki". */
  readonly id: string;
  /** The base URL, repository path, or clone location. Never a credential. */
  readonly location: string;
  /**
   * PATH to a file holding the credential, read at call time.
   *
   * Never the credential. See the header — this file is written to disk and its values reach
   * argv, and both are readable by anything on the machine.
   */
  readonly authFile?: string;
  /** What to read: JQL, project keys, space keys, a subdirectory. */
  readonly select?: readonly string[];
}

/**
 * An inbound hook: work that arrives instead of being polled for.
 *
 * ── WHY THIS LIVES ON THE ORGANIZATION ───────────────────────────────────────
 * Every other source here is a PULL, so nothing new reaches the organization until somebody runs it
 * again. A task assigned at 09:02 waits for the next cycle, and "immediately" quietly becomes
 * "eventually". A hook inverts that: the provider tells us, the delivery lands in the inbox the
 * intake port already reads, and the work is there on the next cycle rather than the next poll.
 *
 * Configured per organization rather than per run, for the same reason its checkpoints and skills
 * are: an operator says this once, and every run honours it without being reminded.
 *
 * The MAPPING is `field=path` pairs — the same language the polled tracker uses — so a provider
 * this register has never heard of is a configuration entry rather than a code change. See
 * `webhook-intake.ts` for why that matters.
 */
export interface WebhookConfig {
  /** Which source this feeds. Matches a `SourceConfig.id`, so a delivery traces to a system. */
  readonly sourceId: string;
  /** How the provider signs. One of `SignatureScheme`; validated on the way in. */
  readonly scheme: string;
  /** The header carrying the signature. Provider-specific, therefore configuration. */
  readonly signatureHeader?: string;
  /** PATH to the shared secret. NEVER the secret — see `SourceConfig.authFile`. */
  readonly secretFile?: string;
  /** Where the work item sits inside the delivery, dotted. Absent means the delivery IS the item. */
  readonly itemPath?: string;
  /** `field=path` pairs for `trackerMapper`. */
  readonly map: readonly string[];
  /** `raw=critical|high|medium|low` pairs; trackers do not share a severity vocabulary. */
  readonly severityMap?: readonly string[];
  /** Delivery types to accept. EMPTY MEANS ALL, which is the honest default for an unstated filter. */
  readonly acceptTypes?: readonly string[];
  /** Where the delivery's type lives, e.g. `action`. Needed to use `acceptTypes`. */
  readonly typePath?: string;
}

export interface OrgRecord {
  readonly orgId: string;
  readonly name: string;
  /** Where this org's event log and documents live. */
  readonly storeDir: string;
  readonly intake: Intake;
  readonly autonomy: Autonomy;
  readonly policy: OrgPolicy;
  readonly sources: readonly SourceConfig[];
  /**
   * The checkpoints where this organization stops for a PERSON.
   *
   * Configured, never inferred. `humanGatesFor` turns these into the gates that wait, and an empty
   * list is a real answer meaning fully agentic — which is why an inbox on such an org is empty
   * rather than falling back to showing everything it happens to be working on.
   */
  readonly humanCheckpoints: readonly HumanCheckpoint[];
  /**
   * Which skill performs which gate. EMPTY IS THE NORMAL CASE.
   *
   * An org with no bindings runs on whatever the checkout provides, which is the zero-config path
   * and the one most organizations stay on. A binding is an override somebody chose, never a
   * requirement — see `skill-binding.ts` for why an unbound gate falls back rather than refusing.
   */
  readonly skills: readonly SkillBinding[];
  /**
   * Hooks that bring work in on their own. EMPTY is the normal case — a polled organization.
   *
   * Optional on the type so a registry written before hooks existed still parses; `parseRegistry`
   * fills it with an empty list rather than leaving it undefined, so no reader has to ask twice.
   */
  readonly webhooks?: readonly WebhookConfig[];
  /**
   * Which checks answer which gate. EMPTY IS THE NORMAL CASE.
   *
   * Optional on the type so a registry written before checks existed still parses. An organization
   * with none runs its gates exactly as it did — this is an override, never a requirement.
   */
  readonly checks?: readonly CheckBinding[];
  /**
   * How this organization's hats should take particular verbs. EMPTY IS THE NORMAL CASE.
   *
   * A method is an OFFER attached to a verb — "when you ask for information, ask like this". It is
   * configuration rather than code for the same reason a skill binding is: the alternative is a
   * table inside the runtime naming a method for a verb, which works for the pairs its author knew
   * about and cannot be changed without a release.
   *
   * The runtime never resolves `skillId`. It hands it to the agent and the agent's harness opens
   * it, exactly as `ORG_SKILL` already works for gates.
   */
  readonly methods?: readonly MethodBinding[];
  /**
   * HOW THIS ORGANIZATION WORKS — its process, per gate, verb or kind of work.
   *
   * Optional, and empty is the normal case for a new organization: the register states the few
   * practices it has earned and everything else is however the repository and the agent see fit.
   *
   * The difference from `skills` is worth stating, because they look adjacent and are not. A
   * skill binding answers WHICH ONE THING performs a gate. A practice answers HOW THE WORK IS
   * DONE — an ordered chain to reach for, and the process in the organization's own words, which
   * is the half no skill id can carry. Scoped per work item, so a pilot and the release beside it
   * can run different processes without a second configuration system.
   */
  readonly practices?: readonly Practice[];
  /**
   * What holds regardless of what is being done.
   *
   * The register's own default is that the skills of the repository being worked in come first;
   * an organization may replace that or decline it. Kept separate from `practices` because a
   * standing instruction attached to a subject would have to be repeated on every subject, and
   * would then be missing from whichever one nobody remembered.
   */
  readonly directives?: readonly Directive[];
  readonly createdAtMs: number;
}

export interface Registry {
  readonly orgs: readonly OrgRecord[];
}

export const EMPTY_REGISTRY: Registry = { orgs: [] };

export type RegistryResult =
  | { readonly ok: true; readonly registry: Registry }
  | { readonly ok: false; readonly reason: string };

export type OrgCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Anything that looks like a secret rather than a path to one.
 *
 * Deliberately generous. A false positive costs the operator a clearer filename; a false negative
 * writes a live token into a JSON file and into every future `ps` listing, and nobody finds it
 * until it leaks. The asymmetry decides the threshold.
 */
const SECRET_SHAPES: readonly RegExp[] = [
  /^[A-Za-z0-9+/=_-]{24,}$/, // a bare token: long, no separators a path would have
  /^Bearer\s/i,
  /^Basic\s/i,
  /^https?:\/\/[^/]*:[^/@]*@/i, // credentials embedded in a URL
];

export function looksLikeSecret(value: string): boolean {
  const v = value.trim();
  if (v === "") return false;
  // A path has a separator or an extension; a token normally has neither.
  const pathLike = v.includes("/") || v.includes("\\") || /\.[A-Za-z0-9]{1,8}$/.test(v);
  if (pathLike && !/^https?:\/\/[^/]*:[^/@]*@/i.test(v)) return false;
  return SECRET_SHAPES.some((re) => re.test(v));
}

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** Refuse an organization that cannot mean what it says. */
export function validateOrg(org: OrgRecord): OrgCheck {
  if (!ID_RE.test(org.orgId)) {
    return {
      ok: false,
      reason: `'${org.orgId}' is not a usable org id — lowercase letters, digits, dash and underscore, up to 64`,
    };
  }
  if (org.name.trim() === "") return { ok: false, reason: "an organization needs a name" };
  if (org.storeDir.trim() === "") return { ok: false, reason: "an organization needs a store directory" };
  if (!Object.values(Intake).includes(org.intake)) {
    return { ok: false, reason: `'${String(org.intake)}' is not an intake mode` };
  }
  if (!Object.values(Autonomy).includes(org.autonomy)) {
    return { ok: false, reason: `'${String(org.autonomy)}' is not an autonomy mode` };
  }
  if (!isVerificationApproach(org.policy.verification)) {
    return {
      ok: false,
      reason: "an organization must state how it verifies before it can be created",
    };
  }
  const policy = validateOrgPolicy(org.policy);
  if (!policy.ok) return { ok: false, reason: policy.reason };

  for (const cp of org.humanCheckpoints ?? []) {
    if (!Object.values(HumanCheckpoint).includes(cp)) {
      return {
        ok: false,
        reason: `'${String(cp)}' is not a checkpoint — expected ${Object.values(HumanCheckpoint).join(" or ")}`,
      };
    }
  }

  const skills = validateBindings(org.skills ?? []);
  // VALIDATED AT LOAD, like the bindings above and for the same reason: this file is edited by
  // hand, and a practice whose subject is a typo matches nothing while reading, in every listing,
  // exactly like a process somebody is following.
  const practices = validatePractices(org.practices ?? []);
  if (!practices.ok) return { ok: false, reason: practices.reason };
  for (const directive of org.directives ?? []) {
    const one = validateDirective(directive);
    if (!one.ok) return { ok: false, reason: one.reason };
  }
  if (!skills.ok) return { ok: false, reason: skills.reason };

  const seen = new Set<string>();
  for (const source of org.sources) {
    if (!Object.values(SourceKind).includes(source.kind)) {
      return { ok: false, reason: `'${String(source.kind)}' is not a source kind` };
    }
    if (seen.has(source.id)) {
      return { ok: false, reason: `two sources are both called '${source.id}'` };
    }
    seen.add(source.id);
    if (source.location.trim() === "") {
      return { ok: false, reason: `source '${source.id}' needs a location` };
    }
    if (source.authFile !== undefined && looksLikeSecret(source.authFile)) {
      return {
        ok: false,
        reason:
          `source '${source.id}' has what looks like a CREDENTIAL in authFile. That field is the ` +
          `PATH to a file holding one — a value here is written to disk and reaches process listings`,
      };
    }
    if (looksLikeSecret(source.location)) {
      return {
        ok: false,
        reason: `source '${source.id}' has credentials embedded in its location; put them in a file and point authFile at it`,
      };
    }
  }

  return { ok: true };
}

/**
 * Whether this organization can be RUN, as opposed to whether the record is well formed.
 *
 * ── WHY THIS IS NOT PART OF `validateOrg` ────────────────────────────────────
 * It used to be, and `validateOrg` runs on every write — so a source-synced organization could
 * never EXIST without sources, not even for the moment between being created and having one
 * connected. That made the guided setup's own `ConnectSources` step unreachable for the single mode
 * that requires it: `org create --intake source_synced` was refused, and there was no other way in.
 *
 * The check itself is right and is kept exactly as it was. What was wrong is WHEN it fired. Being
 * half-configured is the normal state of something a person is still configuring; being
 * half-configured and asked to work is the mistake. So this is asked at the point of running, where
 * "would read an empty backlog forever" is actually true, and the plan is free to walk somebody from
 * one state to the other.
 */
export function runReadinessOf(org: OrgRecord): OrgCheck {
  if (org.intake === Intake.SourceSynced && org.sources.length === 0) {
    return {
      ok: false,
      reason:
        `'${org.orgId}' is source-synced with no sources — it would read an empty backlog forever. ` +
        `Connect one with 'org source add --org ${org.orgId} --kind <jira|linear|confluence|git> ...'`,
    };
  }
  return { ok: true };
}

export function orgById(registry: Registry, orgId: string): OrgRecord | undefined {
  return registry.orgs.find((o) => o.orgId === orgId);
}

/** Add an organization. Refuses a duplicate id rather than replacing one silently. */
export function addOrg(registry: Registry, org: OrgRecord): RegistryResult {
  const valid = validateOrg(org);
  if (!valid.ok) return { ok: false, reason: valid.reason };
  if (orgById(registry, org.orgId) !== undefined) {
    return { ok: false, reason: `an organization called '${org.orgId}' already exists` };
  }
  return { ok: true, registry: { orgs: [...registry.orgs, org] } };
}

/** Replace an organization's record. Refuses to create one by update. */
export function updateOrg(registry: Registry, org: OrgRecord): RegistryResult {
  const valid = validateOrg(org);
  if (!valid.ok) return { ok: false, reason: valid.reason };
  if (orgById(registry, org.orgId) === undefined) {
    return { ok: false, reason: `no organization called '${org.orgId}'` };
  }
  return { ok: true, registry: { orgs: registry.orgs.map((o) => (o.orgId === org.orgId ? org : o)) } };
}

export function removeOrg(registry: Registry, orgId: string): RegistryResult {
  if (orgById(registry, orgId) === undefined) {
    return { ok: false, reason: `no organization called '${orgId}'` };
  }
  return { ok: true, registry: { orgs: registry.orgs.filter((o) => o.orgId !== orgId) } };
}

export function addSource(registry: Registry, orgId: string, source: SourceConfig): RegistryResult {
  const org = orgById(registry, orgId);
  if (org === undefined) return { ok: false, reason: `no organization called '${orgId}'` };
  return updateOrg(registry, { ...org, sources: [...org.sources, source] });
}

export function sourcesOfKind(org: OrgRecord, kind: SourceKind): readonly SourceConfig[] {
  return org.sources.filter((s) => s.kind === kind);
}

/**
 * Parse a registry from JSON, refusing anything that would not validate.
 *
 * A registry file is edited by hand — that is a feature, and it is why this checks rather than
 * casts. Reading an invalid org and failing later, inside a run, would attribute a configuration
 * mistake to the organization's behaviour.
 */
export function parseRegistry(json: string): RegistryResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { ok: false, reason: `registry is not valid JSON: ${String(err)}` };
  }
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { orgs?: unknown }).orgs)) {
    return { ok: false, reason: "a registry is an object with an 'orgs' array" };
  }
  const orgs = (raw as { orgs: unknown[] }).orgs as OrgRecord[];
  for (const org of orgs) {
    const valid = validateOrg(org);
    if (!valid.ok) return { ok: false, reason: `org '${String(org?.orgId)}': ${valid.reason}` };
  }
  const ids = new Set<string>();
  for (const org of orgs) {
    if (ids.has(org.orgId)) return { ok: false, reason: `'${org.orgId}' appears twice` };
    ids.add(org.orgId);
  }
  return { ok: true, registry: { orgs } };
}

/** Serialize, with keys in a stable order so a registry file diffs cleanly. */
export function serializeRegistry(registry: Registry): string {
  const orgs = [...registry.orgs].sort((a, b) => stringCompare(a.orgId, b.orgId));
  return `${JSON.stringify({ orgs }, null, 2)}\n`;
}
