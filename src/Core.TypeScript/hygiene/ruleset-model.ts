// ruleset-model.ts — the PURE half of ruleset-as-code reconciliation.
//
// No I/O, no `gh`, no clock, no randomness: every function here is a total
// function of its arguments, so the whole safety argument for the reconciler
// is unit-testable without touching a live repository (manifesto §7 DST).
//
// Three jobs:
//   1. `refNameMatches` — GitHub's ruleset ref-name glob semantics, faithfully.
//      GitHub uses Ruby's `File.fnmatch` with `File::FNM_PATHNAME`, so `*`
//      does NOT cross `/`. Getting this wrong is not a cosmetic bug: an
//      exclude pattern with the wrong number of path segments silently
//      matches nothing, and a reconciler that "successfully applied" it has
//      changed no behaviour at all. See `coverageDelta` for the falsifier.
//   2. `normalizeRuleset` — the canonical, order-independent projection of a
//      ruleset onto its WRITABLE fields, so idempotency is decidable.
//   3. `classifyChange` — tightening / neutral / widening, fail-closed.
//      This is the safety crux: a reconciler holding `administration: write`
//      can remove every guard in the repository, so any change that could
//      REDUCE enforcement must be separately gated rather than riding along
//      with a file edit nobody read carefully.
//
// Anchors (Beacon):
//   - Ruby `File::FNM_PATHNAME` / `File.fnmatch` — the matcher GitHub
//     documents as the ruleset ref-name engine.
//   - Infrastructure-as-code reconciliation loop (Burgess, "Computer
//     Immunology" 1998; the Kubernetes controller `observe → diff → act`
//     pattern) — desired state in-tree, a controller that converges live to
//     it, and convergence that is verified rather than assumed.

// ---------------------------------------------------------------------------
// Canonical shapes
// ---------------------------------------------------------------------------

export type Enforcement = "active" | "evaluate" | "disabled";

export interface RefNameConditions {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

export interface RulesetRule {
  readonly type: string;
  readonly parameters?: Readonly<Record<string, unknown>> | null;
}

export interface BypassActor {
  readonly actor_id: number | null;
  readonly actor_type: string;
  readonly bypass_mode: string;
}

export interface Ruleset {
  readonly id?: number | null;
  readonly name: string;
  readonly target: string;
  readonly enforcement: Enforcement;
  readonly conditions: { readonly ref_name: RefNameConditions };
  readonly rules: readonly RulesetRule[];
  readonly bypass_actors?: readonly BypassActor[];
}

export interface CanonicalRuleset {
  readonly id: number | null;
  readonly name: string;
  readonly target: string;
  readonly enforcement: Enforcement;
  readonly conditions: { readonly ref_name: RefNameConditions };
  readonly rules: readonly RulesetRule[];
  readonly bypass_actors: readonly BypassActor[];
}

// ---------------------------------------------------------------------------
// 1. Ref-name matching — GitHub `File::FNM_PATHNAME` semantics
// ---------------------------------------------------------------------------

/** Ordinal (codepoint) comparator. Never `localeCompare` — culture-invariant
 *  by default, because a canonical form that sorts differently per machine is
 *  not canonical. */
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeRegExpChar(c: string): string {
  return /[.*+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}

/**
 * Match ONE path segment against ONE glob segment.
 * `*` and `?` never match `/` — but a segment contains no `/` by
 * construction, so the guard is expressed by the caller's split.
 */
function segmentGlob(pattern: string, segment: string): boolean {
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern.charAt(i);
    if (c === "*") {
      re += "[^/]*";
      i += 1;
    } else if (c === "?") {
      re += "[^/]";
      i += 1;
    } else if (c === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close === -1) {
        re += "\\[";
        i += 1;
      } else {
        const raw = pattern.slice(i + 1, close);
        const cls = raw.startsWith("!") ? `^${raw.slice(1)}` : raw;
        re += `[${cls}]`;
        i = close + 1;
      }
    } else if (c === "\\" && i + 1 < pattern.length) {
      re += escapeRegExpChar(pattern.charAt(i + 1));
      i += 2;
    } else {
      re += escapeRegExpChar(c);
      i += 1;
    }
  }
  re += "$";
  try {
    return new RegExp(re).test(segment);
  } catch {
    // A malformed character class is treated as a literal non-match rather
    // than crashing the reconciler. Fail-closed: an unmatchable pattern
    // covers nothing, which `coverageDelta` will surface as released refs.
    return false;
  }
}

function segmentsMatch(
  patternSegs: readonly string[],
  refSegs: readonly string[],
): boolean {
  if (patternSegs.length === 0) return refSegs.length === 0;
  const head = patternSegs[0] as string;
  const rest = patternSegs.slice(1);
  if (head === "**") {
    // `**` matches zero or more whole segments.
    for (let i = 0; i <= refSegs.length; i += 1) {
      if (segmentsMatch(rest, refSegs.slice(i))) return true;
    }
    return false;
  }
  if (refSegs.length === 0) return false;
  if (!segmentGlob(head, refSegs[0] as string)) return false;
  return segmentsMatch(rest, refSegs.slice(1));
}

/**
 * Does a ruleset ref-name pattern match a fully-qualified ref?
 *
 * `pattern` may be a fully-qualified `refs/...` glob, a bare branch glob
 * (interpreted under `refs/heads/`), or one of GitHub's sentinels
 * `~ALL` / `~DEFAULT_BRANCH`.
 *
 * The load-bearing property, and the reason this function exists rather than
 * a one-line regex: `*` does not cross `/`. So `refs/heads/*-flush-*` (three
 * segments) does NOT match `refs/heads/heartbeat/otto-flush-abc` (four
 * segments) — it matches nothing at all in a repo whose branches all live one
 * level deep under a namespace.
 */
export function refNameMatches(
  pattern: string,
  ref: string,
  defaultBranch: string,
): boolean {
  if (pattern === "~ALL") return true;
  if (pattern === "~DEFAULT_BRANCH") return ref === `refs/heads/${defaultBranch}`;
  const qualified = pattern.startsWith("refs/")
    ? pattern
    : `refs/heads/${pattern}`;
  return segmentsMatch(qualified.split("/"), ref.split("/"));
}

/** Refs a ruleset's conditions actually cover: included and not excluded. */
export function coveredRefs(
  conditions: { readonly ref_name: RefNameConditions },
  refs: readonly string[],
  defaultBranch: string,
): string[] {
  const { include, exclude } = conditions.ref_name;
  return refs
    .filter((ref) => include.some((p) => refNameMatches(p, ref, defaultBranch)))
    .filter((ref) => !exclude.some((p) => refNameMatches(p, ref, defaultBranch)))
    .sort(ordinal);
}

export interface CoverageDelta {
  readonly beforeCount: number;
  readonly afterCount: number;
  /** Covered before, not covered after — protection REMOVED from these. */
  readonly released: readonly string[];
  /** Covered after, not covered before — protection ADDED to these. */
  readonly newlyCovered: readonly string[];
}

/**
 * The semantic falsifier for a conditions change.
 *
 * Verifying that a PATCH round-trips the JSON you sent proves only that
 * GitHub stored your string. It does not prove the string MEANS what you
 * intended. `coverageDelta` re-derives the actual ref sets from live ref
 * names, so a pattern that silently matches nothing shows up as
 * `released.length === 0` and can be refused against a declared expectation.
 */
export function coverageDelta(
  live: { readonly ref_name: RefNameConditions },
  desired: { readonly ref_name: RefNameConditions },
  refs: readonly string[],
  defaultBranch: string,
): CoverageDelta {
  const before = coveredRefs(live, refs, defaultBranch);
  const after = coveredRefs(desired, refs, defaultBranch);
  const afterSet = new Set(after);
  const beforeSet = new Set(before);
  return {
    beforeCount: before.length,
    afterCount: after.length,
    released: before.filter((r) => !afterSet.has(r)),
    newlyCovered: after.filter((r) => !beforeSet.has(r)),
  };
}

// ---------------------------------------------------------------------------
// 2. Canonicalization — so "no change" is decidable and idempotency is real
// ---------------------------------------------------------------------------

/** Deterministic JSON with ordinally-sorted object keys at every depth. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort(ordinal)) out[key] = sortKeys(src[key]);
    return out;
  }
  return value;
}

function ruleKey(rule: RulesetRule): string {
  const params =
    rule.parameters === undefined || rule.parameters === null
      ? ""
      : canonicalJson(rule.parameters);
  return `${rule.type} ${params}`;
}

function actorKey(actor: BypassActor): string {
  return `${actor.actor_type} ${String(actor.actor_id)} ${actor.bypass_mode}`;
}

/**
 * Project a ruleset (from the API or from a desired-state file) onto the
 * fields a reconciler may write, in a canonical order.
 *
 * Read-only server fields (`node_id`, `created_at`, `updated_at`, `_links`,
 * `source`, `source_type`, `current_user_can_bypass`, and the per-rule
 * `ruleset_id` / `ruleset_source` echoes) are dropped: including them would
 * make every comparison drift on GitHub's bookkeeping and destroy the no-op
 * property.
 */
export function normalizeRuleset(input: Ruleset): CanonicalRuleset {
  const rules = [...input.rules]
    .map((r) => {
      const hasParams =
        r.parameters !== undefined &&
        r.parameters !== null &&
        Object.keys(r.parameters).length > 0;
      return hasParams
        ? ({
            type: r.type,
            parameters: sortKeys(r.parameters) as Record<string, unknown>,
          } satisfies RulesetRule)
        : ({ type: r.type } satisfies RulesetRule);
    })
    .sort((a, b) => ordinal(ruleKey(a), ruleKey(b)));

  const bypass = [...(input.bypass_actors ?? [])]
    .map((a) => ({
      actor_id: a.actor_id ?? null,
      actor_type: a.actor_type,
      bypass_mode: a.bypass_mode,
    }))
    .sort((a, b) => ordinal(actorKey(a), actorKey(b)));

  return {
    id: input.id ?? null,
    name: input.name,
    target: input.target,
    enforcement: input.enforcement,
    conditions: {
      ref_name: {
        include: [...input.conditions.ref_name.include].sort(ordinal),
        exclude: [...input.conditions.ref_name.exclude].sort(ordinal),
      },
    },
    rules,
    bypass_actors: bypass,
  };
}

/** The empty baseline a ruleset that does not exist yet is diffed against. */
export function emptyBaseline(name: string, target: string): CanonicalRuleset {
  return {
    id: null,
    name,
    target,
    enforcement: "disabled",
    conditions: { ref_name: { include: [], exclude: [] } },
    rules: [],
    bypass_actors: [],
  };
}

// ---------------------------------------------------------------------------
// 3. Classification — tightening / neutral / widening, fail-closed
// ---------------------------------------------------------------------------

export type ChangeKind = "tightening" | "neutral" | "widening";
export type Verdict = "no-op" | ChangeKind;

export interface Change {
  readonly kind: ChangeKind;
  readonly path: string;
  readonly detail: string;
}

export interface Classification {
  readonly verdict: Verdict;
  readonly changes: readonly Change[];
}

const ENFORCEMENT_RANK: Readonly<Record<Enforcement, number>> = {
  disabled: 0,
  evaluate: 1,
  active: 2,
};

/** Params where a DECREASE in the number widens (fewer approvals required). */
const NUMERIC_HIGHER_IS_TIGHTER = new Set(["required_approving_review_count"]);

/** Params where `true` is the tighter value. */
const BOOL_TRUE_IS_TIGHTER = new Set([
  "dismiss_stale_reviews_on_push",
  "require_code_owner_review",
  "require_last_push_approval",
  "required_review_thread_resolution",
  "strict_required_status_checks_policy",
  "review_on_push",
  "review_draft_pull_requests",
]);

/** Params where `true` is the LOOSER value (an escape hatch). */
const BOOL_TRUE_IS_LOOSER = new Set(["do_not_enforce_on_create"]);

/** List params where GAINING an entry widens (more ways through the gate). */
const LIST_GROWTH_WIDENS = new Set(["allowed_merge_methods"]);

function widen(path: string, detail: string): Change {
  return { kind: "widening", path, detail };
}
function tighten(path: string, detail: string): Change {
  return { kind: "tightening", path, detail };
}

function multiset(keys: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

function classifyParams(
  ruleType: string,
  live: Readonly<Record<string, unknown>>,
  desired: Readonly<Record<string, unknown>>,
): Change[] {
  const changes: Change[] = [];
  const keys = [...new Set([...Object.keys(live), ...Object.keys(desired)])].sort(
    ordinal,
  );
  for (const key of keys) {
    const a = live[key];
    const b = desired[key];
    if (canonicalJson(a) === canonicalJson(b)) continue;
    const path = `rules[${ruleType}].parameters.${key}`;

    if (typeof a === "boolean" && typeof b === "boolean") {
      if (BOOL_TRUE_IS_TIGHTER.has(key)) {
        changes.push(
          b ? tighten(path, `false → true`) : widen(path, `true → false`),
        );
        continue;
      }
      if (BOOL_TRUE_IS_LOOSER.has(key)) {
        changes.push(
          b ? widen(path, `false → true`) : tighten(path, `true → false`),
        );
        continue;
      }
      changes.push(widen(path, `unknown boolean parameter changed (fail-closed)`));
      continue;
    }

    if (typeof a === "number" && typeof b === "number") {
      if (NUMERIC_HIGHER_IS_TIGHTER.has(key)) {
        changes.push(
          b > a ? tighten(path, `${a} → ${b}`) : widen(path, `${a} → ${b}`),
        );
        continue;
      }
      changes.push(widen(path, `unknown numeric parameter changed (fail-closed)`));
      continue;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      const growthWidens = LIST_GROWTH_WIDENS.has(key);
      const before = multiset(a.map((x) => canonicalJson(x)));
      const after = multiset(b.map((x) => canonicalJson(x)));
      for (const [k, n] of before) {
        const removed = n - (after.get(k) ?? 0);
        if (removed > 0) {
          changes.push(
            growthWidens
              ? tighten(path, `removed ${k}`)
              : widen(path, `removed ${k}`),
          );
        }
      }
      for (const [k, n] of after) {
        const added = n - (before.get(k) ?? 0);
        if (added > 0) {
          changes.push(
            growthWidens ? widen(path, `added ${k}`) : tighten(path, `added ${k}`),
          );
        }
      }
      continue;
    }

    // Type change, object change, or anything unrecognised: fail closed.
    changes.push(widen(path, `unrecognised parameter change (fail-closed)`));
  }
  return changes;
}

/**
 * Classify the change required to bring `live` to `desired`.
 *
 * The verdict is `widening` if ANY component change widens, even when other
 * components tighten. A change set is only as safe as its loosest member, and
 * netting them out is how a bypass actor rides in on a lint fix.
 */
export function classifyChange(
  live: CanonicalRuleset,
  desired: CanonicalRuleset,
): Classification {
  const changes: Change[] = [];

  if (live.target !== desired.target) {
    changes.push(
      widen("target", `${live.target} → ${desired.target} (fail-closed)`),
    );
  }
  if (live.name !== desired.name) {
    changes.push({
      kind: "neutral",
      path: "name",
      detail: `"${live.name}" → "${desired.name}"`,
    });
  }

  const liveRank = ENFORCEMENT_RANK[live.enforcement];
  const desiredRank = ENFORCEMENT_RANK[desired.enforcement];
  if (desiredRank < liveRank) {
    changes.push(
      widen("enforcement", `${live.enforcement} → ${desired.enforcement}`),
    );
  } else if (desiredRank > liveRank) {
    changes.push(
      tighten("enforcement", `${live.enforcement} → ${desired.enforcement}`),
    );
  }

  // --- ref_name.include: losing coverage widens ---
  const liveInc = new Set(live.conditions.ref_name.include);
  const desiredInc = new Set(desired.conditions.ref_name.include);
  for (const p of [...liveInc].sort(ordinal)) {
    if (!desiredInc.has(p)) {
      changes.push(widen("conditions.ref_name.include", `removed "${p}"`));
    }
  }
  for (const p of [...desiredInc].sort(ordinal)) {
    if (!liveInc.has(p)) {
      changes.push(tighten("conditions.ref_name.include", `added "${p}"`));
    }
  }

  // --- ref_name.exclude: carving refs OUT of coverage widens ---
  const liveExc = new Set(live.conditions.ref_name.exclude);
  const desiredExc = new Set(desired.conditions.ref_name.exclude);
  for (const p of [...desiredExc].sort(ordinal)) {
    if (!liveExc.has(p)) {
      changes.push(widen("conditions.ref_name.exclude", `added "${p}"`));
    }
  }
  for (const p of [...liveExc].sort(ordinal)) {
    if (!desiredExc.has(p)) {
      changes.push(tighten("conditions.ref_name.exclude", `removed "${p}"`));
    }
  }

  // --- rules: by type, then by parameters ---
  const liveByType = new Map(live.rules.map((r) => [r.type, r]));
  const desiredByType = new Map(desired.rules.map((r) => [r.type, r]));
  for (const type of [
    ...new Set([...liveByType.keys(), ...desiredByType.keys()]),
  ].sort(ordinal)) {
    const l = liveByType.get(type);
    const d = desiredByType.get(type);
    if (l !== undefined && d === undefined) {
      changes.push(widen("rules", `removed rule "${type}"`));
      continue;
    }
    if (l === undefined && d !== undefined) {
      changes.push(tighten("rules", `added rule "${type}"`));
      continue;
    }
    if (l === undefined || d === undefined) continue;
    changes.push(
      ...classifyParams(
        type,
        (l.parameters ?? {}) as Record<string, unknown>,
        (d.parameters ?? {}) as Record<string, unknown>,
      ),
    );
  }

  // --- bypass_actors: anyone who can skip the rule is a hole in it ---
  const liveActors = new Map(live.bypass_actors.map((a) => [actorIdentity(a), a]));
  const desiredActors = new Map(
    desired.bypass_actors.map((a) => [actorIdentity(a), a]),
  );
  for (const key of [
    ...new Set([...liveActors.keys(), ...desiredActors.keys()]),
  ].sort(ordinal)) {
    const l = liveActors.get(key);
    const d = desiredActors.get(key);
    if (l === undefined && d !== undefined) {
      changes.push(
        widen("bypass_actors", `added ${key} (bypass_mode=${d.bypass_mode})`),
      );
      continue;
    }
    if (l !== undefined && d === undefined) {
      changes.push(tighten("bypass_actors", `removed ${key}`));
      continue;
    }
    if (l === undefined || d === undefined) continue;
    if (l.bypass_mode !== d.bypass_mode) {
      // "always" is strictly looser than "pull_request".
      const looser = d.bypass_mode === "always" && l.bypass_mode !== "always";
      changes.push(
        looser
          ? widen("bypass_actors", `${key}: ${l.bypass_mode} → ${d.bypass_mode}`)
          : tighten("bypass_actors", `${key}: ${l.bypass_mode} → ${d.bypass_mode}`),
      );
    }
  }

  const verdict: Verdict = changes.some((c) => c.kind === "widening")
    ? "widening"
    : changes.some((c) => c.kind === "tightening")
      ? "tightening"
      : changes.length > 0
        ? "neutral"
        : "no-op";

  return { verdict, changes };
}

function actorIdentity(a: BypassActor): string {
  return `${a.actor_type}#${String(a.actor_id)}`;
}
