// treaty-rule-alternatives.ts — the REGISTER of alternative rules each golden-vector
// treaty is claimed to exclude, with the measured count of vectors that change.
//
// WHY THIS FILE EXISTS
// --------------------
// A golden-vector treaty does two separate jobs:
//
//   1. CROSS-ORACLE AGREEMENT — N implementations produce identical bytes for these
//      inputs. This is real, and essentially never vacuous.
//   2. RULE PINNING — the vectors lock a SPECIFIC behaviour, excluding named
//      alternatives. This is vacuous unless at least one vector actually
//      DISCRIMINATES the claimed rule from a plausible alternative.
//
// The defect is conflating them. PR #10759 is the worked instance: `Consensus.decide`
// carried the prose "the tie-break behaviour is byte-locked into the four-oracle
// treaty", and measurement showed first-occurrence and ordinal-minimum changed 0 of 7
// pinned vectors each. In its own words — "the treaty pinned a POINT; the prose
// claimed a RULE."
//
// Aaron 2026-08-15: "we may have this in other byte locked or golden vector treaties,
// sometimes the golden vector is the pinned point and kind of vacuous other than
// everyone byte agrees to this file, not that the file is actually meaningful."
//
// WHAT A DECLARATION IS
// ---------------------
// For each treaty, a claimed rule and the plausible alternatives a competent
// implementer might have chosen instead. Each alternative is EVALUATED against the
// pinned inputs and the number of vectors whose pinned output changes is counted.
// The count is the evidence: "it looks under-specified" is not a finding, "ordinal-max
// changes 0 of 12 vectors while the docstring says ordinal-min" is.
//
// THE HONEST OUTCOMES for a zero count — all recorded, never blurred. A zero is NOT
// automatically a defect, and treating it as one would be its own overreach:
//
//   gap        — the alternative is REACHABLY different and no vector excludes it.
//                This is the real defect. A `gap` MUST cite a filed work-item.
//   equivalent — the "alternative" computes the same function on the reachable
//                domain, so a zero count is a PROOF of equivalence, not a hole.
//   unreachable— the branch the claim describes cannot execute on any input.
//                The claim is prose about dead code; the fix is prose.
//   blocked    — a discriminating vector exists in principle but adding it would
//                BREAK the treaty (the oracles genuinely disagree there).
//   declared   — the treaty ITSELF says it does not pin this rule. No defect: the
//                reader was told. This is the target state for every other kind.
//
// Reporting "this file is vacuous" when it does job (1) fine would be exactly the
// overreach this register exists to catch. Job (1) is not audited here at all.
//
// Measured 2026-08-15 against origin/main @ c608ca06a.

/** How a zero-discrimination result is to be read. */
export type NotExcludedKind = "gap" | "equivalent" | "unreachable" | "blocked" | "declared";

export interface AlternativeRule {
  /** The competing rule, stated so a reader can check the evaluator implements it. */
  readonly name: string;
  /** `excluded` — at least one vector must change. `not-excluded` — none may. */
  readonly expect: "excluded" | "not-excluded";
  /** Required when `expect: "not-excluded"`. */
  readonly kind?: NotExcludedKind;
  /** Required when `expect: "not-excluded"`: WHY the zero count is acceptable. */
  readonly reason?: string;
  /** Count of pinned vectors whose output changes under this rule. */
  readonly evaluate: (seed: unknown) => number;
}

export interface TreatyDeclaration {
  /** Repo-relative path to the seed. */
  readonly treaty: string;
  /** Where the claim is written (seed `description`, docstring, law name, ...). */
  readonly claimSource: string;
  /** The claimed rule, quoted or closely paraphrased from `claimSource`. */
  readonly claim: string;
  /** Total vectors the evaluators range over (for the report). */
  readonly vectorCount: (seed: unknown) => number;
  readonly alternatives: readonly AlternativeRule[];
}

// ---------------------------------------------------------------------------
// shared helpers — deliberately tiny; each evaluator mutates only the RULE.
// ---------------------------------------------------------------------------

const MASK64 = (1n << 64n) - 1n;
const utf8 = (s: string): number[] => [...new TextEncoder().encode(s)];

/** Lexicographic compare over UTF-8 bytes (the repo's canonical ordinal collation). */
export function utf8Compare(a: string, b: string): number {
  const x = utf8(a);
  const y = utf8(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}

/** UTF-16 code-unit order — JS default `<`; diverges from UTF-8 only outside the BMP. */
export function utf16Compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** SplitMix64 finaliser (Vigna) — the score function the HRW treaty is built on. */
function splitmix64(x: bigint): bigint {
  let z = (x * 0x9e3779b97f4a7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return (z ^ (z >> 31n)) & MASK64;
}

// ---------------------------------------------------------------------------
// consensus — the treaty PR #10759 repaired. Kept as the regression guard: if the
// four discriminators are ever removed, this declaration goes red.
// ---------------------------------------------------------------------------

interface ConsensusSeed {
  decide: { votes: string[]; result: { committed: boolean; value: string | null; count: number; total: number } }[];
}

function consensusDecide(votes: string[], tie: (tied: string[]) => string) {
  if (votes.length === 0) return { committed: false, value: null, count: 0, total: 0 };
  const m = new Map<string, number>();
  for (const v of votes) m.set(v, (m.get(v) ?? 0) + 1);
  const best = Math.max(...m.values());
  const tied = [...m].filter(([, c]) => c === best).map(([k]) => k);
  const quorum = 2 * Math.floor((votes.length - 1) / 3) + 1;
  const committed = best >= quorum;
  return { committed, value: committed ? tie(tied) : null, count: best, total: votes.length };
}

const ordinalMin = (tied: string[]): string => tied.slice().sort(utf8Compare)[0]!;

function consensusChanged(seed: unknown, tieFor: (votes: string[]) => (tied: string[]) => string): number {
  const g = seed as ConsensusSeed;
  let changed = 0;
  for (const v of g.decide) {
    const alt = consensusDecide(v.votes, tieFor(v.votes));
    const base = consensusDecide(v.votes, ordinalMin);
    if (JSON.stringify(alt) !== JSON.stringify(base)) changed++;
  }
  return changed;
}

const consensusTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/consensus/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "TIE-BREAK = ORDINAL MINIMUM of the values sharing the highest support — order-INDEPENDENT",
  vectorCount: (s) => (s as ConsensusSeed).decide.length,
  alternatives: [
    {
      name: "first-occurrence (the pre-2026-08-15 rule; reads arrival order)",
      expect: "excluded",
      evaluate: (s) => consensusChanged(s, (votes) => (tied) => votes.find((v) => tied.includes(v))!),
    },
    {
      name: "ordinal MAXIMUM (also order-independent — the property tests cannot separate it)",
      expect: "excluded",
      evaluate: (s) => consensusChanged(s, () => (tied) => tied.slice().sort(utf8Compare).reverse()[0]!),
    },
    {
      name: "culture-sensitive minimum (ICU en collation instead of ordinal)",
      expect: "excluded",
      evaluate: (s) => consensusChanged(s, () => (tied) => tied.slice().sort(new Intl.Collator("en").compare)[0]!),
    },
  ],
};

// ---------------------------------------------------------------------------
// consistent-hash — the closest sibling of the #10759 defect: a tie-break rule
// stated in the treaty's own description.
// ---------------------------------------------------------------------------

interface HrwSeed {
  pick: { buckets: number; key: string; result: number }[];
}

function hrwPick(n: number, key: bigint, takeLastOnTie: boolean): number {
  let bestScore = -1n;
  let bestIdx = 0;
  for (let i = 0; i < n; i++) {
    const score = splitmix64((key ^ splitmix64(BigInt(i))) & MASK64);
    if (takeLastOnTie ? score >= bestScore : score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

const consistentHashTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/consistent-hash/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "pick = argmax (first index wins on a tie)",
  vectorCount: (s) => (s as HrwSeed).pick.length,
  alternatives: [
    {
      name: "argmax, LAST index wins on a tie (`>=` instead of `>`)",
      expect: "not-excluded",
      kind: "unreachable",
      reason:
        "No input can produce a tie, so no vector could ever discriminate this. score_i = mix(key ^ mix(i)), " +
        "and mix is a BIJECTION on u64 (xor-shift, odd-constant multiply, xor-shift, odd-constant multiply, " +
        "xor-shift — each step invertible). Hence i != j => mix(i) != mix(j) => key^mix(i) != key^mix(j) => " +
        "score_i != score_j, for every key and every n <= 2^64. The tie branch is dead code and the parenthetical " +
        "in the description documents behaviour that cannot occur. Fix is prose, not a vector.",
      evaluate: (s) => {
        const g = s as HrwSeed;
        let changed = 0;
        for (const v of g.pick) if (hrwPick(v.buckets, BigInt(v.key), true) !== v.result) changed++;
        return changed;
      },
    },
    {
      name: "argMIN instead of argmax",
      expect: "excluded",
      evaluate: (s) => {
        const g = s as HrwSeed;
        let changed = 0;
        for (const v of g.pick) {
          const key = BigInt(v.key);
          let bestScore = MASK64;
          let bestIdx = 0;
          for (let i = 0; i < v.buckets; i++) {
            const score = splitmix64((key ^ splitmix64(BigInt(i))) & MASK64);
            if (score < bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          }
          if (bestIdx !== v.result) changed++;
        }
        return changed;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// z-set-merkle — the GAP. A law named `nonAsciiOrdering` and a vector named
// `non-ascii-ordinal-bytes`, neither of which any alternative ordering violates.
// ---------------------------------------------------------------------------

interface ZSetMerkleSeed {
  vectors: { name: string; entries: { key: string; weight: number }[]; root: string }[];
}

/** Net-consolidated support of a vector's entries (weights summing to 0 drop out). */
function zsmSupport(entries: { key: string; weight: number }[]): string[] {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.key, (m.get(e.key) ?? 0) + e.weight);
  return [...m].filter(([, w]) => w !== 0).map(([k]) => k);
}

/**
 * The leaf ORDER decides the root, so "does this ordering change the root" reduces
 * to "does this ordering permute the leaves" — computable without re-hashing.
 */
function zsmOrderChanged(seed: unknown, cmp: (a: string, b: string) => number): number {
  const g = seed as ZSetMerkleSeed;
  let changed = 0;
  for (const v of g.vectors) {
    const keys = zsmSupport(v.entries);
    if (keys.slice().sort(cmp).join("\u0000") !== keys.slice().sort(utf8Compare).join("\u0000")) changed++;
  }
  return changed;
}

const zSetMerkleTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/z-set-merkle/golden-vectors.json",
  claimSource: "seed `ordering` + law `nonAsciiOrdering`",
  claim: "ascending lexicographic order over raw encoded key bytes, not culture-sensitive string comparison",
  vectorCount: (s) => (s as ZSetMerkleSeed).vectors.length,
  alternatives: [
    {
      name: "culture-sensitive collation (ICU) instead of UTF-8 byte order",
      expect: "not-excluded",
      kind: "gap",
      reason:
        "REACHABLY different and excluded by NO vector. The only non-ASCII vector is `non-ascii-ordinal-bytes`, " +
        "keys {e, e-acute, Omega, CJK zhong} — four keys in three scripts with no case or accent conflict, so every " +
        "collation tested (en de sv da tr fr cs lt et) yields the SAME order as UTF-8 bytes. Its sibling treaties " +
        "bag/ and z-set/ DO pin this, via a key set containing an accented-Latin key next to an ASCII-letter key " +
        "('aeiou-acute' vs 'b-005-ASCII'), which every collation reorders. The discriminator is that cheap and the " +
        "pattern is already in-repo; it is not landed here because this seed is cross-verified by SIX oracles " +
        "(F#/C#/Rust/TS/Go/Python, tests/cross-verification/zset-merkle/) and a new vector needs a new XxHash128 " +
        "root reproduced by all six. Filed: workitems/081M02RX1PN087G0R003WK66GV-*.md",
      evaluate: (s) => zsmOrderChanged(s, new Intl.Collator("en").compare),
    },
    {
      name: "UTF-16 code-unit order instead of UTF-8 byte order",
      expect: "not-excluded",
      kind: "blocked",
      reason:
        "Every key in this seed is in the BMP, where UTF-8 byte order, codepoint order and UTF-16 code-unit order " +
        "PROVABLY coincide — so no BMP vector can discriminate them. The only discriminating input straddles the " +
        "astral boundary, and there F#/C#/TS (UTF-16 code unit) and Rust (UTF-8 byte) genuinely DISAGREE: such a " +
        "vector would break the treaty rather than tighten it. Same residual as consensus 081M02PEST7087G0R00253HRV0. " +
        "Do not add one until the repo adopts a single canonical collation.",
      evaluate: (s) => zsmOrderChanged(s, utf16Compare),
    },
    {
      name: "DESCENDING byte order",
      expect: "excluded",
      evaluate: (s) => zsmOrderChanged(s, (a, b) => -utf8Compare(a, b)),
    },
  ],
};

// ---------------------------------------------------------------------------
// bag / z-set — the sibling treaties that DO pin culture-invariance. Kept so the
// contrast above stays measured rather than asserted.
// ---------------------------------------------------------------------------

interface LadderSeed {
  expectedReplayStates: { e: string }[][];
  expectedFinalState: { e: string }[];
}

function ladderStates(seed: unknown): string[][] {
  const g = seed as LadderSeed;
  return [...g.expectedReplayStates, g.expectedFinalState].map((st) => st.map((x) => x.e));
}

function ladderOrderChanged(seed: unknown, cmp: (a: string, b: string) => number): number {
  let changed = 0;
  for (const keys of ladderStates(seed)) {
    if (keys.slice().sort(cmp).join("\u0000") !== keys.join("\u0000")) changed++;
  }
  return changed;
}

function ladderTreaty(path: string): TreatyDeclaration {
  return {
    treaty: path,
    claimSource: "seed `comparator`",
    claim: "ascending Unicode code-point order on the key `e` (matching UTF-8 byte order)",
    vectorCount: (s) => ladderStates(s).length,
    alternatives: [
      {
        name: "culture-sensitive collation (ICU en)",
        expect: "excluded",
        evaluate: (s) => ladderOrderChanged(s, new Intl.Collator("en").compare),
      },
      {
        name: "UTF-16 code-unit order",
        expect: "not-excluded",
        kind: "equivalent",
        reason:
          "All keys are in the BMP, where UTF-8 byte order and UTF-16 code-unit order coincide as a theorem — " +
          "so on this seed the two are the SAME function, and a zero count is a proof of equivalence rather " +
          "than a missing discriminator. (Out-of-BMP keys would separate them; see the z-set-merkle `blocked` row.)",
        evaluate: (s) => ladderOrderChanged(s, utf16Compare),
      },
      {
        name: "descending order",
        expect: "excluded",
        evaluate: (s) => ladderOrderChanged(s, (a, b) => -utf8Compare(a, b)),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// traveler-frame — `dominates` quantifier domain.
// ---------------------------------------------------------------------------

interface TravelerSeed {
  dominates: { a: Record<string, number>; b: Record<string, number>; result: boolean }[];
}

function travelerChanged(seed: unknown, f: (a: Record<string, number>, b: Record<string, number>) => boolean): number {
  const g = seed as TravelerSeed;
  let changed = 0;
  for (const v of g.dominates) if (f(v.a, v.b) !== v.result) changed++;
  return changed;
}

const travelerFrameTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/traveler-frame/golden-vectors.json",
  claimSource: "seed `description` (matches src/Core/TravelerFrame.fs `dominates`)",
  claim: "dominates(a,b) = a >= b on every key of b",
  vectorCount: (s) => (s as TravelerSeed).dominates.length,
  alternatives: [
    {
      name: "quantify over the key UNION (missing coordinate = 0 on both sides)",
      expect: "not-excluded",
      kind: "equivalent",
      reason:
        "For a key in A but not B the union form asks a_k >= 0, which holds for every value in the declared " +
        "domain: a coordinate is a Versionstamp and TravelerFrame.fs states 'absent actor = origin " +
        "(Versionstamp.zero)', i.e. 0 is the bottom. The two quantifiers therefore compute the same predicate " +
        "on all reachable frames and separate only on out-of-domain negative coordinates. Zero is a proof, " +
        "not a hole.",
      evaluate: (s) =>
        travelerChanged(s, (a, b) =>
          [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => (a[k] ?? 0) >= (b[k] ?? 0)),
        ),
    },
    {
      name: "quantify over the keys of A instead of B (vacuously true for an empty A)",
      expect: "excluded",
      evaluate: (s) => travelerChanged(s, (a, b) => Object.keys(a).every((k) => a[k]! >= (b[k] ?? 0))),
    },
    {
      name: "strict > instead of >= (would break reflexivity of the partial order)",
      expect: "excluded",
      evaluate: (s) => travelerChanged(s, (a, b) => Object.keys(b).every((k) => (a[k] ?? 0) > b[k]!)),
    },
  ],
};

// ---------------------------------------------------------------------------
// uncertain-clock — `definitelyBefore` interval comparison.
// ---------------------------------------------------------------------------

interface UncertainSeed {
  definitelyBefore: { a: { physical: number; eps: number }; b: { physical: number; eps: number }; result: boolean }[];
  uncertain: { a: { physical: number; eps: number }; b: { physical: number; eps: number }; result: boolean }[];
}

type Reading = { physical: number; eps: number };
const dbClaimed = (a: Reading, b: Reading) => a.physical + a.eps < b.physical;

/**
 * Counts across BOTH sections, because `uncertain` is defined in terms of
 * `definitelyBefore` and is therefore part of what pins it.
 */
function uncertainChanged(seed: unknown, f: (a: Reading, b: Reading) => boolean): number {
  const g = seed as UncertainSeed;
  let changed = 0;
  for (const v of g.definitelyBefore) if (f(v.a, v.b) !== dbClaimed(v.a, v.b)) changed++;
  for (const v of g.uncertain) {
    const base = !dbClaimed(v.a, v.b) && !dbClaimed(v.b, v.a);
    const alt = !f(v.a, v.b) && !f(v.b, v.a);
    if (base !== alt) changed++;
  }
  return changed;
}

const uncertainClockTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/uncertain-clock/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "definitelyBefore(a,b) = a.physical + a.eps < b.physical",
  vectorCount: (s) => (s as UncertainSeed).definitelyBefore.length + (s as UncertainSeed).uncertain.length,
  alternatives: [
    {
      name: "compare against b's UPPER bound: a.physical + a.eps < b.physical + b.eps",
      expect: "excluded",
      reason:
        "Narrow: excluded by exactly ONE vector, and that vector is in the `uncertain` section, not in " +
        "`definitelyBefore` itself — the four `definitelyBefore` vectors alone change 0 of 4 under this rule " +
        "(b.eps is non-zero in only one of them). Recorded because the margin is one vector wide.",
      evaluate: (s) => uncertainChanged(s, (a, b) => a.physical + a.eps < b.physical + b.eps),
    },
    {
      name: "non-strict <= (a reading is 'definitely before' one that starts exactly where it ends)",
      expect: "excluded",
      evaluate: (s) => uncertainChanged(s, (a, b) => a.physical + a.eps <= b.physical),
    },
    {
      name: "ignore a.eps entirely: a.physical < b.physical",
      expect: "excluded",
      evaluate: (s) => uncertainChanged(s, (a, b) => a.physical < b.physical),
    },
  ],
};

// ---------------------------------------------------------------------------
// watermark — isLate boundary and the combine operator.
// ---------------------------------------------------------------------------

interface WatermarkSeed {
  observe: { strategy: string; lateness: number; events: number[]; result: number[] }[];
  isLate: { wm: number; eventTime: number; result: boolean }[];
  combine: { sources: number[]; result: number }[];
}

const watermarkTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/watermark/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "isLate(wm, e) = e <= wm; combine = min across sources; bounded = maxSeen - lateness clamped monotone",
  vectorCount: (s) => {
    const g = s as WatermarkSeed;
    return g.observe.length + g.isLate.length + g.combine.length;
  },
  alternatives: [
    {
      name: "isLate strict: e < wm (an event exactly at the watermark is not late)",
      expect: "excluded",
      evaluate: (s) => {
        const g = s as WatermarkSeed;
        return g.isLate.filter((v) => v.eventTime < v.wm !== v.result).length;
      },
    },
    {
      name: "combine = MAX across sources (progress past the slowest input)",
      expect: "excluded",
      evaluate: (s) => {
        const g = s as WatermarkSeed;
        return g.combine.filter((v) => Math.max(...v.sources) !== v.result).length;
      },
    },
    {
      name: "bounded emits (last event time - lateness) clamped monotone, not (maxSeen - lateness)",
      expect: "not-excluded",
      kind: "equivalent",
      reason:
        "Algebraically the same sequence: clamping the running max over (e_i - L) gives " +
        "max_{j<=i}(e_j) - L = maxSeen_i - L, because subtracting a constant commutes with max. " +
        "A zero count here is a proof of equivalence, not a missing discriminator.",
      evaluate: (s) => {
        const g = s as WatermarkSeed;
        let changed = 0;
        for (const v of g.observe) {
          let prev = Number.NEGATIVE_INFINITY;
          const out: number[] = [];
          for (const e of v.events) {
            const c = v.strategy === "monotonic" ? e : e - v.lateness;
            prev = Math.max(prev, c);
            out.push(prev);
          }
          if (JSON.stringify(out) !== JSON.stringify(v.result)) changed++;
        }
        return changed;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// range-set — canonicalization coalescing rule.
// ---------------------------------------------------------------------------

interface RangeSetSeed {
  cases: { name: string; input: string; canonical: string }[];
}

const rangeSetTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/range-set/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "canonical = sorted, disjoint, non-adjacent (overlapping AND touching ranges coalesce)",
  vectorCount: (s) => (s as RangeSetSeed).cases.length,
  alternatives: [
    {
      name: "coalesce only OVERLAPPING ranges, leave touching ones separate",
      expect: "excluded",
      evaluate: (s) => {
        const g = s as RangeSetSeed;
        const parse = (str: string): [number, number][] =>
          str === ""
            ? []
            : str.split(",").map((p) => {
                const i = p.indexOf("-");
                return i < 0 ? [Number(p), Number(p)] : [Number(p.slice(0, i)), Number(p.slice(i + 1))];
              });
        let changed = 0;
        for (const c of g.cases) {
          const sorted = parse(c.input).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
          const out: [number, number][] = [];
          for (const iv of sorted) {
            const last = out[out.length - 1];
            if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
            else out.push([iv[0], iv[1]]);
          }
          const rendered = out.map(([a, b]) => (a === b ? String(a) : `${a}-${b}`)).join(",");
          if (rendered !== c.canonical) changed++;
        }
        return changed;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// merkle — odd fan-in rule (duplicate-last vs RFC 6962 promote-last).
// ---------------------------------------------------------------------------

type MerkleVector = { leaves: string[]; root: string };

const merkleTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/merkle/golden-vectors-merkle.json",
  claimSource: "src/Core.TypeScript/merkle/merkle.ts `MerkleTree` docstring",
  claim: "built bottom-up, duplicate-last-leaf for odd fan-in",
  vectorCount: (s) => (s as MerkleVector[]).length,
  alternatives: [
    {
      name: "promote-last on odd fan-in (RFC 6962 style) instead of duplicating it",
      expect: "excluded",
      // Structural: the two rules differ exactly when some level has odd length > 1.
      // Counted on the SHAPE, so this needs no hashing and stays a pure function of the seed.
      evaluate: (s) => {
        const vectors = s as MerkleVector[];
        let changed = 0;
        for (const v of vectors) {
          let width = v.leaves.length;
          let differs = false;
          while (width > 1) {
            if (width % 2 === 1) differs = true;
            width = Math.ceil(width / 2);
          }
          if (differs) changed++;
        }
        return changed;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// soft-value — PROMOTED 2026-08-23. This was the register's model `declared` row: the
// seed said "Argmax ties (absent here) break by ascending key", so the reader was told
// and no vector was required. Honest, and still not enough — the F# oracle was meanwhile
// breaking ties in ARRIVAL order (`List.maxBy` over an association list), and no vector
// could see it. `declared` records that a rule is unpinned; it does not make the rule
// unnecessary, and an unpinned rule the oracles are supposed to share is a divergence
// waiting to be found by something other than CI. The seed now carries tie vectors whose
// insertion order disagrees with ordinal order, so both rows below are `excluded`.
// ---------------------------------------------------------------------------

interface SoftValueSeed {
  resolve: { candidates: Record<string, number>; num: number; den: number; result: string | null }[];
  observeResolve: {
    prior: Record<string, number>;
    likelihood: Record<string, number>;
    num: number;
    den: number;
    result: string | null;
  }[];
}

function softDecide(cands: Record<string, number>, num: number, den: number, tie: (ks: string[]) => string) {
  const es = Object.entries(cands);
  const total = es.reduce((acc, [, w]) => acc + w, 0);
  if (total <= 0) return null;
  const best = Math.max(...es.map(([, w]) => w));
  const tied = es.filter(([, w]) => w === best).map(([k]) => k);
  return best * den >= num * total ? tie(tied) : null;
}

/**
 * Count vectors whose pinned decision changes when the ascending-key tie-break is swapped for
 * `alt`. `observeResolve` is folded through the same Bayesian multiply the oracles use, so a tie
 * that only appears in the POSTERIOR is counted too.
 */
function softTieChanged(seed: unknown, alt: (ks: string[]) => string): number {
  const g = seed as SoftValueSeed;
  const asc = (ks: string[]) => ks.slice().sort(utf8Compare)[0]!;
  let changed = 0;
  for (const v of g.resolve) {
    if (softDecide(v.candidates, v.num, v.den, alt) !== softDecide(v.candidates, v.num, v.den, asc)) changed++;
  }
  for (const v of g.observeResolve) {
    const post: Record<string, number> = {};
    for (const k of Object.keys(v.prior)) {
      const w = v.prior[k]! * (v.likelihood[k] ?? 0);
      if (w > 0) post[k] = w;
    }
    if (softDecide(post, v.num, v.den, alt) !== softDecide(post, v.num, v.den, asc)) changed++;
  }
  return changed;
}

const softValueTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/soft-value/golden-vectors.json",
  claimSource: "seed `description`",
  claim: "Argmax ties break by ascending candidate key (ordinal), not by arrival order",
  vectorCount: (s) => (s as SoftValueSeed).resolve.length + (s as SoftValueSeed).observeResolve.length,
  alternatives: [
    {
      name: "DESCENDING-key tie-break",
      expect: "excluded",
      evaluate: (s) => softTieChanged(s, (ks) => ks.slice().sort(utf8Compare).reverse()[0]!),
    },
    {
      // The rule F# ACTUALLY implemented until 5c9c60e3a — this row is the regression guard
      // for the divergence that motivated the promotion, not a hypothetical.
      name: "FIRST-SEEN (arrival-order) tie-break — the pre-5c9c60e3a F# rule",
      expect: "excluded",
      evaluate: (s) => softTieChanged(s, (ks) => ks[0]!),
    },
    {
      name: "UTF-16 code-unit order instead of UTF-8 byte order",
      expect: "not-excluded",
      kind: "blocked",
      reason:
        "Every candidate key in this seed is in the BMP, where UTF-8 byte order, codepoint order and UTF-16 " +
        "code-unit order PROVABLY coincide — so no BMP vector can discriminate them. The only discriminating " +
        "input straddles the astral boundary, and there this treaty's oracles genuinely DISAGREE: F# " +
        "(`String.CompareOrdinal`), C# (`StringComparer.Ordinal`) and TS (default `Array.sort`) order by UTF-16 " +
        "code unit, while Rust's `BTreeMap<String, _>` orders by UTF-8 bytes. Such a vector would BREAK the " +
        "treaty rather than tighten it, and the seed is not the place to resolve it. Identical residual to the " +
        "z-set-merkle `blocked` row and consensus 081M02PEST7087G0R00253HRV0; do not add one until the repo " +
        "adopts a single canonical collation across the four oracles.",
      evaluate: (s) => softTieChanged(s, (ks) => ks.slice().sort(utf16Compare)[0]!),
    },
  ],
};

// ---------------------------------------------------------------------------
// dynamic-value CBOR — the canonical-encoding treaty that gets it right, kept as
// the regression guard on `object-order-significant`.
// ---------------------------------------------------------------------------

interface CborSeed {
  vectors: { name: string; value: { t: string; v?: unknown }; cbor: string }[];
}

const dynamicValueCborTreaty: TreatyDeclaration = {
  treaty: "src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json",
  claimSource: "seed vector `object-order-significant`",
  claim: "object keys serialize in INSERTION order, not sorted order (RFC 8949 deterministic-map ordering is NOT used)",
  vectorCount: (s) => (s as CborSeed).vectors.length,
  alternatives: [
    {
      name: "sort map keys (RFC 8949 §4.2.1 deterministic encoding)",
      expect: "excluded",
      // A vector discriminates iff its object has keys not already in sorted order.
      evaluate: (s) => {
        const g = s as CborSeed;
        let changed = 0;
        for (const v of g.vectors) {
          if (v.value.t !== "obj") continue;
          const keys = (v.value.v as [string, unknown][]).map(([k]) => k);
          if (keys.join("\u0000") !== keys.slice().sort(utf8Compare).join("\u0000")) changed++;
        }
        return changed;
      },
    },
  ],
};

// ---------------------------------------------------------------------------

export const TREATY_DECLARATIONS: readonly TreatyDeclaration[] = [
  consensusTreaty,
  consistentHashTreaty,
  zSetMerkleTreaty,
  ladderTreaty("src/Core.TypeScript/bag/golden-vectors.json"),
  ladderTreaty("src/Core.TypeScript/z-set/golden-vectors.json"),
  travelerFrameTreaty,
  uncertainClockTreaty,
  watermarkTreaty,
  rangeSetTreaty,
  merkleTreaty,
  softValueTreaty,
  dynamicValueCborTreaty,
];
