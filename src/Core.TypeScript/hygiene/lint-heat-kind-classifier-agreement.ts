#!/usr/bin/env bun
// lint-heat-kind-classifier-agreement.ts — one classifier for the deferral/destruction bit.
//
// 081M010W1BP087G0R002M2BNVW. `src/Core/Heat.fs` used to decide "is this kind pressure?"
// TWICE, by two independent routes:
//
//   HeatSignature.isPressureKind  = isBackpressureKind || isDeniedKind        (substring disjunction)
//   HeatSignal.ofKind             = ordered chain testing FORGETTING FIRST,
//                                   then HeatSignal.isPressure read off the result
//
// A kind carrying BOTH a forgetting token and a pressure token ("soft-emu.prune-backpressure")
// takes the forgetting branch, so route 2 says "not pressure" while route 1 says "pressure".
// Executed and confirmed: 3 of 3 dual-token probes disagreed.
//
// That bit is not cosmetic. The composition law from the backpressure study (PR #10693) is
// that operators which only DEFER compose as a monoid and operators which DESTROY do not —
// and pressure-vs-loss IS that discriminator. Two classifiers of it means the composition
// property is answered differently depending on which one you ask, which defeats the point
// of having a decidable law.
//
// HOW IT WAS ACTUALLY FIXED (#10804, on main). Not the way this lint's first draft assumed.
// `HeatSignature.isPressureKind` was NOT deleted, and `ofKind` is NOT the classifier. A third
// binding — `HeatSignature.classifyKind` — became the single ordered chain, and BOTH routes
// were rewritten to read it:
//
//   classifyKind : string -> KindClass          the ONE chain, the only consumer of the probes
//   HeatSignature.isPressureKind = classifyKind >> (Backpressure | Denied)
//   HeatSignal.ofKind            = classifyKind >> (KindClass -> HeatSignal)
//
// and the chain's order was INVERTED relative to the pre-fix `ofKind`: backpressure is tested
// FIRST, so a dual-token kind is now **pressure**. That is the fail-safe direction — missing a
// pressure signal makes `TemperatureReadout` read cold for a room under genuine backpressure.
//
// This lint's first draft pinned the classifier by NAME (`ofKind`) and so went red on main for
// a shape that is correct. A structural model that names the binding it expects catches renames,
// not second classifiers. PART B below therefore DISCOVERS the classifier instead of naming it,
// and pays for the lost name-pin with two checks the name-pin never made (B2, B3).
//
//   PART A — the ambiguous class stays EMPTY. No emitted heat-kind literal may carry both a
//            forgetting token and a pressure token. The single classifier still resolves such
//            a kind by branch ORDER rather than by meaning, so the honest guard is to refuse
//            the input class rather than to pretend the ordering is a decision. Under the
//            post-#10804 order a dual-token kind reads Backpressure => Deferred, so a kind
//            literally named `*.prune-backpressure` would claim a composition law it does not
//            satisfy (it destroys). PART A is what keeps that class empty.
//
//   PART B — pressure is decided in exactly ONE place, checked three ways:
//     B1  EXACTLY ONE binding in Heat.fs consumes the raw substring probes
//         (`isBackpressureKind` / `isDeniedKind`). That binding IS the single classifier,
//         whatever it is called. Two => the original defect is back. Zero => nothing
//         classifies and this lint has gone blind.
//     B2  NO UNNAMED PROBE. Every binding that calls `kindContains` must be one of the parsed
//         `is*Kind` token predicates. A second classifier that inlines `kindContains
//         "backpressure"` would slip past B1 entirely; this closes that door. The name-pinned
//         first draft had this hole too.
//     B3  THE PRESSURE BIT IS ENUMERATED ONCE. Rewritten by 081M07Z23EX087G0R003N676FT, which
//         landed the derive this check used to only ask for. B3 used to guard "two agreeing
//         tables" — one over `KindClass`, one over `HeatSignal`, compared under `ofKind`. That
//         is strictly weaker than "one table", and Heat.fs now has one:
//
//           HeatSignature.isPressureClass : KindClass -> bool     the ONE table
//           HeatSignal.classOf            : HeatSignal -> KindClass   correspondence, decides nothing
//           HeatSignal.isPressure         = classOf >> isPressureClass
//
//         So B3's subject changed rather than disappearing, and it splits in two:
//
//         B3a  EXACTLY ONE pressure table exists, and it is the `KindClass`-keyed one. A
//              `HeatSignal`-keyed `-> true` table reappearing IS the membership split coming
//              back, and it is now a part-B failure rather than something to be compared.
//              (Keeping the old "do the two tables agree?" comparison after the derive would be
//              the vacuity class: with one table there is nothing to disagree with.)
//         B3b  THE CORRESPONDENCE IS A BIJECTION. `ofKind` maps KindClass -> HeatSignal and
//              `classOf` maps HeatSignal -> KindClass; B3b parses both and requires them to be
//              MUTUAL INVERSES. This is where the teeth moved to. The derive trades a
//              membership split the compiler could not see for a miswire the compiler also
//              cannot see (`classOf` is exhaustive whatever it maps to), and this is the check
//              that refuses the miswire. It strictly subsumes the old comparison: the old one
//              only saw miswires that changed a PRESSURE arm, this one sees every arm.
//
// SCAN FLOORS. Both parts exit non-zero if they inspected fewer sites than the stated
// minimum. A guard whose extraction patterns quietly stop matching reports "clean" forever;
// that is the blind-instrument failure this repo has been finding all week, and a lint is not
// exempt from it. The floors are what make a green run mean "I looked and found nothing"
// rather than "I did not look". Every B check carries its own — B1/B2/B3 each fail when the
// thing they inspect could not be parsed, never when it merely could not be found.
//
// Usage: bun src/Core.TypeScript/hygiene/lint-heat-kind-classifier-agreement.ts
// Exit:  0 — one classifier, and no dual-token kind literal
//        1 — a second classifier, a dual-token kind, or a scan that fell below its floor

import { readFileSync, existsSync } from "node:fs";

const HEAT_FS = "src/Core/Heat.fs";

/**
 * Files that can give birth to a heat `Kind` string, plus the treaty that enumerates the
 * vocabulary. Explicit rather than globbed: a new emitter should have to appear here, which
 * makes the corpus reviewable and keeps the scan floor meaningful.
 */
const KIND_SOURCES: readonly string[] = [
  "src/Core/Heat.fs",
  "src/Core/WSetHeat.fs",
  "src/Core/MetaCart.fs",
  "src/Core/RoomAdmission.fs",
  "src/Core/RoomHorizon.fs",
  "src/Core/RoomBoundary.fs",
  "src/Core/SoftEmu.fs",
  "src/Core/SchedulerShedHeat.fs",
  "src/Core/DarkHallScheduler.fs",
  "src/Core/DarkHallRoomLoop.fs",
  "src/Core/DarkHallCabinetRuntime.fs",
  "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json",
];

/** Minimum kind literals PART A must inspect before a clean result means anything. */
const KIND_SCAN_FLOOR = 30;
/** Minimum token-predicate definitions PART B must find in Heat.fs. */
const PREDICATE_SCAN_FLOOR = 6;

/**
 * PER-PATTERN floor, and why the aggregate floor alone is not enough.
 *
 * Measured, not assumed: disabling ONE of the four extraction patterns dropped the corpus
 * from 33 kinds to 30, and at an aggregate floor of 20 the lint still exited 0 and printed
 * "OK". A guard that keeps reporting clean while an entire extraction route has gone dark is
 * precisely the blind instrument this file exists to prevent — found in this file, by
 * planting the mutant instead of trusting the design.
 *
 * So every NAMED pattern must contribute at least one match. Extraction drift now fails
 * immediately, whatever the remaining patterns happen to cover.
 */
const PATTERN_FLOOR = 1;

// ── extraction ────────────────────────────────────────────────────────────────

/** Strip F# comments so a token named in prose is not mistaken for a reference. */
export function stripFSharpComments(source: string): string {
  return source
    .replace(/\(\*[\s\S]*?\*\)/g, " ")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/**
 * Heat-kind string literals reachable by a classifier.
 *
 * Deliberately targeted rather than "every string in the file": a broad net would sweep in
 * unrelated record fields (`Kind = "gen"`, `Kind = "treaty"`, …) and the noise would push
 * someone to weaken the check. The cost of being targeted is that a new emission shape is
 * invisible — which is exactly what the scan floor is here to catch.
 */
const EMITTERS = String.raw`(?:HeatSignature\.ofMass|BoundedHeat\.signature|BoundedHeat\.emit|positiveSignature)`;

/** Named extraction routes. Each must contribute at least `PATTERN_FLOOR` matches overall. */
const KIND_PATTERNS: readonly { readonly name: string; readonly re: RegExp }[] = [
  // F#: HeatSignature.ofMass <source> "kind" / BoundedHeat.signature <source> "kind"
  { name: "fsharp-emitter-inline", re: new RegExp(`${EMITTERS}\\s+[A-Za-z_][A-Za-z0-9_.']*\\s+"([^"]+)"`, "g") },
  // F#: the same, written across lines (ofMass\n  source\n  "kind")
  {
    name: "fsharp-emitter-multiline",
    re: new RegExp(`${EMITTERS}\\s*\\n\\s*[A-Za-z_][A-Za-z0-9_.']*\\s*\\n\\s*"([^"]+)"`, "g"),
  },
  // F#: [<Literal>] let SomethingKind = "kind"
  { name: "fsharp-kind-literal", re: /let\s+[A-Za-z0-9_]*Kind\s*=\s*"([^"]+)"/g },
  // Q#/JSON treaty: "kind": "..."
  { name: "treaty-kind-field", re: /"kind"\s*:\s*"([^"]+)"/g },
  // WSetHeat composes its kind as "wset." + WSetFunction + ".forgotten"; the composed form is
  // assembled below, but the route is named here so its disappearance trips the pattern floor.
  { name: "wset-composed", re: /WSetFunction\s*=\s*"([^"]+)"/g },
];

export function kindLiterals(path: string, source: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  const text = path.endsWith(".fs") ? stripFSharpComments(source) : source;

  // WSetHeat composes its kind: "wset." + WSetFunction + ".forgotten". Expand over the
  // closed set of WSetFunction literals so a pressure-token function name cannot hide here.
  const composesWset = /"wset\."\s*\+\s*[A-Za-z0-9_.]*WSetFunction\s*\+\s*"\.forgotten"/.test(text);

  for (const { name, re } of KIND_PATTERNS) {
    const found: string[] = [];
    for (const m of text.matchAll(re)) {
      if (m[1] === undefined) continue;
      if (name === "wset-composed") {
        if (composesWset) found.push(`wset.${m[1]}.forgotten`);
      } else {
        found.push(m[1]);
      }
    }
    if (found.length > 0) out.set(name, found);
  }

  return out;
}

/**
 * The token sets are PARSED OUT OF Heat.fs rather than restated here, so this lint cannot
 * drift away from the classifier it is guarding. A hardcoded copy would keep passing after
 * someone added a new forgetting token to the F#.
 */
export function tokenPredicates(heatSource: string): ReadonlyMap<string, readonly string[]> {
  const text = stripFSharpComments(heatSource);
  const out = new Map<string, readonly string[]>();
  // let isXKind (kind: string) : bool = <body up to the next top-level let>
  const re = /let\s+(is[A-Za-z]+Kind)\s*\([^)]*\)\s*:\s*bool\s*=([\s\S]*?)(?=\n\s{0,4}(?:let|\/\/\/|\[<)|\n\n\n)/g;
  for (const m of text.matchAll(re)) {
    const name = m[1];
    const body = m[2];
    if (name === undefined || body === undefined) continue;
    const needles = [...body.matchAll(/kindContains\s+"([^"]+)"/g)]
      .map((n) => n[1])
      .filter((n): n is string => n !== undefined);
    if (needles.length > 0) out.set(name, needles);
  }
  return out;
}

/**
 * Every `let` binding in Heat.fs, as name -> body.
 *
 * Deliberately shallow: a body runs to the next `let` at any indentation, so an inner `let`
 * truncates its parent. That is fine for what B1–B3 ask (all three read the head of a binding),
 * and every consumer below fails loudly rather than quietly when its subject is missing.
 */
export function bindings(heatSource: string): ReadonlyMap<string, string> {
  const text = stripFSharpComments(heatSource);
  const out = new Map<string, string>();
  for (const part of text.split(/\n(?=\s*let\s)/)) {
    const nameMatch = /^\s*let\s+(?:private\s+|rec\s+|inline\s+)*([A-Za-z0-9_']+)/.exec(part);
    if (!nameMatch || nameMatch[1] === undefined) continue;
    // First definition wins; F# shadowing in one file would be its own problem.
    if (!out.has(nameMatch[1])) out.set(nameMatch[1], part.slice(nameMatch[0].length));
  }
  return out;
}

/**
 * B1's subject: bindings whose body references a raw pressure substring probe.
 *
 * The probes' OWN definitions are excluded — defining `isBackpressureKind` is not deciding
 * pressure. Everything else that reads them is, by construction, a classifier; the invariant
 * is that there is exactly one.
 */
export function pressureDecidingBindings(heatSource: string): readonly string[] {
  const names: string[] = [];
  for (const [name, body] of bindings(heatSource)) {
    if (name === "isBackpressureKind" || name === "isDeniedKind") continue;
    if (/\bisBackpressureKind\b|\bisDeniedKind\b/.test(body)) names.push(name);
  }
  return names;
}

/**
 * B2's subject: bindings that call `kindContains` directly.
 *
 * A second classifier can dodge B1 completely by inlining the substring test instead of
 * calling the named probe — `let isPressureKind k = kindContains "backpressure" k`. So the
 * rule is that the ONLY things allowed to touch `kindContains` are the token predicates
 * themselves, which `tokenPredicates` already parses out of the same file.
 */
export function kindContainsCallers(heatSource: string): readonly string[] {
  const names: string[] = [];
  for (const [name, body] of bindings(heatSource)) {
    if (name === "kindContains") continue;
    if (/\bkindContains\b/.test(body)) names.push(name);
  }
  return names;
}

/**
 * The `KindClass -> HeatSignal` correspondence, read off the binding that maps between them
 * (`HeatSignal.ofKind`). Half of B3b's subject: parsing it means a MISWIRED arm
 * (`KindClass.Backpressure -> HeatSignal.Forgotten`) is caught, which no name-pin could see.
 */
export function classToSignalMap(heatSource: string): ReadonlyMap<string, string> {
  const text = stripFSharpComments(heatSource);
  const out = new Map<string, string>();
  const re =
    /\|\s*(?:[A-Za-z0-9_]+\.)*KindClass\.([A-Za-z0-9_]+)\s*->\s*(?:[A-Za-z0-9_]+\.)*HeatSignal\.([A-Za-z0-9_]+)/g;
  for (const m of text.matchAll(re)) {
    if (m[1] === undefined || m[2] === undefined) continue;
    if (!out.has(m[1])) out.set(m[1], m[2]);
  }
  return out;
}

/**
 * The other half: the `HeatSignal -> KindClass` correspondence (`HeatSignal.classOf`), which is
 * what lets the signal route read the single `KindClass`-keyed pressure table instead of keeping
 * a second copy of it.
 *
 * `[^\n>]*?` between the pattern and the arrow admits a payload binder (`HeatSignal.Other _`)
 * while the excluded `>` stops the match from stepping over an arrow into the next line's arm.
 */
export function signalToClassMap(heatSource: string): ReadonlyMap<string, string> {
  const text = stripFSharpComments(heatSource);
  const out = new Map<string, string>();
  const re =
    /\|\s*(?:[A-Za-z0-9_]+\.)*HeatSignal\.([A-Za-z0-9_]+)[^\n>]*?->\s*(?:[A-Za-z0-9_]+\.)*KindClass\.([A-Za-z0-9_]+)/g;
  for (const m of text.matchAll(re)) {
    if (m[1] === undefined || m[2] === undefined) continue;
    if (!out.has(m[1])) out.set(m[1], m[2]);
  }
  return out;
}

/**
 * The union cases a boolean-returning `match`/`function` body maps to `true`, for one
 * qualifier (`KindClass` or `HeatSignal`).
 *
 * F# groups or-patterns before a single arrow, so everything from the head of the body to the
 * first `-> true` is the true-set. Returns `[]` when there is no `-> true` at all, which the
 * caller treats as "not a pressure table" rather than as "empty pressure table".
 */
export function casesMappedToTrue(body: string, qualifier: string): readonly string[] {
  const idx = body.indexOf("-> true");
  if (idx < 0) return [];
  const head = body.slice(0, idx);
  const re = new RegExp(String.raw`\|\s*(?:[A-Za-z0-9_]+\.)*${qualifier}\.([A-Za-z0-9_]+)`, "g");
  return [...head.matchAll(re)].map((m) => m[1]).filter((s): s is string => s !== undefined);
}

/**
 * B3's subject: every binding that enumerates a pressure-true set over `qualifier`, as
 * name -> cases. Discovered by SHAPE (a `-> true` arm over that union), never by name, so
 * renaming `isPressureKind` cannot hide a table from this check.
 */
export function pressureTables(heatSource: string, qualifier: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [name, body] of bindings(heatSource)) {
    const cases = casesMappedToTrue(body, qualifier);
    if (cases.length > 0) out.set(name, cases);
  }
  return out;
}

// ── checks ────────────────────────────────────────────────────────────────────

interface Failure {
  readonly part: "A" | "B" | "floor";
  readonly message: string;
}

export function run(read: (p: string) => string | null): {
  failures: readonly Failure[];
  kindsInspected: number;
  predicatesFound: number;
  /** The single classifier B1 discovered, or `undefined` when there was not exactly one. */
  classifier: string | undefined;
} {
  const failures: Failure[] = [];

  const heat = read(HEAT_FS);
  if (heat === null) {
    return {
      failures: [{ part: "floor", message: `${HEAT_FS} not found — the classifier surface moved` }],
      kindsInspected: 0,
      predicatesFound: 0,
      classifier: undefined,
    };
  }

  // ── token sets, parsed from the source of truth ──
  const predicates = tokenPredicates(heat);
  const forgetting = predicates.get("isForgettingKind") ?? [];
  const backpressure = predicates.get("isBackpressureKind") ?? [];
  const denied = predicates.get("isDeniedKind") ?? [];
  const pressure = [...backpressure, ...denied];

  if (forgetting.length === 0 || pressure.length === 0) {
    failures.push({
      part: "floor",
      message:
        `could not parse the token sets out of ${HEAT_FS} ` +
        `(forgetting=${forgetting.length}, pressure=${pressure.length}) — ` +
        `the classifier was restructured and this lint is now blind`,
    });
  }

  if (predicates.size < PREDICATE_SCAN_FLOOR) {
    failures.push({
      part: "floor",
      message: `scan floor: parsed ${predicates.size} token predicates from ${HEAT_FS}, need >= ${PREDICATE_SCAN_FLOOR}`,
    });
  }

  // ── PART A — the ambiguous class stays empty ──
  const seen = new Map<string, string[]>();
  const perPattern = new Map<string, number>();
  for (const path of KIND_SOURCES) {
    const source = read(path);
    if (source === null) {
      failures.push({ part: "floor", message: `kind source ${path} not found — the corpus moved` });
      continue;
    }
    for (const [pattern, kinds] of kindLiterals(path, source)) {
      perPattern.set(pattern, (perPattern.get(pattern) ?? 0) + kinds.length);
      for (const kind of kinds) {
        const at = seen.get(kind) ?? [];
        if (!at.includes(path)) at.push(path);
        seen.set(kind, at);
      }
    }
  }

  for (const { name } of KIND_PATTERNS) {
    const hits = perPattern.get(name) ?? 0;
    if (hits < PATTERN_FLOOR) {
      failures.push({
        part: "floor",
        message:
          `scan floor: extraction route '${name}' matched ${hits} times across ${KIND_SOURCES.length} ` +
          `sources, need >= ${PATTERN_FLOOR}. That route has gone dark — the corpus below is ` +
          `incomplete and a clean result would be a lie.`,
      });
    }
  }

  const lower = (s: string) => s.toLowerCase();
  for (const [kind, paths] of seen) {
    const k = lower(kind);
    const hitsForget = forgetting.filter((t) => k.includes(lower(t)));
    const hitsPressure = pressure.filter((t) => k.includes(lower(t)));
    if (hitsForget.length > 0 && hitsPressure.length > 0) {
      failures.push({
        part: "A",
        message:
          `heat kind "${kind}" (${paths.join(", ")}) carries BOTH a forgetting token ` +
          `[${hitsForget.join(", ")}] and a pressure token [${hitsPressure.join(", ")}]. ` +
          `The single classifier resolves it by branch ORDER, not by meaning: under the ` +
          `post-#10804 order pressure is tested first, so it reads Backpressure => Deferred ` +
          `while its name also claims destruction — i.e. it claims a composition law it does ` +
          `not satisfy. Rename the kind so exactly one vocabulary token applies.`,
      });
    }
  }

  if (seen.size < KIND_SCAN_FLOOR) {
    failures.push({
      part: "floor",
      message:
        `scan floor: inspected ${seen.size} distinct heat kinds, need >= ${KIND_SCAN_FLOOR}. ` +
        `The extraction patterns stopped matching — a clean result here would be a lie.`,
    });
  }

  // ── PART B1 — exactly one binding consumes the raw substring probes ──
  //
  // The classifier is DISCOVERED, not named. Pinning `ofKind` is what made this lint go red on
  // a correct main after #10804 renamed the chain to `classifyKind` — and a name-pin was never
  // the guard anyway: it catches renames, and the defect is arity.
  const deciders = pressureDecidingBindings(heat);
  const classifier = deciders.length === 1 ? deciders[0] : undefined;

  if (deciders.length === 0) {
    failures.push({
      part: "B",
      message:
        `no binding in ${HEAT_FS} consumes isBackpressureKind/isDeniedKind. Nothing classifies ` +
        `pressure from the raw probes, so either the classifier moved out of this file or the ` +
        `parse broke — either way this lint is now blind and a clean result would be a lie.`,
    });
  } else if (deciders.length > 1) {
    failures.push({
      part: "B",
      message:
        `${deciders.length} bindings in ${HEAT_FS} decide pressure from the raw substring ` +
        `probes: [${deciders.join(", ")}]. That is the ORIGINAL DEFECT ` +
        `(081M010W1BP087G0R002M2BNVW) — two independent routes to one bit, which disagreed on ` +
        `kinds carrying both a forgetting and a pressure token. Exactly one binding may read ` +
        `the probes; derive every other route from it (as HeatSignal.ofKind and ` +
        `HeatSignature.isPressureKind both derive from classifyKind today).`,
    });
  }

  // ── PART B2 — no unnamed probe ──
  //
  // B1 only sees a classifier that goes through the NAMED probes. One that inlines
  // `kindContains "backpressure"` would be invisible to it, so the substring primitive itself
  // is fenced: only the token predicates may call it.
  const containsCallers = kindContainsCallers(heat);
  if (containsCallers.length === 0) {
    failures.push({
      part: "floor",
      message:
        `no binding in ${HEAT_FS} calls kindContains — the substring primitive was renamed or ` +
        `the binding parse broke, and PART B2 cannot see a second classifier that inlines it`,
    });
  }
  for (const name of containsCallers) {
    if (predicates.has(name)) continue;
    failures.push({
      part: "B",
      message:
        `'${name}' in ${HEAT_FS} calls kindContains directly but is not one of the token ` +
        `predicates [${[...predicates.keys()].join(", ")}]. An inline substring test is a ` +
        `second classifier that PART B1 cannot see, because it never touches the named probes. ` +
        `Route it through the token predicates and the single classifier.`,
    });
  }

  // ── PART B2b — no ORPHAN token predicate ──
  //
  // B2 as written above has one hole, found by mutating rather than by reading it: name your
  // inline classifier `isSomethingKind` and `tokenPredicates` parses it as a legitimate probe,
  // so B2 waves it through and B1 never sees it. The closure is that a probe nothing reads has
  // no reason to exist — every token predicate must be consumed by the single classifier.
  const classifierBody = classifier === undefined ? undefined : bindings(heat).get(classifier);
  if (classifier !== undefined && classifierBody !== undefined) {
    for (const name of predicates.keys()) {
      if (new RegExp(String.raw`\b${name}\b`).test(classifierBody)) continue;
      failures.push({
        part: "B",
        message:
          `token predicate '${name}' in ${HEAT_FS} is never read by the single classifier ` +
          `'${classifier}'. An orphan probe is either dead code or a second classifier wearing ` +
          `a probe's name — the shape PART B2 alone cannot distinguish. Consume it from ` +
          `'${classifier}' or delete it.`,
      });
    }
  }

  // ── PART B3a — exactly ONE pressure table, and it is the KindClass-keyed one ──
  //
  // 081M07Z23EX087G0R003N676FT. `HeatSignal.isPressure` is now `classOf >> isPressureClass`, so
  // the bit is written down once. The regression this guards is the second table coming BACK:
  // any binding with a `-> true` arm over `HeatSignal` is, by shape, a second enumeration of the
  // same bit — which is the membership split #10804 left behind and this work-item removed.
  const classTables = pressureTables(heat, "KindClass");
  const signalTables = pressureTables(heat, "HeatSignal");
  const classToSignal = classToSignalMap(heat);
  const signalToClass = signalToClassMap(heat);

  if (classTables.size !== 1) {
    failures.push({
      part: "floor",
      message:
        `PART B3 expected exactly ONE KindClass-keyed pressure table in ${HEAT_FS} and found ` +
        `${classTables.size} [${[...classTables.keys()].join(", ")}]. Zero means the single table ` +
        `moved or the shape changed and this check is blind; more than one means the split is ` +
        `back inside the KindClass domain itself.`,
    });
  }

  for (const [name, cases] of signalTables) {
    failures.push({
      part: "B",
      message:
        `'${name}' in ${HEAT_FS} enumerates pressure over HeatSignal ([${cases.join(", ")}] -> true). ` +
        `Since 081M07Z23EX087G0R003N676FT the bit is named exactly once, over KindClass ` +
        `(${[...classTables.keys()].join(", ") || "<missing>"}), and the signal route derives from ` +
        `it via HeatSignal.classOf. A second table keyed on HeatSignal cannot disagree on an ` +
        `INPUT but can disagree on MEMBERSHIP — add a case, mark it pressure here only — which ` +
        `is 081M010W1BP087G0R002M2BNVW one level up. Derive it instead: classOf >> isPressureClass.`,
    });
  }

  // ── PART B3b — the KindClass <-> HeatSignal correspondence is a BIJECTION ──
  //
  // The derive moves the residual rather than deleting it: `classOf` is exhaustive whatever it
  // maps to, so `HeatSignal.Denied -> KindClass.Forgotten` type-checks and answers the pressure
  // question wrong. Neither direction alone can see that; the two together can, because they
  // must be mutual inverses. Strictly stronger than the pressure-set comparison this replaces,
  // which was blind to any miswire among the non-pressure arms.
  if (classToSignal.size === 0 || signalToClass.size === 0) {
    failures.push({
      part: "floor",
      message:
        `PART B3b could not read the KindClass <-> HeatSignal correspondence out of ${HEAT_FS} ` +
        `(ofKind arms=${classToSignal.size}, classOf arms=${signalToClass.size}; both need >0). ` +
        `The signal route derives its pressure answer through that correspondence, so an ` +
        `unparsed direction means a miswire would pass unseen and a clean result would be a lie.`,
    });
  } else {
    if (classToSignal.size !== signalToClass.size) {
      failures.push({
        part: "B",
        message:
          `the KindClass -> HeatSignal map has ${classToSignal.size} arms but the ` +
          `HeatSignal -> KindClass map has ${signalToClass.size}. They must be mutual inverses ` +
          `over the same case set; unequal arm counts means one union carries a case the other ` +
          `cannot represent, and the derived pressure answer for it is whatever classOf guessed.`,
      });
    }

    for (const [cls, signal] of classToSignal) {
      const back = signalToClass.get(signal);
      if (back === cls) continue;
      failures.push({
        part: "B",
        message:
          `the KindClass <-> HeatSignal correspondence in ${HEAT_FS} is NOT a bijection: ofKind ` +
          `sends KindClass.${cls} -> HeatSignal.${signal}, but classOf sends HeatSignal.${signal} -> ` +
          `${back === undefined ? "nothing (no arm)" : `KindClass.${back}`}. HeatSignal.isPressure ` +
          `reads the one pressure table THROUGH classOf, so a miswired arm silently answers the ` +
          `deferral-vs-destruction question wrong for that case — the same defect as two ` +
          `disagreeing tables, wearing a correspondence instead.`,
      });
    }

    for (const [signal, cls] of signalToClass) {
      if (classToSignal.has(cls)) continue;
      failures.push({
        part: "B",
        message:
          `classOf sends HeatSignal.${signal} -> KindClass.${cls}, but ofKind has no arm for ` +
          `KindClass.${cls}. The correspondence is not total in that direction, so the class the ` +
          `pressure table is keyed on is not the class the signal route can reach.`,
      });
    }
  }

  return {
    failures,
    kindsInspected: seen.size,
    predicatesFound: predicates.size,
    classifier,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const read = (p: string): string | null => (existsSync(p) ? readFileSync(p, "utf8") : null);
  const { failures, kindsInspected, predicatesFound, classifier } = run(read);

  if (failures.length === 0) {
    console.log(
      `heat-kind classifier agreement OK — ${kindsInspected} distinct kinds inspected, ` +
        `${predicatesFound} token predicates parsed, one pressure classifier ` +
        `(HeatSignature.${classifier ?? "?"}), the pressure bit enumerated in exactly one table ` +
        `(KindClass-keyed, none over HeatSignal), and the two correspondence directions are ` +
        `mutual inverses.`,
    );
    process.exit(0);
  }

  console.error("heat-kind classifier agreement FAILED\n");
  for (const f of failures) console.error(`  [part ${f.part}] ${f.message}`);
  console.error(
    `\n  inspected ${kindsInspected} kinds / ${predicatesFound} predicates. ` +
      `See 081M010W1BP087G0R002M2BNVW and PR #10693 §6.`,
  );
  process.exit(1);
}
