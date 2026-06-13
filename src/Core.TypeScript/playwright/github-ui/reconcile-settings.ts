import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { snapshotGitHubPage, type SnapshotOptions } from "./snapshot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MappingEntry {
  /** HTML name/id attribute from the snapshot's extracted.toggles map. */
  readonly uiKey: string;
  /** Dotted path into the expected-settings JSON object. */
  readonly jsonPath: string;
  /**
   * When true, the JSON path points to a `{ status: "enabled" | "disabled" }`
   * object; convert to boolean before comparing (enabled → true).
   */
  readonly statusToBoolean?: true;
}

export interface ReconcileEntry {
  readonly uiKey: string;
  readonly jsonPath: string;
  readonly uiValue: boolean;
  readonly expectedValue: boolean;
}

export interface ReconcileResult {
  readonly url: string;
  readonly timestamp: string;
  /** UI toggles that match the expected value. */
  readonly match: ReconcileEntry[];
  /** UI toggles that differ from the expected value. */
  readonly drift: ReconcileEntry[];
  /** UI toggle keys that have no mapping entry — candidates for B-0323. */
  readonly unmapped: string[];
}

// ---------------------------------------------------------------------------
// Mapping table: UI HTML attribute name → expected-settings JSON path
// ---------------------------------------------------------------------------
// Names derived from GitHub settings page HTML (kebab-case attrs → JSON underscore paths).
// Any UI key not in this table surfaces in ReconcileResult.unmapped.

export const SETTINGS_MAPPING: readonly MappingEntry[] = [
  // ── General repo settings (/settings) ─────────────────────────────────────
  { uiKey: "allow-merge-commit", jsonPath: "repo.allow_merge_commit" },
  { uiKey: "allow-squash-merge", jsonPath: "repo.allow_squash_merge" },
  { uiKey: "allow-rebase-merge", jsonPath: "repo.allow_rebase_merge" },
  { uiKey: "allow-auto-merge", jsonPath: "repo.allow_auto_merge" },
  { uiKey: "delete-branch-on-merge", jsonPath: "repo.delete_branch_on_merge" },
  { uiKey: "web-commit-signoff-required", jsonPath: "repo.web_commit_signoff_required" },
  { uiKey: "allow-update-branch", jsonPath: "repo.allow_update_branch" },

  // ── Security & analysis (/settings/security_analysis) ─────────────────────
  // GitHub renders these as toggle inputs; statusToBoolean converts the JSON
  // `{ status: "enabled" }` shape to a plain boolean for comparison.
  {
    uiKey: "dependabot-security-updates",
    jsonPath: "repo.security_and_analysis.dependabot_security_updates",
    statusToBoolean: true,
  },
  {
    uiKey: "secret-scanning",
    jsonPath: "repo.security_and_analysis.secret_scanning",
    statusToBoolean: true,
  },
  {
    uiKey: "secret-scanning-push-protection",
    jsonPath: "repo.security_and_analysis.secret_scanning_push_protection",
    statusToBoolean: true,
  },
  {
    uiKey: "secret-scanning-ai-detection",
    jsonPath: "repo.security_and_analysis.secret_scanning_ai_detection",
    statusToBoolean: true,
  },
];

// ---------------------------------------------------------------------------
// JSON-path navigation
// ---------------------------------------------------------------------------

function getJsonValue(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Convert a JSON setting value to boolean for comparison. */
function toExpectedBool(raw: unknown, statusToBoolean?: true): boolean | null {
  if (statusToBoolean === true) {
    if (isRecord(raw) && typeof raw.status === "string") {
      return raw.status === "enabled";
    }
    return null;
  }
  if (typeof raw === "boolean") return raw;
  return null;
}

// ---------------------------------------------------------------------------
// Core reconciliation
// ---------------------------------------------------------------------------

export function reconcile(
  snapshot: { url: string; timestamp: string; extracted: { toggles: Record<string, boolean> } },
  expected: unknown,
  mapping: readonly MappingEntry[] = SETTINGS_MAPPING,
): ReconcileResult {
  const matchedUiKeys = new Set<string>();
  const match: ReconcileEntry[] = [];
  const drift: ReconcileEntry[] = [];

  for (const entry of mapping) {
    const uiValue = snapshot.extracted.toggles[entry.uiKey];
    if (uiValue === undefined) continue; // toggle not present in this snapshot

    matchedUiKeys.add(entry.uiKey);
    const rawExpected = getJsonValue(expected, entry.jsonPath);
    const expectedValue = toExpectedBool(rawExpected, entry.statusToBoolean);
    if (expectedValue === null) continue; // can't compare — type mismatch

    const item: ReconcileEntry = {
      uiKey: entry.uiKey,
      jsonPath: entry.jsonPath,
      uiValue,
      expectedValue,
    };
    if (uiValue === expectedValue) {
      match.push(item);
    } else {
      drift.push(item);
    }
  }

  const unmapped = Object.keys(snapshot.extracted.toggles).filter((k) => !matchedUiKeys.has(k));

  return {
    url: snapshot.url,
    timestamp: snapshot.timestamp,
    match,
    drift,
    unmapped,
  };
}

// ---------------------------------------------------------------------------
// Public async helper: snapshot + reconcile in one call
// ---------------------------------------------------------------------------

export async function reconcileSettings(
  url: string,
  expectedJsonPath: string,
  options: SnapshotOptions = {},
  mapping: readonly MappingEntry[] = SETTINGS_MAPPING,
): Promise<ReconcileResult> {
  const snapshot = await snapshotGitHubPage(url, options);
  const raw = readFileSync(resolve(expectedJsonPath), "utf8");
  const expected: unknown = JSON.parse(raw);
  return reconcile(snapshot, expected, mapping);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS_URL =
  "https://github.com/Lucent-Financial-Group/Zeta/settings";
const DEFAULT_SECURITY_URL =
  "https://github.com/Lucent-Financial-Group/Zeta/settings/security_analysis";
const DEFAULT_EXPECTED_JSON = "tools/hygiene/github-settings.expected.json";

interface CliArgs {
  readonly url: string;
  readonly expectedJson: string;
  readonly security: boolean;
  readonly help: boolean;
}

interface CliError {
  readonly error: string;
}

function parseCliArgs(argv: readonly string[]): CliArgs | CliError {
  let url = DEFAULT_SETTINGS_URL;
  let expectedJson = DEFAULT_EXPECTED_JSON;
  let security = false;

  let i = 0;
  while (i < argv.length) {
    const a = argv[i] ?? "";
    if (a === "--help" || a === "-h") {
      return { url, expectedJson, security, help: true };
    }
    if (a === "--security") {
      security = true;
      url = DEFAULT_SECURITY_URL;
      i++;
      continue;
    }
    if (a === "--url" && i + 1 < argv.length) {
      url = argv[++i] ?? url;
      i++;
      continue;
    }
    if (a === "--expected-json" && i + 1 < argv.length) {
      expectedJson = argv[++i] ?? expectedJson;
      i++;
      continue;
    }
    return { error: `unknown flag: ${a}` };
  }
  return { url, expectedJson, security, help: false };
}

function printHelp(): void {
  process.stdout.write(
    `reconcile-settings.ts — compare live GitHub UI snapshot to expected settings\n` +
      `\nUsage: bun tools/playwright/github-ui/reconcile-settings.ts [flags]\n` +
      `\nFlags:\n` +
      `  --url <url>             Settings page URL (default: Zeta general settings)\n` +
      `  --security              Use security_analysis page URL instead\n` +
      `  --expected-json <path>  Path to expected-settings JSON (default: ${DEFAULT_EXPECTED_JSON})\n` +
      `  --help                  Show this help\n` +
      `\nRequires: ZETA_GITHUB_STORAGE_STATE env var pointing to a Playwright storage-state file.\n` +
      `\nOutput: JSON to stdout — { url, timestamp, match, drift, unmapped }\n` +
      `Exit codes: 0 clean | 1 error | 2 drift detected\n`,
  );
}

export async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseCliArgs(argv);
  if ("error" in parsed) {
    process.stderr.write(`error: ${parsed.error}\n`);
    return 1;
  }
  if (parsed.help) {
    printHelp();
    return 0;
  }

  let result: ReconcileResult;
  try {
    result = await reconcileSettings(parsed.url, parsed.expectedJson);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${msg}\n`);
    return 1;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  if (result.drift.length > 0) {
    process.stderr.write(
      `drift detected: ${String(result.drift.length)} setting(s) differ from expected\n`,
    );
    for (const d of result.drift) {
      process.stderr.write(
        `  ${d.uiKey} (${d.jsonPath}): ui=${String(d.uiValue)} expected=${String(d.expectedValue)}\n`,
      );
    }
    return 2;
  }

  return 0;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((err: unknown) => {
    process.stderr.write(`fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
