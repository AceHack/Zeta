/** Deterministically rebuild the society evidence index from committed JSON events. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendSocietyEventEvidence,
  emptySocietyEventIndex,
  SOCIETY_EVENT_INDEX_FILE,
  type SocietyEventIndex,
} from "./society-event-index";

type EventIdentity = { readonly id: string; readonly at: string };

function parseIdentity(file: string, text: string): EventIdentity {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`teaching error: ${file} contains malformed JSON; repair the committed event before rebuilding evidence`);
  }
  if (!value || typeof value !== "object") throw new Error(`teaching error: ${file} is not a JSON event object`);
  const event = value as Record<string, unknown>;
  const id = event["id"];
  const at = event["at"];
  if (typeof id !== "string" || !id.startsWith("society-") || typeof at !== "string" || Number.isNaN(Date.parse(at))) {
    throw new Error(`teaching error: ${file} must contain a society id and ISO timestamp`);
  }
  return { id, at };
}

export function rebuildSocietyEventIndex(eventDir: string, sourceRevision?: string): SocietyEventIndex {
  const evidence = readdirSync(eventDir)
    .filter(file => file !== SOCIETY_EVENT_INDEX_FILE && /^society-[a-z0-9]+\.json$/.test(file))
    .map(file => {
      const text = readFileSync(join(eventDir, file), "utf8");
      return { file, text, ...parseIdentity(file, text) };
    })
    .sort((left, right) => left.at.localeCompare(right.at) || left.file.localeCompare(right.file));

  const index = evidence.reduce(
    (current, event) => appendSocietyEventEvidence(current, {
      id: event.id,
      at: event.at,
      file: event.file,
      eventText: event.text,
      ...(sourceRevision ? { sourceRevision } : {}),
    }),
    emptySocietyEventIndex(),
  );
  writeFileSync(join(eventDir, SOCIETY_EVENT_INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

if (import.meta.main) {
  const eventDir = process.argv[2] ?? "docs/observe-events";
  const sourceRevision = process.env.GITHUB_SHA;
  const index = rebuildSocietyEventIndex(eventDir, sourceRevision);
  console.log(`[society-index] rebuilt ${index.eventCount} committed evidence entries`);
}
