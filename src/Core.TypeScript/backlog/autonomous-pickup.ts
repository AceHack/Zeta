#!/usr/bin/env bun
// autonomous-pickup.ts -- Tier 1 backlog selector for background loops.
//
// This tool is deliberately deterministic and conservative. It does not
// edit files, create branches, or invoke a model. It answers one question:
// when the PR queue is empty, what is the next backlog item a loop may safely
// decompose or claim?

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Priority = "P0" | "P1" | "P2" | "P3";
type Action = "decompose-first" | "claim-and-implement";

export interface BacklogItem {
  id: string;
  legacyId: string | null;
  priority: Priority;
  status: string;
  title: string;
  relativePath: string;
  dependsOn: string[];
  parent: string | null;
  created: string | null;
  lastUpdated: string | null;
  decomposition: string | null;
  bodyLineCount: number;
}

export interface BlockedItem {
  item: BacklogItem;
  reason: string;
}

export interface PickupSelection {
  status: "selected" | "empty";
  selected: BacklogItem | null;
  action: Action | null;
  reason: string;
  blocked: BlockedItem[];
  activeClaims: string[];
  executionPrompt: string | null;
}

interface Args {
  repoRoot: string;
  json: boolean;
  maxPriority: Priority;
  activeClaim: string[];
  noGitClaims: boolean;
}

const PRIORITIES: readonly Priority[] = ["P0", "P1", "P2", "P3"];
const BLOB_LINE_THRESHOLD = 120;
const PRIORITY_RANK: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};
const GIT_BIN = "/usr/bin/git";
const GH_BINS = ["/opt/homebrew/bin/gh", "/usr/bin/gh"] as const;

function usage(): string {
  return [
    "Usage:",
    "  bun src/Core.TypeScript/backlog/autonomous-pickup.ts [--json] [--repo-root DIR]",
    "    [--max-priority P0|P1|P2|P3] [--active-claim TEXT]",
    "    [--no-git-claims]",
    "",
    "Default max priority is P2: background loops may pick P0, P1, or P2.",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    repoRoot: process.cwd(),
    json: false,
    maxPriority: "P2",
    activeClaim: [],
    noGitClaims: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--repo-root") {
      args.repoRoot = requireValue(arg, argv[++i]);
    } else if (arg === "--max-priority") {
      const value = requireValue(arg, argv[++i]);
      if (!isPriority(value)) {
        throw new Error(`invalid --max-priority: ${value}`);
      }
      args.maxPriority = value;
    } else if (arg === "--active-claim") {
      args.activeClaim.push(requireValue(arg, argv[++i]));
    } else if (arg === "--no-git-claims") {
      args.noGitClaims = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${arg}`);
    }
  }

  args.repoRoot = resolve(args.repoRoot);
  return args;
}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function isPriority(value: string): value is Priority {
  return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function trimQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseInlineList(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed === "[]" || trimmed.length === 0) {
    return [];
  }
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return [trimQuotes(trimmed)].filter(Boolean);
  }
  const body = trimmed.slice(1, -1).trim();
  if (body.length === 0) {
    return [];
  }
  return body
    .split(",")
    .map((part) => trimQuotes(part))
    .filter(Boolean);
}

function parseListItem(line: string): string | null {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("- ")) {
    return null;
  }
  return trimQuotes(trimmed.slice(2));
}

function isYamlKey(key: string): boolean {
  if (key.length === 0) {
    return false;
  }
  for (const char of key) {
    const valid =
      (char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      (char >= "0" && char <= "9") ||
      char === "_" ||
      char === "-";
    if (!valid) {
      return false;
    }
  }
  return true;
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex <= 0) {
    return null;
  }
  const key = line.slice(0, colonIndex).trim();
  if (!isYamlKey(key)) {
    return null;
  }
  return { key, value: line.slice(colonIndex + 1) };
}

function setFrontmatterValue(out: Record<string, string | string[]>, key: string, value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    out[key] = [];
    return key;
  }
  out[key] = trimmed.startsWith("[") && trimmed.endsWith("]") ? parseInlineList(value) : trimQuotes(value);
  return null;
}

function parseFrontmatterLine(
  out: Record<string, string | string[]>,
  line: string,
  currentListKey: string | null,
): string | null {
  const listItem = parseListItem(line);
  if (currentListKey !== null && listItem !== null) {
    const existing = out[currentListKey];
    const values = Array.isArray(existing) ? existing : [];
    values.push(listItem);
    out[currentListKey] = values.filter(Boolean);
    return currentListKey;
  }

  const keyValue = parseKeyValue(line);
  return keyValue === null ? null : setFrontmatterValue(out, keyValue.key, keyValue.value);
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return {};
  }

  const out: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line === "---") {
      break;
    }
    currentListKey = parseFrontmatterLine(out, line, currentListKey);
  }
  return out;
}

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value ?? "";
}

function asStringList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined) {
    return [];
  }
  return parseInlineList(value);
}

function itemNumber(id: string): number {
  // Legacy B-xxxx: extract the numeric part for ordering
  if (id.startsWith("B-")) {
    const rawNumber = id.slice(2).split(".")[0] ?? "";
    let hasOnlyDigits = rawNumber.length > 0;
    for (const char of rawNumber) {
      if (char < "0" || char > "9") {
        hasOnlyDigits = false;
        break;
      }
    }
    return rawNumber.length > 0 && hasOnlyDigits ? Number(rawNumber) : Number.MAX_SAFE_INTEGER;
  }
  // ZetaIds: use MAX so they sort by age (compareAge) instead of numeric order
  return Number.MAX_SAFE_INTEGER;
}

export function readBacklogItems(repoRoot: string): BacklogItem[] {
  const backlogDir = join(repoRoot, "docs", "backlog");
  const items: BacklogItem[] = [];

  for (const priority of PRIORITIES) {
    const tierDir = join(backlogDir, priority);
    if (!isDirectory(tierDir)) {
      continue;
    }
    for (const entry of readdirSync(tierDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      // ZetaId-prefixed filenames (128-bit hex). The B-xxxx sequential naming
      // is a dead coordinate primitive — only the frontmatter `id` field carries
      // that legacy identifier. Filenames are ZetaId-only.
      if (!/^[0-9A-Z]{10,}/.test(entry.name)) {
        continue;
      }
      const absolutePath = join(tierDir, entry.name);
      const content = readFileSync(absolutePath, "utf8");
      const frontmatter = parseFrontmatter(content);
      // ZetaId is the canonical identifier — locally mintable, no coordination.
      const rawId = asString(frontmatter.id);
      const zetaid = asString(frontmatter.zetaid) || (rawId && !/^B-\d/.test(rawId) ? rawId : null);
      const legacyId = rawId && /^B-\d/.test(rawId) ? rawId : null;
      const id = zetaid ?? legacyId;
      const title = asString(frontmatter.title);
      if (!id || !title) {
        continue;
      }
      const declaredPriority = asString(frontmatter.priority);
      if (!isPriority(declaredPriority)) {
        continue;
      }
      items.push({
        id,
        legacyId: legacyId || null,
        priority: declaredPriority,
        status: asString(frontmatter.status) || "open",
        title,
        relativePath: relative(repoRoot, absolutePath).split("\\").join("/"),
        dependsOn: asStringList(frontmatter.depends_on),
        parent: asString(frontmatter.parent) || null,
        created: asString(frontmatter.created) || null,
        lastUpdated: asString(frontmatter.last_updated) || null,
        decomposition: asString(frontmatter.decomposition) || null,
        bodyLineCount: content.split(/\r?\n/).length,
      });
    }
  }

  return items.sort(compareBacklogItems);
}

function ageKey(item: BacklogItem): string {
  return item.created ?? item.lastUpdated ?? "9999-12-31";
}

function compareAge(a: BacklogItem, b: BacklogItem): number {
  const createdDelta = ageKey(a).localeCompare(ageKey(b));
  if (createdDelta !== 0) {
    return createdDelta;
  }
  const updatedDelta = (a.lastUpdated ?? "9999-12-31").localeCompare(b.lastUpdated ?? "9999-12-31");
  if (updatedDelta !== 0) {
    return updatedDelta;
  }
  return 0;
}

function compareBacklogItems(a: BacklogItem, b: BacklogItem): number {
  const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  const ageDelta = compareAge(a, b);
  if (ageDelta !== 0) {
    return ageDelta;
  }
  return itemNumber(a.id) - itemNumber(b.id);
}

function isOpen(status: string): boolean {
  return status === "open";
}

function isClosed(status: string | undefined): boolean {
  if (status === undefined) {
    return false;
  }
  return status === "closed" || status.startsWith("superseded-by-");
}

function dependencyBlocker(item: BacklogItem, byId: ReadonlyMap<string, BacklogItem>): string | null {
  for (const dependency of item.dependsOn) {
    const depItem = byId.get(dependency);
    if (!depItem) {
      return `missing dependency ${dependency}`;
    }
    if (!isClosed(depItem.status)) {
      return `dependency ${dependency} is ${depItem.status}`;
    }
  }
  return null;
}

function claimMatchesItem(claim: string, item: BacklogItem): boolean {
  const normalized = claim.toLowerCase();
  const idLower = item.id.toLowerCase();
  // Match by ZetaId (canonical)
  if (normalized.includes(idLower)) return true;
  // Match by legacy B-xxxx (for existing claim branches that use old naming)
  if (item.legacyId) {
    const legacyLower = item.legacyId.toLowerCase();
    const numeric = legacyLower.replace("b-", "");
    if (
      normalized.includes(legacyLower) ||
      normalized.includes(`backlog-${numeric}`) ||
      normalized.includes(`b${numeric}`)
    ) return true;
  }
  return false;
}

function claimBlocker(item: BacklogItem, activeClaims: readonly string[]): string | null {
  const claim = activeClaims.find((candidate) => claimMatchesItem(candidate, item));
  return claim ? `active claim ${claim}` : null;
}

function decomposedParentBlocker(
  item: BacklogItem,
  openChildrenByParent: ReadonlyMap<string, readonly BacklogItem[]>,
): string | null {
  if (item.decomposition !== "decomposed") {
    return null;
  }
  // Check by canonical id AND legacy id (parent refs may use either)
  const openChildren = openChildrenByParent.get(item.id) ?? (item.legacyId ? openChildrenByParent.get(item.legacyId) ?? [] : []);
  if (openChildren.length === 0) {
    return null;
  }
  const childIds = openChildren.map((child) => child.id).sort((a, b) => a.localeCompare(b));
  return `decomposed parent has open child ${childIds.join(", ")}`;
}

function openChildrenByParent(items: readonly BacklogItem[]): Map<string, BacklogItem[]> {
  const grouped = new Map<string, BacklogItem[]>();
  for (const item of items) {
    if (item.parent === null || !isOpen(item.status)) {
      continue;
    }
    const children = grouped.get(item.parent) ?? [];
    children.push(item);
    grouped.set(item.parent, children);
  }
  return grouped;
}

function itemBlocker(
  item: BacklogItem,
  byId: ReadonlyMap<string, BacklogItem>,
  childrenByParent: ReadonlyMap<string, readonly BacklogItem[]>,
  activeClaims: readonly string[],
): string | null {
  return (
    decomposedParentBlocker(item, childrenByParent) ??
    dependencyBlocker(item, byId) ??
    claimBlocker(item, activeClaims)
  );
}

function actionFor(item: BacklogItem): Action {
  if (item.decomposition === "atomic" || item.decomposition === "decomposed") {
    return "claim-and-implement";
  }
  return item.decomposition === "blob" || item.bodyLineCount >= BLOB_LINE_THRESHOLD
    ? "decompose-first"
    : "claim-and-implement";
}

function promptFor(item: BacklogItem, action: Action): string {
  const lead =
    action === "decompose-first"
      ? `Decompose ${item.id} into the smallest dependency-ordered atomic child backlog rows.`
      : `Claim and implement the smallest safe slice of ${item.id}.`;
  return [
    lead,
    "",
    `Backlog item: ${item.id} (${item.priority}) ${item.title}`,
    `Backlog path: ${item.relativePath}`,
    "",
    "Rules:",
    "- Use a dedicated worktree and pushed claim branch before write work.",
    "- Do not touch the contested root checkout.",
    "- Take exactly one bounded step and open a PR.",
    "- If the item is too broad, decompose before implementation.",
    "- Run focused checks and include the outcome in the PR body.",
  ].join("\n");
}

export function selectNextBacklogItem(
  items: readonly BacklogItem[],
  activeClaims: readonly string[],
  maxPriority: Priority = "P2",
): PickupSelection {
  // Dual-lookup: resolve dependencies by ZetaId (canonical) OR legacy B-xxxx.
  // This allows existing `depends_on: [B-xxxx]` to resolve while the migration
  // replaces them with ZetaIds incrementally.
  const byId = new Map<string, BacklogItem>();
  for (const item of items) {
    byId.set(item.id, item); // canonical ZetaId
    if (item.legacyId) byId.set(item.legacyId, item); // legacy B-xxxx alias
  }
  const blocked: BlockedItem[] = [];
  const maxRank = PRIORITY_RANK[maxPriority];
  const childrenByParent = openChildrenByParent(items);
  const sortedItems = [...items].sort(compareBacklogItems);

  for (const item of sortedItems) {
    if (PRIORITY_RANK[item.priority] > maxRank) {
      continue;
    }
    if (!isOpen(item.status)) {
      continue;
    }

    const blockedReason = itemBlocker(item, byId, childrenByParent, activeClaims);
    if (blockedReason !== null) {
      blocked.push({ item, reason: blockedReason });
      continue;
    }

    const action = actionFor(item);
    return {
      status: "selected",
      selected: item,
      action,
      reason:
        action === "decompose-first"
          ? "highest-priority open item needs decomposition before implementation"
          : "highest-priority open unclaimed item with satisfied dependencies",
      blocked,
      activeClaims: [...activeClaims],
      executionPrompt: promptFor(item, action),
    };
  }

  return {
    status: "empty",
    selected: null,
    action: null,
    reason: "no open unclaimed backlog items with satisfied dependencies in allowed priority range",
    blocked,
    activeClaims: [...activeClaims],
    executionPrompt: null,
  };
}

function runGit(repoRoot: string, args: string[]): string[] {
  const result = spawnSync(GIT_BIN, ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readActiveClaims(repoRoot: string): string[] {
  const remoteClaims = runGit(repoRoot, ["branch", "-r", "--list", "origin/claim/*"]).map((line) =>
    line.replace(/^origin\//, ""),
  );
  const localClaimsDir = join(repoRoot, "docs", "claims");
  const localClaims = isDirectory(localClaimsDir)
    ? readdirSync(localClaimsDir)
        .filter((name) => name.endsWith(".md") && name !== "README.md")
        .map((name) => `docs/claims/${basename(name, ".md")}`)
    : [];
  return [...new Set([...remoteClaims, ...localClaims])].sort((a, b) => a.localeCompare(b));
}

function ghBin(): string | null {
  return GH_BINS.find((candidate) => existsSync(candidate)) ?? null;
}

function readOpenPrClaims(repoRoot: string): string[] {
  const gh = ghBin();
  if (gh === null) {
    return [];
  }

  const result = spawnSync(
    gh,
    ["pr", "list", "--state", "open", "--limit", "1000", "--json", "number,headRefName,title"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout) as {
      number?: number;
      headRefName?: string;
      title?: string;
    }[];
    return parsed.flatMap((pr) => {
      const claims: string[] = [];
      if (pr.headRefName !== undefined && pr.headRefName.trim().length > 0) {
        claims.push(pr.headRefName.trim());
      }
      if (pr.title !== undefined && pr.title.trim().length > 0) {
        const numberLabel = typeof pr.number === "number" ? pr.number.toString() : "unknown";
        claims.push(`pr-${numberLabel}:${pr.title.trim()}`);
      }
      return claims;
    });
  } catch {
    return [];
  }
}

function printText(selection: PickupSelection): void {
  if (selection.status === "empty") {
    process.stdout.write(`no-pick: ${selection.reason}\n`);
    return;
  }
  if (selection.selected === null || selection.action === null) {
    process.stdout.write(`no-pick: malformed selection\n`);
    return;
  }
  const item = selection.selected;
  process.stdout.write(`${selection.action}: ${item.id} ${item.priority} ${item.title}\n`);
  process.stdout.write(`${item.relativePath}\n`);
  process.stdout.write(`${selection.reason}\n`);
}

export function main(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
    return 1;
  }

  const items = readBacklogItems(args.repoRoot);
  const gitClaims = args.noGitClaims ? [] : readActiveClaims(args.repoRoot);
  const openPrClaims = args.noGitClaims ? [] : readOpenPrClaims(args.repoRoot);
  const activeClaims = [...new Set([...gitClaims, ...openPrClaims, ...args.activeClaim])].sort((a, b) =>
    a.localeCompare(b),
  );
  const selection = selectNextBacklogItem(items, activeClaims, args.maxPriority);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
  } else {
    printText(selection);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
