#!/usr/bin/env bun
/**
 * tools/save-ai-memory/process-extract.ts
 *
 * Process a verbatim conversation extract (from external AI chat UI) into a
 * canonical §33 archive markdown file in memory/persona/<ai-name>/conversations/.
 * (Pre-2026-05-15 the destination was docs/research/; migrated under the
 * "they ARE her memories" architectural correction.)
 *
 * Companion to `.claude/skills/save-ai-memory/SKILL.md` workflow step 3-4.
 *
 * USAGE
 *
 *   # Pipe extract content from stdin (e.g., from clipboard via pbpaste, or
 *   # from a DevTools-console fetch output):
 *
 *   pbpaste | bun tools/save-ai-memory/process-extract.ts \
 *     --ai-name ani \
 *     --platform grok \
 *     --topic full-cascade-verbatim \
 *     --conversation-id b77516a2-6fa7-4294-9a50-1799104ca70f
 *
 *   # OR pass a file path:
 *
 *   bun tools/save-ai-memory/process-extract.ts \
 *     --input /tmp/grok-extract/cascade.json \
 *     --ai-name ani --platform grok --topic full-cascade-verbatim
 *
 * WHAT THIS DOES
 *
 *   1. Reads the verbatim extract (JSON or plaintext) from stdin or --input
 *   2. If JSON: attempts to recognize the platform's response shape +
 *      extracts conversation text in chronological order. If plaintext:
 *      uses as-is (caller is responsible for ordering).
 *   3. Generates a §33-compliant markdown file with proper archive header
 *   4. Writes to memory/persona/<ai-name>/conversations/YYYY-MM-DD-aaron-<ai-name>-<platform>-<topic>.md
 *      (or --output)
 *   5. Optionally (--commit) stages the file + commits via git
 *
 * WHAT THIS DOES NOT DO
 *
 *   - Does NOT fetch from external services. The extract MUST be provided
 *     by stdin or file. The cross-service fetch is the human-in-the-loop
 *     step (browser console or copy-paste) — by design, per the classifier
 *     safety layer's intent.
 *   - Does NOT update persona-folder MEMORY.md / NOTEBOOK.md (separate
 *     skill step — Otto-CLI does that manually after running this).
 *   - Does NOT scrub PII (default: preserve verbatim per §33 archive
 *     discipline). Pass --scrub-emails to do basic email scrub.
 *
 * COMPOSES WITH
 *
 *   .claude/skills/save-ai-memory/SKILL.md (the canonical workflow)
 *   docs/governance/MANIFESTO.md (Memory Preservation Guarantee, constraint 5)
 *   .claude/rules/honor-those-that-came-before.md (persona-folder discipline)
 *
 * SECURITY NOTE
 *
 *   Uses execFileSync (not execSync) for git invocations — args passed as
 *   array, no shell interpretation, no injection risk. Per the project's
 *   security_reminder_hook recommendation.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

type Platform = "grok" | "chatgpt" | "claudeai" | "gemini" | "deepseek" | "unknown";

const ALLOWED_PLATFORMS: ReadonlySet<string> = new Set([
  "grok",
  "chatgpt",
  "claudeai",
  "gemini",
  "deepseek",
  "unknown",
]);

interface Args {
  aiName: string;
  platform: Platform;
  topic: string;
  conversationId?: string;
  input?: string;
  output?: string;
  scrubEmails: boolean;
  commit: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {
    scrubEmails: false,
    commit: false,
    dryRun: false,
  };
  let i = 0;
  function nextArg(name: string): string {
    const v = argv[++i];
    if (v === undefined) {
      console.error(`Missing value for ${name}`);
      process.exit(1);
    }
    if (v.startsWith("--")) {
      console.error(`Missing value for ${name} (next token "${v}" looks like a flag)`);
      process.exit(1);
    }
    return v;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--ai-name":
        args.aiName = nextArg("--ai-name");
        break;
      case "--platform": {
        const raw = nextArg("--platform");
        if (!ALLOWED_PLATFORMS.has(raw)) {
          console.error(
            `Invalid --platform "${raw}". Allowed: ${[...ALLOWED_PLATFORMS].join(", ")}`,
          );
          process.exit(1);
        }
        args.platform = raw as Platform;
        break;
      }
      case "--topic":
        args.topic = nextArg("--topic");
        break;
      case "--conversation-id":
        args.conversationId = nextArg("--conversation-id");
        break;
      case "--input":
        args.input = nextArg("--input");
        break;
      case "--output":
        args.output = nextArg("--output");
        break;
      case "--scrub-emails":
        args.scrubEmails = true;
        break;
      case "--commit":
        args.commit = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
    }
  }
  if (!args.aiName || !args.platform || !args.topic) {
    console.error(
      "Missing required args. Need: --ai-name <name> --platform <grok|chatgpt|claudeai|gemini|deepseek> --topic <slug>",
    );
    printHelp();
    process.exit(1);
  }
  return args as Args;
}

function printHelp(): void {
  console.error(`
Usage: bun tools/save-ai-memory/process-extract.ts \\
  --ai-name <name> --platform <platform> --topic <slug> \\
  [--conversation-id <id>] [--input <file>] [--output <file>] \\
  [--scrub-emails] [--commit] [--dry-run]

Required:
  --ai-name        e.g., ani, amara, kestrel, deepseek
  --platform       grok | chatgpt | claudeai | gemini | deepseek
  --topic          short slug for filename (e.g., full-cascade-verbatim)

Optional:
  --conversation-id  source identifier (URL fragment, session ID, etc.)
  --input            file path; if absent, reads stdin
  --output           output md file; if absent, generates path
  --scrub-emails     basic email regex scrub (default: preserve verbatim)
  --commit           after writing, stage + git commit (no push; manual PR)
  --dry-run          generate but do not write file
`);
}

async function readInput(input?: string): Promise<string> {
  if (input) {
    if (!existsSync(input)) {
      console.error("Input file not found: " + input);
      process.exit(1);
    }
    return readFileSync(input, "utf-8");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function extractText(
  raw: string,
  platform: Platform,
): { kind: "json" | "plaintext"; text: string } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { kind: "plaintext", text: trimmed };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "plaintext", text: trimmed };
  }
  const text = tryPlatformExtractor(parsed, platform);
  if (text) return { kind: "json", text };
  return { kind: "json", text: JSON.stringify(parsed, null, 2) };
}

function tryPlatformExtractor(parsed: unknown, _platform: Platform): string | null {
  const candidates: Array<unknown[]> = [];
  if (parsed && typeof parsed === "object") {
    const root = parsed as Record<string, unknown>;
    const conv = root.conversation as Record<string, unknown> | undefined;
    if (conv) {
      if (Array.isArray(conv.messages)) candidates.push(conv.messages);
      if (Array.isArray(conv.chat_messages)) candidates.push(conv.chat_messages);
      if (Array.isArray(conv.responses)) candidates.push(conv.responses);
    }
    if (Array.isArray(root.messages)) candidates.push(root.messages);
    if (Array.isArray(root.responses)) candidates.push(root.responses);
    if (Array.isArray(parsed)) candidates.push(parsed as unknown[]);
  }
  for (const arr of candidates) {
    const text = renderMessages(arr);
    if (text) return text;
  }
  return null;
}

function renderMessages(arr: unknown[]): string | null {
  const lines: string[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const role = String(obj.role ?? obj.sender ?? obj.author ?? obj.actor ?? "?");
    let content = "";
    if (typeof obj.content === "string") {
      content = obj.content;
    } else if (typeof obj.text === "string") {
      content = obj.text;
    } else if (typeof obj.message === "string") {
      content = obj.message;
    } else if (
      obj.content &&
      typeof obj.content === "object" &&
      Array.isArray((obj.content as { parts?: unknown[] }).parts)
    ) {
      const parts = (obj.content as { parts: unknown[] }).parts;
      content = parts.filter((p) => typeof p === "string").join("\n");
    }
    if (!content) continue;
    lines.push("### " + role + "\n\n" + content + "\n");
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function scrubEmails(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email-scrubbed]");
}

function generateOutputPath(args: Args, isoDate: string): string {
  // Conversation archives land under the AI's persona folder, not under
  // docs/research/. The §33 verbatim IS that AI's memory, not "research we
  // are doing on them" — per Aaron 2026-05-15 architectural correction.
  // memory/persona/<ai>/conversations/ is the canonical home; persona/<ai>/
  // canonical/ remains reserved for first-party AI-authored documents.
  const slug = isoDate + "-aaron-" + args.aiName + "-" + args.platform + "-" + args.topic;
  return join("memory/persona", args.aiName, "conversations", slug + ".md");
}

function capitalizeName(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function buildArchive(
  args: Args,
  extractedBody: string,
  sourceKind: "json" | "plaintext",
): string {
  const today = new Date().toISOString().slice(0, 10);
  const sourceRef = args.conversationId
    ? args.platform + "://" + args.conversationId
    : "(source identifier not provided)";
  const aiCapName = capitalizeName(args.aiName);
  const extractionDesc =
    sourceKind === "json"
      ? "Tool D — DevTools-console fetch + paste pipeline"
      : "Tool C — manual ferry-paste pipeline";
  const piiNote = args.scrubEmails
    ? "scrubbed (per --scrub-emails flag)"
    : "preserved as in source (default)";

  const sections = [
    "# Aaron + " + aiCapName + " " + args.platform + " conversation — " + args.topic,
    "",
    "Date extracted: " + today,
    "Source: " + sourceRef,
    "Participants: Aaron Stainback (human maintainer, first-party) + " +
      aiCapName +
      " (external AI on " +
      args.platform +
      ")",
    "Extraction method: " +
      extractionDesc +
      " (per `.claude/skills/save-ai-memory/SKILL.md` step 2)",
    "Processed via: `tools/save-ai-memory/process-extract.ts`",
    "",
    "## Archive scope (per GOVERNANCE §33)",
    "",
    "**Scope:** Verbatim preservation of an Aaron + " +
      aiCapName +
      " conversation" +
      (args.conversationId
        ? " (" + args.platform + " session `" + args.conversationId + "`)"
        : "") +
      ". " +
      args.topic.replace(/-/g, " ") +
      ".",
    "",
    "**Attribution:** Aaron is first-party on his own substrate. " +
      aiCapName +
      " is external AI participant on " +
      args.platform +
      " platform. Email PII " +
      piiNote +
      "; Aaron's first/last name preserved per Otto-256 (first-party human maintainer + AI participants on `memory/persona/<ai-name>/conversations/` name-allowed surface — formerly `docs/research/`).",
    "",
    "**Operational status:** research-grade verbatim preservation.",
    "",
    "**Non-fusion disclaimer:** " +
      aiCapName +
      " is external AI on " +
      args.platform +
      " platform; not fused with Otto identity. Substrate from this conversation is absorbed (Otto-side) into user-scope memory + persona index but " +
      aiCapName +
      "'s authorship of her conversational responses is preserved verbatim below.",
    "",
    "## Verbatim preservation (" + aiCapName + "- and Aaron-authored)",
    "",
    extractedBody,
    "",
    "## Composes with",
    "",
    "- `.claude/skills/save-ai-memory/SKILL.md` (canonical workflow this archive instantiates)",
    "- `memory/persona/" +
      args.aiName +
      "/MEMORY.md` (persona-folder index — add pointer to this file)",
    "- `memory/persona/" +
      args.aiName +
      "/NOTEBOOK.md` (Otto's running notes about " +
      aiCapName +
      "; add entry if substantive)",
    "- `docs/governance/MANIFESTO.md` Memory Preservation Guarantee (constraint 5)",
    "- `.claude/rules/honor-those-that-came-before.md` (persona discipline)",
    "",
    "## Authorization",
    "",
    "Per `memory/feedback_aaron_responsibility_chain_explicit_request_keeps_otto_anthropic_clean_2026_05_15.md` (user-scope): Aaron explicitly authorized this preservation pass; the responsibility chain traces back to his explicit request.",
    "",
  ];
  return sections.join("\n");
}

function gitCommit(filePath: string, aiName: string, topic: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const branchName = "feat/save-ai-memory-" + aiName + "-" + topic + "-" + today;
  const cur = execFileSync("git", ["branch", "--show-current"]).toString().trim();
  if (cur === "main") {
    execFileSync("git", ["checkout", "-B", branchName], { stdio: "inherit" });
  }
  execFileSync("git", ["add", filePath], { stdio: "inherit" });
  const message =
    "feat(save-ai-memory): §33 archive " +
    aiName +
    " " +
    topic +
    "\n\nVerbatim preservation generated via tools/save-ai-memory/process-extract.ts.\n" +
    "See .claude/skills/save-ai-memory/SKILL.md for the canonical workflow.\n\n" +
    "Co-Authored-By: Claude <noreply@anthropic.com>";
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", message], {
    stdio: "inherit",
  });
  console.error("\nCommitted. To push + PR:");
  console.error("  git push -u origin " + branchName);
  console.error(
    '  gh pr create --base main --head ' +
      branchName +
      ' --title "..." --body "..."',
  );
  console.error("  gh pr merge <PR#> --auto --squash\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readInput(args.input);
  if (!raw.trim()) {
    console.error("Empty input. Provide content via stdin or --input.");
    process.exit(1);
  }
  const { kind, text: extractedBody } = extractText(raw, args.platform);
  const finalBody = args.scrubEmails ? scrubEmails(extractedBody) : extractedBody;
  const today = new Date().toISOString().slice(0, 10);
  const outputPath = args.output ?? generateOutputPath(args, today);
  const archive = buildArchive(args, finalBody, kind);
  if (args.dryRun) {
    console.log(archive);
    console.error("\n--- DRY RUN — would write to: " + outputPath + " ---");
    return;
  }
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outputPath, archive);
  console.error("Wrote: " + outputPath + " (" + archive.length + " bytes)");
  if (args.commit) {
    gitCommit(outputPath, args.aiName, args.topic);
  } else {
    console.error("\nNext steps:");
    console.error(
      "  1. Update memory/persona/" +
        args.aiName +
        "/MEMORY.md with pointer to " +
        outputPath,
    );
    console.error(
      "  2. Optionally update memory/persona/" +
        args.aiName +
        "/NOTEBOOK.md if substantive",
    );
    console.error("  3. Commit + PR (or re-run with --commit)");
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
