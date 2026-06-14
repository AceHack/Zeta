#!/usr/bin/env bun
// stop-detect-response-rut.ts — Stop hook that runs the repeated-token-rut
// detector over the agent's OWN last response, the layer closest to the
// sampler the repo can reach.
//
// WHY (Aaron shadow*, 2026-06-14): #8213 built the detector; #8214 wired it
// into the tick-history append path (the artifact). But the live glitch
// ("court court court…") happens in GENERATION, before any artifact — and a
// faint echo of it slipped into a tool-call description even after the append
// guard landed. The repo cannot reach the token sampler, but a Stop hook CAN
// read the transcript and inspect the response text the moment a turn ends.
//
// Contract: Stop hooks receive stdin JSON { transcript_path, hook_event_name:
// "Stop", stop_hook_active, ... }. The transcript is JSONL; the last assistant
// entry's text blocks are this turn's response. We run the detector on that.
//
// ADVISORY, not blocking: on a rut we emit a non-blocking `systemMessage`
// (visible warning) and exit 0. We deliberately do NOT block the stop (exit 2
// / decision:"block"): forcing a re-generation on a rut risks re-rutting in a
// loop — the very failure we are guarding. Surface it; let a human/next turn
// break the loop from outside (you cannot break a rut from inside it).
//
// READ-ONLY: never writes a file (respects shared-checkout view-only). Any
// error → exit 0 silently (a hook must never break the session).

import { readFileSync } from "node:fs";

import { detectRepeatedTokenRut } from "../../src/Core.TypeScript/hygiene/detect-repeated-token-rut";

interface StopHookInput {
  readonly transcript_path?: string;
  readonly hook_event_name?: string;
  readonly stop_hook_active?: boolean;
}

/**
 * Extract the concatenated text of the LAST assistant turn from a transcript
 * JSONL string. Pure; tolerant of malformed lines. Returns "" if none found.
 */
export function extractLastAssistantText(jsonl: string): string {
  const lines = jsonl.split("\n");
  // Walk bottom-up; the first assistant entry we hit is the latest turn.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (line === undefined || line.length === 0) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as {
      type?: string;
      message?: { role?: string; content?: unknown };
    };
    const isAssistant = e.type === "assistant" || e.message?.role === "assistant";
    if (!isAssistant) continue;
    const content = e.message?.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) continue;
    const texts: string[] = [];
    for (const block of content) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as { type?: string }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        texts.push((block as { text: string }).text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
    // An assistant turn with only tool_use blocks: no text to check. Stop here
    // (this IS the latest turn) — return "" so we cleanly allow.
    return "";
  }
  return "";
}

function readInput(): StopHookInput {
  try {
    return JSON.parse(readFileSync(0, "utf8")) as StopHookInput;
  } catch {
    return {};
  }
}

function main(): void {
  const input = readInput();
  const path = input.transcript_path;
  if (path === undefined || path.length === 0) return; // nothing to inspect

  let jsonl: string;
  try {
    jsonl = readFileSync(path, "utf8");
  } catch {
    return; // unreadable transcript — never break the session
  }

  const text = extractLastAssistantText(jsonl);
  if (text.length === 0) return;

  const verdict = detectRepeatedTokenRut(text);
  if (!verdict.isRut) return;

  // Non-blocking visible warning. systemMessage surfaces to the user without
  // forcing a continuation (which could loop).
  const out = {
    systemMessage:
      `⚠ repeated-token rut detected in the last response — ${verdict.reason}. ` +
      `This is the degenerate-output failure mode (a loop with no new entropy ` +
      `collapsing to a fixed point). A rut cannot be broken from inside the loop; ` +
      `an external signal (your interrupt / next input) is what clears it.`,
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

if (import.meta.main) {
  try {
    main();
  } catch {
    // A hook must never break the session.
  }
  process.exit(0);
}
