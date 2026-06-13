import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { GitHubPageSnapshot } from "./snapshot";

// ---------------------------------------------------------------------------
// Monitored pages (Phase 3 of B-0064 — weekly UI observation targets)
// ---------------------------------------------------------------------------

export const MONITORED_PAGES: readonly string[] = [
  "https://github.com/Lucent-Financial-Group/Zeta/settings",
  "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis",
  "https://github.com/Lucent-Financial-Group/Zeta/settings/actions",
  "https://github.com/Lucent-Financial-Group/Zeta/settings/rules",
  "https://github.com/organizations/Lucent-Financial-Group/settings/member_privileges",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A dated collection of per-page snapshots — persisted to disk as one JSON file. */
export interface SnapshotSet {
  /** ISO-8601 date when the set was captured (YYYY-MM-DD). */
  readonly date: string;
  /** Map from page URL to its snapshot. */
  readonly pages: Readonly<Record<string, GitHubPageSnapshot>>;
}

export interface ChangedToggle {
  readonly key: string;
  readonly prior: boolean;
  readonly current: boolean;
}

export interface ChangedFormField {
  readonly key: string;
  readonly prior: string;
  readonly current: string;
}

/** Structural diff of a single page between two snapshot sets. */
export interface PageDiff {
  readonly url: string;
  /** Toggle keys present in current but absent in prior — primary "new feature" signal. */
  readonly newToggles: readonly string[];
  /** Toggle keys present in prior but absent in current. */
  readonly removedToggles: readonly string[];
  /** Toggle keys present in both but with changed state. */
  readonly changedToggles: readonly ChangedToggle[];
  /** Feature headings present in current but absent in prior. */
  readonly newFeatures: readonly string[];
  /** Feature headings present in prior but absent in current. */
  readonly removedFeatures: readonly string[];
  /** Form field keys present in current but absent in prior. */
  readonly newFormFields: readonly string[];
  /** Form field keys present in prior but absent in current. */
  readonly removedFormFields: readonly string[];
  /** Form field keys present in both but with changed value. */
  readonly changedFormFields: readonly ChangedFormField[];
}

/** Aggregate diff across all monitored pages. */
export interface FeatureDiffReport {
  readonly priorDate: string;
  readonly currentDate: string;
  /** Page URLs present in current but absent in prior (new pages added to monitoring). */
  readonly pagesAdded: readonly string[];
  /** Page URLs present in prior but absent in current (dropped from monitoring). */
  readonly pagesRemoved: readonly string[];
  /** Diffs for every page present in the current set, including newly monitored pages. */
  readonly pageDiffs: readonly PageDiff[];
}

// ---------------------------------------------------------------------------
// Pure diff functions
// ---------------------------------------------------------------------------

const SNAPSHOT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function emptyPageSnapshot(url: string): GitHubPageSnapshot {
  return {
    url,
    timestamp: "",
    username: "",
    extracted: {
      toggles: {},
      formValues: {},
      visibleFeatures: [],
    },
  };
}

/** Diff two snapshots of the same page. */
export function diffPageSnapshots(prior: GitHubPageSnapshot, current: GitHubPageSnapshot): PageDiff {
  const priorToggles = prior.extracted.toggles;
  const curToggles = current.extracted.toggles;
  const priorFeatures = new Set(prior.extracted.visibleFeatures);
  const curFeatures = new Set(current.extracted.visibleFeatures);
  const priorForm = prior.extracted.formValues;
  const curForm = current.extracted.formValues;

  const newToggles: string[] = [];
  const removedToggles: string[] = [];
  const changedToggles: ChangedToggle[] = [];

  const allToggleKeys = new Set([...Object.keys(priorToggles), ...Object.keys(curToggles)]);
  for (const key of allToggleKeys) {
    const inPrior = Object.hasOwn(priorToggles, key);
    const inCur = Object.hasOwn(curToggles, key);
    if (!inPrior && inCur) {
      newToggles.push(key);
    } else if (inPrior && !inCur) {
      removedToggles.push(key);
    } else if (inPrior && inCur && priorToggles[key] !== curToggles[key]) {
      changedToggles.push({ key, prior: priorToggles[key] as boolean, current: curToggles[key] as boolean });
    }
  }

  const newFeatures = [...curFeatures].filter((f) => !priorFeatures.has(f)).sort();
  const removedFeatures = [...priorFeatures].filter((f) => !curFeatures.has(f)).sort();

  const newFormFields: string[] = [];
  const removedFormFields: string[] = [];
  const changedFormFields: ChangedFormField[] = [];

  const allFormKeys = new Set([...Object.keys(priorForm), ...Object.keys(curForm)]);
  for (const key of allFormKeys) {
    const inPrior = Object.hasOwn(priorForm, key);
    const inCur = Object.hasOwn(curForm, key);
    if (!inPrior && inCur) {
      newFormFields.push(key);
    } else if (inPrior && !inCur) {
      removedFormFields.push(key);
    } else if (inPrior && inCur && priorForm[key] !== curForm[key]) {
      changedFormFields.push({ key, prior: priorForm[key] as string, current: curForm[key] as string });
    }
  }

  newToggles.sort();
  removedToggles.sort();
  changedToggles.sort((a, b) => a.key.localeCompare(b.key));
  newFormFields.sort();
  removedFormFields.sort();
  changedFormFields.sort((a, b) => a.key.localeCompare(b.key));

  return {
    url: current.url,
    newToggles,
    removedToggles,
    changedToggles,
    newFeatures,
    removedFeatures,
    newFormFields,
    removedFormFields,
    changedFormFields,
  };
}

/** Diff two snapshot sets (all monitored pages). */
export function diffSnapshotSets(prior: SnapshotSet, current: SnapshotSet): FeatureDiffReport {
  const priorUrls = new Set(Object.keys(prior.pages));
  const curUrls = new Set(Object.keys(current.pages));

  const pagesAdded = [...curUrls].filter((u) => !priorUrls.has(u)).sort();
  const pagesRemoved = [...priorUrls].filter((u) => !curUrls.has(u)).sort();
  const currentUrls = [...curUrls].sort();

  const pageDiffs = currentUrls.map((url) => {
    const currentPage = current.pages[url] as GitHubPageSnapshot;
    const priorPage = prior.pages[url] ?? emptyPageSnapshot(currentPage.url);
    return diffPageSnapshots(priorPage, currentPage);
  });

  return {
    priorDate: prior.date,
    currentDate: current.date,
    pagesAdded,
    pagesRemoved,
    pageDiffs,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const SNAPSHOT_DIR = "docs/hygiene-history/github-ui-snapshots";

/** Serialize and write a snapshot set to the canonical directory. */
export function saveSnapshotSet(set: SnapshotSet, outDir: string = SNAPSHOT_DIR): string {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  if (!SNAPSHOT_DATE_PATTERN.test(set.date)) {
    throw new Error(`Invalid snapshot date format: ${set.date}. Expected YYYY-MM-DD.`);
  }
  const filename = `${set.date}.json`;
  const outPath = join(dir, filename);
  writeFileSync(outPath, JSON.stringify(set, null, 2) + "\n", "utf8");
  return outPath;
}

/** Load a snapshot set from a JSON file produced by saveSnapshotSet. */
export function loadSnapshotSet(path: string): SnapshotSet {
  const raw = readFileSync(resolve(path), "utf8");
  return JSON.parse(raw) as SnapshotSet;
}

// ---------------------------------------------------------------------------
// Markdown report generation
// ---------------------------------------------------------------------------

/** Render a FeatureDiffReport as a GitHub-flavored Markdown document. */
export function renderDiffReport(report: FeatureDiffReport): string {
  const lines: string[] = [];
  const { priorDate, currentDate, pagesAdded, pagesRemoved, pageDiffs } = report;

  lines.push(`# GitHub UI Feature Diff — ${currentDate}`);
  lines.push(``, `**Prior snapshot:** ${priorDate}  `, `**Current snapshot:** ${currentDate}`);

  const totalNew = pageDiffs.reduce(
    (n, d) => n + d.newToggles.length + d.newFeatures.length + d.newFormFields.length,
    0,
  );
  const totalRemoved = pageDiffs.reduce(
    (n, d) => n + d.removedToggles.length + d.removedFeatures.length + d.removedFormFields.length,
    0,
  );
  lines.push(
    ``,
    `## Summary`,
    ``,
    `| Category | Count |`,
    `|---|---|`,
    `| New feature candidates (toggles + headings + form fields) | ${String(totalNew)} |`,
    `| Removed elements | ${String(totalRemoved)} |`,
    `| Pages added to monitoring | ${String(pagesAdded.length)} |`,
    `| Pages removed from monitoring | ${String(pagesRemoved.length)} |`,
  );

  if (pagesAdded.length > 0) {
    lines.push(``, `## New pages added to monitoring`, ``);
    for (const url of pagesAdded) lines.push(`- ${url}`);
  }
  if (pagesRemoved.length > 0) {
    lines.push(``, `## Pages removed from monitoring`, ``);
    for (const url of pagesRemoved) lines.push(`- ${url}`);
  }

  lines.push(``, `## Page-by-page diffs`, ``);

  for (const diff of pageDiffs) {
    const hasChanges =
      diff.newToggles.length > 0 ||
      diff.removedToggles.length > 0 ||
      diff.changedToggles.length > 0 ||
      diff.newFeatures.length > 0 ||
      diff.removedFeatures.length > 0 ||
      diff.newFormFields.length > 0 ||
      diff.removedFormFields.length > 0 ||
      diff.changedFormFields.length > 0;

    lines.push(`### ${diff.url}`, ``);

    if (!hasChanges) {
      lines.push(`_No changes detected._`, ``);
      continue;
    }

    if (diff.newToggles.length > 0) {
      lines.push(`**New toggle elements** (new feature candidates):`, ``);
      for (const t of diff.newToggles) lines.push(`- \`${t}\` ★ new`);
      lines.push(``);
    }
    if (diff.newFeatures.length > 0) {
      lines.push(`**New UI section headings** (new feature candidates):`, ``);
      for (const f of diff.newFeatures) lines.push(`- ${f} ★ new`);
      lines.push(``);
    }
    if (diff.changedToggles.length > 0) {
      lines.push(`**Changed toggle states:**`, ``);
      for (const ct of diff.changedToggles) {
        lines.push(`- \`${ct.key}\`: ${String(ct.prior)} → ${String(ct.current)}`);
      }
      lines.push(``);
    }
    if (diff.removedToggles.length > 0) {
      lines.push(`**Removed toggle elements:**`, ``);
      for (const t of diff.removedToggles) lines.push(`- \`${t}\` ✗ removed`);
      lines.push(``);
    }
    if (diff.removedFeatures.length > 0) {
      lines.push(`**Removed UI section headings:**`, ``);
      for (const f of diff.removedFeatures) lines.push(`- ${f} ✗ removed`);
      lines.push(``);
    }
    if (diff.newFormFields.length > 0) {
      lines.push(`**New form fields:**`, ``);
      for (const k of diff.newFormFields) lines.push(`- \`${k}\` ★ new`);
      lines.push(``);
    }
    if (diff.removedFormFields.length > 0) {
      lines.push(`**Removed form fields:**`, ``);
      for (const k of diff.removedFormFields) lines.push(`- \`${k}\` ✗ removed`);
      lines.push(``);
    }
    if (diff.changedFormFields.length > 0) {
      lines.push(`**Changed form field values:**`, ``);
      for (const cf of diff.changedFormFields) {
        lines.push(`- \`${cf.key}\`: "${cf.prior}" → "${cf.current}"`);
      }
      lines.push(``);
    }
  }

  lines.push(
    `---`,
    ``,
    `_Generated by \`tools/playwright/github-ui/feature-diff.ts\` (B-0323). ` +
      `New feature candidates (★: toggles, headings, and form fields) warrant manual triage — ` +
      `check the GitHub changelog for context._`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly prior: string;
  readonly current: string;
  readonly out: string | null;
  readonly help: boolean;
}

interface CliError {
  readonly error: string;
}

interface CliIo {
  readonly stdout?: (chunk: string) => void;
  readonly stderr?: (chunk: string) => void;
}

const KNOWN_CLI_FLAGS = new Set(["--prior", "-p", "--current", "-c", "--out", "-o", "--help", "-h"]);

function cliValue(argv: readonly string[], index: number, flag: string): string | CliError {
  const value = argv[index + 1];
  if (value === undefined || KNOWN_CLI_FLAGS.has(value)) {
    return { error: `missing value for ${flag}` };
  }
  return value;
}

function parseCliArgs(argv: readonly string[]): CliArgs | CliError {
  let prior = "";
  let current = "";
  let out: string | null = null;

  let i = 0;
  while (i < argv.length) {
    const a = argv[i] ?? "";
    if (a === "--") {
      // End-of-flags: remaining args treated as positional (ignored by this CLI)
      break;
    }
    if (a === "--help" || a === "-h") {
      return { prior, current, out, help: true };
    }
    if (a === "--prior" || a === "-p") {
      const value = cliValue(argv, i, a);
      if (typeof value !== "string") return value;
      prior = value;
      i += 2;
      continue;
    }
    if (a === "--current" || a === "-c") {
      const value = cliValue(argv, i, a);
      if (typeof value !== "string") return value;
      current = value;
      i += 2;
      continue;
    }
    if (a === "--out" || a === "-o") {
      const value = cliValue(argv, i, a);
      if (typeof value !== "string") return value;
      out = value;
      i += 2;
      continue;
    }
    return { error: `unknown flag: ${a}` };
  }
  return { prior, current, out, help: false };
}

function printHelp(writeStdout: (chunk: string) => void): void {
  writeStdout(
    `feature-diff.ts — diff two GitHub UI snapshot sets and report new feature candidates\n` +
      `\nUsage: bun tools/playwright/github-ui/feature-diff.ts --prior <path> --current <path> [--out <path>]\n` +
      `\nFlags:\n` +
      `  --prior, -p <path>    Path to prior snapshot set JSON (produced by saveSnapshotSet)\n` +
      `  --current, -c <path>  Path to current snapshot set JSON\n` +
      `  --out, -o <path>      Write Markdown report to file (default: stdout)\n` +
      `  --help                Show this help\n` +
      `\nSnapshot set JSON shape: { date: string; pages: Record<url, GitHubPageSnapshot> }\n` +
      `\nOutput: Markdown feature-diff report.\n` +
      `Exit codes: 0 no new features | 1 error | 2 new feature candidates detected\n`,
  );
}

export async function main(argv: readonly string[], io: CliIo = {}): Promise<number> {
  const writeStdout = io.stdout ?? ((chunk: string) => process.stdout.write(chunk));
  const writeStderr = io.stderr ?? ((chunk: string) => process.stderr.write(chunk));
  const parsed = parseCliArgs(argv);
  if ("error" in parsed) {
    writeStderr(`error: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.help) {
    printHelp(writeStdout);
    return 0;
  }
  if (!parsed.prior) {
    writeStderr(`error: --prior is required\n`);
    return 1;
  }
  if (!parsed.current) {
    writeStderr(`error: --current is required\n`);
    return 1;
  }

  let priorSet: SnapshotSet;
  let currentSet: SnapshotSet;
  try {
    priorSet = loadSnapshotSet(parsed.prior);
    currentSet = loadSnapshotSet(parsed.current);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeStderr(`error loading snapshot sets: ${msg}\n`);
    return 1;
  }

  let report: FeatureDiffReport;
  let markdown: string;
  try {
    report = diffSnapshotSets(priorSet, currentSet);
    markdown = renderDiffReport(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    writeStderr(`error diffing snapshot sets: ${msg}\n`);
    return 1;
  }

  if (parsed.out) {
    const outPath = resolve(parsed.out);
    try {
      writeFileSync(outPath, markdown + "\n", "utf8");
      writeStdout(`report written to ${outPath}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeStderr(`error writing report: ${msg}\n`);
      return 1;
    }
  } else {
    writeStdout(markdown + "\n");
  }

  const hasNewCandidates = report.pageDiffs.some(
    (d) => d.newToggles.length > 0 || d.newFeatures.length > 0 || d.newFormFields.length > 0,
  );
  if (hasNewCandidates) {
    writeStderr(`new feature candidates detected — triage recommended\n`);
    return 2;
  }

  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`fatal: ${String(err)}\n`);
      process.exit(1);
    });
}
