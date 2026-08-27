#!/usr/bin/env bun
/**
 * carry-resolvers.ts — decide a carry conflict WITHOUT coordination, or refuse loudly.
 *
 * A heartbeat is supposed to reach `main` with zero coordination. Appending an immutable,
 * content-addressed file already achieves that: two agents never touch the same bytes, so
 * there is nothing to agree about. What breaks it is that the same ticks ALSO rewrite shared
 * aggregate documents, and a shared mutable document is coordination by construction — every
 * writer must agree on one byte sequence, which is precisely the thing the design says it
 * does not need.
 *
 * Measured 2026-08-27, both live lanes, both stuck for hours on exactly this:
 *
 *   heartbeat/alexa-flush  #15816  docs/room-evidence/index.json
 *   heartbeat/drift-sweep  #15808  data/drift-{evolution,genome,mtth,proposal}.json
 *                                  docs/drift-events/slo-filed.json
 *
 * Nine files, three shapes, and NONE of them actually needs coordination — each has a rule
 * that decides it from the documents alone. That is what this file provides. It is the
 * second half of `prepare-heartbeat-branch.ts`'s carry rule: `isLosslessLineExtension` is a
 * per-tick MEASUREMENT that asks "can these be carried without deciding anything?"; when the
 * answer is no, the question becomes "is there a rule that decides it?" — and only when THAT
 * answer is no does a human need to be involved.
 *
 * WHY NOT A GIT MERGE DRIVER. `.gitattributes` already carries the argument in full (see the
 * `NO NINTH HEARTBEAT LINE` block): a per-path `merge=` line is an ASSERTION a human makes
 * once that nothing rechecks, and `union` on a pretty-printed JSON object emits UNPARSEABLE
 * JSON with exit code 0 on the divergent case. A mechanism whose failure mode is a green run
 * over corrupt published data is worse than the wedge it clears. Every resolver here
 * re-serialises from parsed values and the caller re-parses the result, so a resolver cannot
 * publish something that will not load.
 *
 * REFUSAL IS THE POINT, NOT THE FALLBACK. A resolver that always resolves is a check that
 * cannot fail wearing a helpful expression — it would silently pick a winner on the one case
 * where the two sides genuinely disagree, which is the only case where a human is needed.
 * Each resolver below has a refusal condition and each refusal is separately falsified.
 *
 * §13 noninterference: pure functions of (base, ours, theirs). No clock, no filesystem, no
 * network. The same three inputs always produce the same decision (§7 DST).
 */

/** The outcome of asking a rule to decide one conflicted path. */
export type CarryResolution =
  | {
      readonly kind: "resolved";
      /** Canonical bytes to write. Always re-serialised, never a spliced hunk. */
      readonly content: string;
      /** Which rule decided, for the commit message and the audit trail. */
      readonly rule: string;
      /** Why it decided that way, in terms a reviewer can check against the inputs. */
      readonly why: string;
    }
  | {
      readonly kind: "refused";
      readonly rule: string;
      readonly why: string;
    };

/** One conflicted path. `base` is `null` when both sides ADDED the file (the squash topology). */
export interface CarryConflict {
  readonly path: string;
  readonly base: string | null;
  /** `main`'s content. */
  readonly ours: string;
  /** The lane's content. */
  readonly theirs: string;
}

export type CarryResolver = (conflict: CarryConflict) => CarryResolution;

/** Pretty-print exactly as the publishers do, so a resolved file is byte-identical to a written one. */
function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parse(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * RULE 1 — latest tick wins.
 *
 * For a document that is a SNAPSHOT of a fold rather than an accumulation: `data/drift-*.json`
 * carry a `tick` or `latestTick` and every other field is that tick's output. There is no
 * union to take — the newer snapshot is simply the right one, and "newer" is a total order
 * written inside the documents themselves, so no coordination is required to evaluate it.
 *
 * Note what is deliberately NOT used: which BRANCH a side came from. Resolving lane-wins or
 * main-wins would be a policy that silently discards the newer writer half the time — and on
 * 2026-08-27 the lane held tick 989 against main's 987 on all four files, which would have
 * made a `merge=theirs` declaration look correct while being wrong at the next flush.
 *
 * Refuses when: the field is absent or non-numeric on either side (nothing to order by), or
 * the ticks are EQUAL while the content differs — two different outputs claiming the same
 * tick is a real disagreement and the fold that produced them is what needs looking at.
 */
export function latestTickWins(tickFields: readonly string[]): CarryResolver {
  const rule = `latest-tick-wins(${tickFields.join("|")})`;
  return ({ ours, theirs }) => {
    const o = parse(ours);
    const t = parse(theirs);
    if (!isRecord(o) || !isRecord(t)) {
      return { kind: "refused", rule, why: "one side is not a JSON object" };
    }
    const field = tickFields.find((f) => typeof o[f] === "number" && typeof t[f] === "number");
    if (field === undefined) {
      return {
        kind: "refused",
        rule,
        why: `no shared numeric tick field among ${tickFields.join(", ")} — nothing to order by`,
      };
    }
    const ot = o[field] as number;
    const tt = t[field] as number;
    if (ot === tt) {
      if (canonicalJson(o) === canonicalJson(t)) {
        return { kind: "resolved", content: canonicalJson(o), rule, why: `identical at ${field} ${String(ot)}` };
      }
      return {
        kind: "refused",
        rule,
        why: `both sides claim ${field} ${String(ot)} with different content — a real disagreement, not a race`,
      };
    }
    const winner = tt > ot ? t : o;
    const side = tt > ot ? "lane" : "main";
    return {
      kind: "resolved",
      content: canonicalJson(winner),
      rule,
      why: `${side} is newer: ${field} ${String(Math.max(ot, tt))} > ${String(Math.min(ot, tt))}`,
    };
  };
}

/**
 * RULE 2 — three-way merge of a keyed map.
 *
 * For `docs/drift-events/slo-filed.json` and its shape: an object whose KEYS are the facts.
 * The naive answer is union, and union is wrong — measured on the live case, base held
 * `MD037`, `main` had DELETED it, and the lane had added `BD001`. Union resurrects a key that
 * a writer deliberately removed, which is data corruption that looks like generosity.
 *
 * The rule: a key present in base and missing from either side was DELETED and stays deleted;
 * a key added by either side is kept. Both are decidable per key with no coordination.
 *
 * Refuses when: a key was CHANGED on both sides to different values. That is the genuine
 * concurrent-edit case and no rule can settle it from the documents alone.
 */
export function keyedMapThreeWay(): CarryResolver {
  const rule = "keyed-map-3way";
  return ({ base, ours, theirs }) => {
    const b = base === null ? {} : parse(base);
    const o = parse(ours);
    const t = parse(theirs);
    if (!isRecord(b) || !isRecord(o) || !isRecord(t)) {
      return { kind: "refused", rule, why: "one side is not a JSON object" };
    }
    const out: Record<string, unknown> = {};
    const conflicts: string[] = [];
    for (const k of [...new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)])].sort()) {
      const inB = k in b;
      const inO = k in o;
      const inT = k in t;
      if (inB && (!inO || !inT)) continue; // deletion by either side wins over no-change
      if (!inO && !inT) continue;
      if (inO && inT) {
        const so = JSON.stringify(o[k]);
        const st = JSON.stringify(t[k]);
        if (so === st) {
          out[k] = o[k];
          continue;
        }
        const sb = inB ? JSON.stringify(b[k]) : undefined;
        if (sb !== undefined && sb === so) out[k] = t[k]; // only the lane changed it
        else if (sb !== undefined && sb === st) out[k] = o[k]; // only main changed it
        else conflicts.push(k);
        continue;
      }
      out[k] = inO ? o[k] : t[k];
    }
    if (conflicts.length > 0) {
      return {
        kind: "refused",
        rule,
        why: `key(s) changed on BOTH sides to different values: ${conflicts.join(", ")}`,
      };
    }
    return {
      kind: "resolved",
      content: canonicalJson(out),
      rule,
      why: `${String(Object.keys(out).length)} key(s) after three-way (deletions honoured, additions kept)`,
    };
  };
}

/**
 * RULE 3 — three-way merge of a keyed SET held in an array.
 *
 * `docs/room-evidence/index.json` is `{ schema, entries: [...] }` sorted by `eventId`, and
 * every entry is content-addressed: `auditContentKey` and `receiptContentKey` are hashes of
 * the event envelope and its receipt. That is what makes this decidable with no coordination —
 * two writers cannot produce different entries for the same `eventId` unless one of them is
 * wrong, and `readPublishedFeed` already recomputes both keys and rejects a mismatch.
 *
 * So the entries are facts and the array is their raw vault: append what either side added,
 * honour what either side deleted, sort canonically so the next writer's insert is
 * deterministic. Git conflicts here on ADJACENCY, never on meaning — a new low-sorting entry
 * lands in front of what main holds, which is lossless but is not a prefix.
 *
 * Refuses when: the same key carries different payloads on the two sides. Under
 * content-addressing that cannot happen honestly, so it must never be papered over.
 */
export function keyedSetThreeWay(arrayField: string, idField: string): CarryResolver {
  const rule = `keyed-set-3way(${arrayField}.${idField})`;
  const index = (v: Record<string, unknown>): Map<string, unknown> | null => {
    const arr = v[arrayField];
    if (!Array.isArray(arr)) return null;
    const m = new Map<string, unknown>();
    for (const e of arr) {
      if (!isRecord(e) || typeof e[idField] !== "string") return null;
      m.set(e[idField], e);
    }
    return m;
  };
  return ({ base, ours, theirs }) => {
    const b = base === null ? {} : parse(base);
    const o = parse(ours);
    const t = parse(theirs);
    if (!isRecord(o) || !isRecord(t) || !isRecord(b)) {
      return { kind: "refused", rule, why: "one side is not a JSON object" };
    }
    const bi = arrayField in b ? index(b) : new Map<string, unknown>();
    const oi = index(o);
    const ti = index(t);
    if (bi === null || oi === null || ti === null) {
      return { kind: "refused", rule, why: `\`${arrayField}\` is not an array of objects keyed by \`${idField}\`` };
    }
    const out = new Map<string, unknown>();
    const conflicts: string[] = [];
    for (const k of [...new Set([...bi.keys(), ...oi.keys(), ...ti.keys()])].sort()) {
      const inB = bi.has(k);
      const inO = oi.has(k);
      const inT = ti.has(k);
      if (inB && (!inO || !inT)) continue;
      if (!inO && !inT) continue;
      if (inO && inT) {
        if (JSON.stringify(oi.get(k)) === JSON.stringify(ti.get(k))) out.set(k, oi.get(k));
        else conflicts.push(k);
        continue;
      }
      out.set(k, inO ? oi.get(k) : ti.get(k));
    }
    if (conflicts.length > 0) {
      return {
        kind: "refused",
        rule,
        why:
          `${idField}(s) carry different payloads on the two sides: ${conflicts.join(", ")}. ` +
          "Under content-addressing that cannot happen honestly — do not merge this by hand.",
      };
    }
    // The lane's non-array fields win only when identical to main's; a schema change is a
    // decision, not a carry.
    const oRest = { ...o };
    const tRest = { ...t };
    delete oRest[arrayField];
    delete tRest[arrayField];
    if (JSON.stringify(oRest) !== JSON.stringify(tRest)) {
      return { kind: "refused", rule, why: "the document's non-entry fields differ (schema or metadata changed)" };
    }
    return {
      kind: "resolved",
      content: canonicalJson({ ...oRest, [arrayField]: [...out.values()] }),
      rule,
      why: `${String(out.size)} ${idField}(s) after three-way, sorted (deletions honoured, additions kept)`,
    };
  };
}

/**
 * The registry: exact repo paths to the rule that decides them.
 *
 * EXACT PATHS, not globs. A glob is an assertion about files that do not exist yet — it would
 * silently adopt the next file someone drops into `data/` under a rule nobody chose for it,
 * and the failure would be a green resolve over a document the rule does not fit. Adding a
 * path here is a decision, and it should read like one.
 */
export const CARRY_RESOLVERS: ReadonlyMap<string, CarryResolver> = new Map<string, CarryResolver>([
  ["docs/room-evidence/index.json", keyedSetThreeWay("entries", "eventId")],
  ["docs/drift-events/slo-filed.json", keyedMapThreeWay()],
  ["data/drift-evolution.json", latestTickWins(["tick"])],
  ["data/drift-genome.json", latestTickWins(["tick"])],
  ["data/drift-mtth.json", latestTickWins(["latestTick"])],
  ["data/drift-proposal.json", latestTickWins(["latestTick"])],
]);

/**
 * Resolve one conflict, or say why it cannot be resolved.
 *
 * An UNREGISTERED path refuses. That is the default and it must stay the default: adopting an
 * unknown document under a guessed rule is how a resolver becomes the corruption mechanism it
 * was built to prevent.
 *
 * A resolved result is re-parsed before it is returned. `merge=union`'s defect was emitting
 * unparseable JSON with exit code 0; a resolver that could do the same would inherit it.
 */
export function resolveCarryConflict(
  conflict: CarryConflict,
  resolvers: ReadonlyMap<string, CarryResolver> = CARRY_RESOLVERS,
): CarryResolution {
  const resolver = resolvers.get(conflict.path);
  if (resolver === undefined) {
    return {
      kind: "refused",
      rule: "unregistered",
      why: `no carry rule is declared for \`${conflict.path}\` — refusing rather than guessing one`,
    };
  }
  const result = resolver(conflict);
  if (result.kind === "resolved" && parse(result.content) === undefined) {
    return {
      kind: "refused",
      rule: result.rule,
      why: "the resolver produced unparseable JSON — refused rather than published",
    };
  }
  return result;
}

/** Resolve a whole conflict set. All-or-nothing: one refusal leaves the carry for a human. */
export function resolveCarrySet(
  conflicts: readonly CarryConflict[],
  resolvers: ReadonlyMap<string, CarryResolver> = CARRY_RESOLVERS,
): {
  readonly resolved: ReadonlyMap<string, CarryResolution & { kind: "resolved" }>;
  readonly refused: ReadonlyMap<string, CarryResolution & { kind: "refused" }>;
  readonly complete: boolean;
} {
  const resolved = new Map<string, CarryResolution & { kind: "resolved" }>();
  const refused = new Map<string, CarryResolution & { kind: "refused" }>();
  for (const c of conflicts) {
    const r = resolveCarryConflict(c, resolvers);
    if (r.kind === "resolved") resolved.set(c.path, r);
    else refused.set(c.path, r);
  }
  return { resolved, refused, complete: refused.size === 0 && conflicts.length > 0 };
}
