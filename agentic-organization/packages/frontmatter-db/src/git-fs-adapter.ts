/**
 * Filesystem-backed Git adapter implementing the sync ports (GitEventSource +
 * GitEventSink) over a directory of event files at:
 *   <root>/events/<table>/<ZetaIdDecimal>.md
 *
 * The sync ports are synchronous (readEvents / appendEvent), but filesystem I/O
 * is async. The adapter resolves that by:
 *   1. load(table)  -> async: read every event file into an in-memory snapshot
 *   2. ports        -> sync: serve reads from the snapshot, buffer appends
 *   3. flush()      -> async: write buffered appended events to disk
 *
 * This keeps the tested pure sync core (syncGitToIndex / syncIndexToGit)
 * untouched while the actual git/fs work happens at the load/flush edges.
 * Committing the written files to git is the caller's concern (or a // TODO
 * git-commit hook); this adapter owns the working-tree files only.
 */

import { parseEvent, serializeEvent } from "./event-codec.ts";
import type { FrontmatterEvent, ZetaIdDecimal } from "./event.ts";
import type { GitEventSink, GitEventSource } from "./sync.ts";

/** Minimal async filesystem port so the adapter is testable without node:fs. */
export interface EventFileSystem {
  listEventFiles(table: string): Promise<readonly string[]>;
  readEventFile(path: string): Promise<string>;
  writeEventFile(path: string, contents: string): Promise<void>;
}

export const GitFsAdapterFeedbackReason = {
  EventFileUnparseable: "event_file_unparseable",
} as const;

export type GitFsAdapterFeedbackReason =
  (typeof GitFsAdapterFeedbackReason)[keyof typeof GitFsAdapterFeedbackReason];

export type GitFsLoadResult =
  | { outcome: "ok"; loaded: number }
  | { outcome: "feedback"; feedback: { reason: GitFsAdapterFeedbackReason; message: string; path: string } };

export interface GitFsAdapter extends GitEventSource, GitEventSink {
  load(table: string): Promise<GitFsLoadResult>;
  flush(): Promise<{ written: number }>;
  pendingCount(): number;
}

export function eventFilePath(table: string, eventId: ZetaIdDecimal): string {
  return `events/${table}/${eventId}.md`;
}

export function createGitFsAdapter(fs: EventFileSystem): GitFsAdapter {
  // table -> (eventId -> event), the loaded snapshot
  const snapshot = new Map<string, Map<ZetaIdDecimal, FrontmatterEvent>>();
  // buffered appends not yet flushed to disk
  const pending: FrontmatterEvent[] = [];

  function tableMap(table: string): Map<ZetaIdDecimal, FrontmatterEvent> {
    let map = snapshot.get(table);
    if (map === undefined) {
      map = new Map<ZetaIdDecimal, FrontmatterEvent>();
      snapshot.set(table, map);
    }
    return map;
  }

  return {
    async load(table: string): Promise<GitFsLoadResult> {
      const paths = await fs.listEventFiles(table);
      const map = tableMap(table);
      let loaded = 0;
      for (const path of paths) {
        const contents = await fs.readEventFile(path);
        const parsed = parseEvent(contents);
        if (parsed.outcome === "feedback") {
          return {
            outcome: "feedback",
            feedback: { reason: GitFsAdapterFeedbackReason.EventFileUnparseable, message: parsed.feedback.message, path },
          };
        }
        map.set(parsed.event.id, parsed.event);
        loaded += 1;
      }
      return { outcome: "ok", loaded };
    },

    readEvents(table: string): readonly FrontmatterEvent[] {
      return [...tableMap(table).values()];
    },

    appendEvent(event: FrontmatterEvent): void {
      tableMap(event.table).set(event.id, event);
      pending.push(event);
    },

    async flush(): Promise<{ written: number }> {
      let written = 0;
      for (const event of pending) {
        await fs.writeEventFile(eventFilePath(event.table, event.id), serializeEvent(event));
        written += 1;
      }
      pending.length = 0;
      return { written };
    },

    pendingCount(): number {
      return pending.length;
    },
  };
}
