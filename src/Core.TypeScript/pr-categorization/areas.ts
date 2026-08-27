/**
 * Area taxonomy for PR categorisation — TOY/UNMETERED classifier surfaces.
 *
 * Two INDEPENDENT notions of "area", and keeping them independent is the
 * whole point of this module:
 *
 *   - `measuredArea`  — derived from the file paths a PR actually changed.
 *                        This is the ground truth. It never reads the title.
 *   - `declaredArea`  — parsed from the PR title's conventional-commit scope,
 *                        falling back to the branch prefix. This is the
 *                        closed-form BASELINE. It never reads a file path.
 *
 * A model that reads only declared-side features and predicts `measuredArea`
 * is therefore doing real work, not reproducing its own input. The set where
 * the two disagree is the product this module exists to produce.
 *
 * Register: `toy` — the taxonomy below is a hand-authored convention, not a
 * measured partition of the repo. It is falsifiable (see areas.test.ts) but
 * it is not derived from anything; a different fleet would need a different
 * table. Nothing here should be cited as a measurement of the repo's shape.
 */

/** The canonical areas. Order is display order, not precedence. */
export const AREAS = [
  'telemetry',
  'research',
  'tooling-ts',
  'archive',
  'docs-other',
  'memory',
  'backlog',
  'core-fsharp',
  'agent-substrate',
  'ci',
  'tests',
  'infra',
  'build',
  'demo-web',
  'governance',
  'other',
] as const;

export type Area = (typeof AREAS)[number];

/**
 * Path -> area. FIRST MATCH WINS, so order is precedence and the specific
 * rules must precede the general ones (`docs/research` before bare `docs/`).
 */
const AREA_RULES: ReadonlyArray<readonly [RegExp, Area]> = [
  [/^\.github\//, 'ci'],
  // Every harness keeps its loop-tick + rules under its own dotted directory;
  // they are the same KIND of substrate as .claude/, so they share its area.
  [/^\.(claude|gemini|cursor|codex|qwen|kiro|aider)\//, 'agent-substrate'],
  [/^(CLAUDE|AGENTS|CURSOR|GEMINI|QWEN|CODEX)\.md$/, 'agent-substrate'],
  [/^docs\/(github|history|pr-discussions|recovered-orphan-branches)/, 'archive'],
  [/^(docs\/(observe-events|drift-events|hygiene-history)|data\/)/, 'telemetry'],
  [/^(docs\/backlog|workitems)/, 'backlog'],
  [/^docs\/(research|books)/, 'research'],
  [/^(docs\/(governance|DECISIONS)|GOVERNANCE\.md)/, 'governance'],
  [/^memory\//, 'memory'],
  [/^tests\//, 'tests'],
  [/^src\/Core\.TypeScript\//, 'tooling-ts'],
  [/^(tools\/|scripts\/|clis\/)/, 'tooling-ts'],
  [/^src\//, 'core-fsharp'],
  [/^(full-ai-cluster|agentic-organization|infra\/|nix|flake\.)/, 'infra'],
  [/^(demo\/|hall\/|site\/|www\/)/, 'demo-web'],
  [/^db\//, 'telemetry'],
  // Repo-wide build and toolchain config. Kept OUT of `ci` on purpose: a
  // lockfile bump and a workflow edit are different work, and collapsing them
  // would hide exactly the dependabot-vs-pipeline distinction the stats want.
  [
    /^(package\.json|bun\.lock(b)?|tsconfig[^/]*\.json|bunfig\.toml|global\.json|[^/]*\.sln|Directory\.[^/]*\.props|[^/]*\.(csproj|fsproj)|\.mise[^/]*\.toml|\.editorconfig|\.gitignore|\.gitattributes|\.markdownlint[^/]*|\.prettier[^/]*|\.config\/)/,
    'build',
  ],
  [/^docs\//, 'docs-other'],
];

/** Area of a single changed path. Total: unmatched paths fall to `other`. */
export function areaOfPath(path: string): Area {
  for (const [rx, area] of AREA_RULES) if (rx.test(path)) return area;
  return 'other';
}

export interface MeasuredArea {
  /** Argmax area by file count. */
  readonly area: Area;
  /** Share of the PR's files that sit in `area`. 1.0 == single-area PR. */
  readonly purity: number;
  /** How many distinct areas the PR touched. */
  readonly areaCount: number;
  /** Full per-area file counts, so a caller can do multi-label work. */
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * Ground truth from the diff. Ties are broken by AREAS order so the result is
 * a deterministic function of the path set (DST: same input, same output).
 */
export function measuredArea(paths: readonly string[]): MeasuredArea | null {
  if (paths.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const p of paths) counts[areaOfPath(p)] = (counts[areaOfPath(p)] ?? 0) + 1;
  let best: Area = 'other';
  let bestN = -1;
  for (const a of AREAS) {
    const n = counts[a] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = a;
    }
  }
  return {
    area: best,
    purity: bestN / paths.length,
    areaCount: Object.keys(counts).length,
    counts,
  };
}

/**
 * Conventional-commit TYPE words. A title whose scope is only one of these has
 * declared a KIND of change and no area at all — that distinction is the
 * `type-only` bucket, and it is a finding about the fleet's convention rather
 * than a parser shortcoming.
 */
const TYPE_WORDS: ReadonlySet<string> = new Set([
  'feat', 'fix', 'chore', 'refactor', 'test', 'style', 'perf', 'build', 'revert', 'wip', 'merge',
]);

/** Declared scope word -> canonical area. */
const DECL_MAP: Readonly<Record<string, Area>> = {
  docs: 'docs-other', design: 'docs-other',
  research: 'research', book: 'research', books: 'research',
  archive: 'archive', shard: 'archive', pr: 'archive',
  metrics: 'telemetry', drift: 'telemetry', 'tick-history': 'telemetry', telemetry: 'telemetry',
  observe: 'telemetry', 'hygiene-history': 'telemetry', tick: 'telemetry', drain: 'telemetry',
  backlog: 'backlog', workitem: 'backlog', workitems: 'backlog',
  memory: 'memory', 'free-memory': 'memory', feedback: 'memory', preserve: 'memory', ferry: 'memory',
  ci: 'ci', ops: 'ci', workflow: 'ci',
  // `deps:` declares a DEPENDENCY change (a lockfile / package-props edit),
  // which is build config, not pipeline config.
  deps: 'build', build: 'build', deps_dev: 'build',
  demo: 'demo-web', site: 'demo-web', hall: 'demo-web', web: 'demo-web',
  hygiene: 'tooling-ts', tools: 'tooling-ts', ts: 'tooling-ts', tooling: 'tooling-ts',
  core: 'core-fsharp', substrate: 'core-fsharp', proof: 'core-fsharp', fs: 'core-fsharp',
  decompose: 'core-fsharp',
  test: 'tests', tests: 'tests',
  rule: 'agent-substrate', rules: 'agent-substrate', skill: 'agent-substrate',
  skills: 'agent-substrate', agent: 'agent-substrate', society: 'agent-substrate',
  persona: 'agent-substrate',
  gov: 'governance', governance: 'governance', decision: 'governance', align: 'governance',
  infra: 'infra', k8s: 'infra', nix: 'infra',
};

/** Branch prefix -> area, consulted only when the title yields no area. */
const BRANCH_MAP: ReadonlyArray<readonly [RegExp, Area]> = [
  [/^dependabot\//, 'build'],
  [/^heartbeat\//, 'telemetry'],
  [/^archive\//, 'archive'],
  [/^shard/, 'archive'],
  [/^metrics\//, 'telemetry'],
  [/^drift/, 'telemetry'],
  [/^research\//, 'research'],
  [/^memory\//, 'memory'],
  [/^backlog\//, 'backlog'],
  [/^society\//, 'agent-substrate'],
  [/^hygiene\//, 'tooling-ts'],
  [/^book\//, 'research'],
  [/^tick/, 'telemetry'],
  [/^observe/, 'telemetry'],
  [/^workitem/, 'backlog'],
];

/**
 * Leading `[skip-review][telemetry-flush]`-style tags, then `scope(paren):`.
 * Anchored so it only ever reads a title's PREFIX — a scope word appearing in
 * prose later in the title must not be picked up.
 */
const SCOPE_RE = /^\s*(?:\[[^\]]*\]\s*)*([a-zA-Z0-9_.\-]+)(?:\(([^)]*)\))?\s*!?:/;

/** Where a declared label came from — reported, never collapsed into the label. */
export type DeclaredSource = 'title' | 'branch' | 'type-only' | 'none';

export interface DeclaredArea {
  /** `null` means the closed form ABSTAINED. Not a prediction of `other`. */
  readonly area: Area | null;
  readonly source: DeclaredSource;
}

/**
 * THE CLOSED-FORM BASELINE. Title scope, then paren scope, then branch prefix.
 * Reads no file path, so its agreement with `measuredArea` is a real
 * measurement rather than an identity.
 */
export function declaredArea(title: string, headRef: string): DeclaredArea {
  const m = SCOPE_RE.exec(title ?? '');
  if (m) {
    const head = m[1]!.toLowerCase();
    const paren = (m[2] ?? '').toLowerCase();
    // A paren scope is more specific than the head, so it is tried first:
    // in `fix(ci):` the area is `ci` and `fix` is only the kind of change.
    const cands = (paren ? [paren] : []).concat([head]);
    for (const raw of cands) {
      const cand = raw.trim().split(',')[0]!.split('/')[0]!;
      const hit = DECL_MAP[cand];
      if (hit) return { area: hit, source: 'title' };
    }
  }
  const hr = (headRef ?? '').toLowerCase();
  for (const [rx, a] of BRANCH_MAP) if (rx.test(hr)) return { area: a, source: 'branch' };
  if (m && TYPE_WORDS.has(m[1]!.toLowerCase())) return { area: null, source: 'type-only' };
  return { area: null, source: 'none' };
}
