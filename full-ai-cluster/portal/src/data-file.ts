// full-ai-cluster/portal/src/data-file.ts
//
// FileRoomStore — durable Rooms on an append-only JSONL log, one file per Room
// (<namespace>~<name>.jsonl) under a directory mounted on a Longhorn volume.
// This is the persistent collaboration / agent-memory substrate (Memory
// Preservation #5): every Event is appended as one JSON line, never rewritten,
// so the log is replayable (DST) and a Z-set retraction is just another appended
// line. On startup we replay each file into memory; writes append to disk first,
// then update the in-memory view. Single-writer (the StatefulSet pod owns it).

import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RoomSource } from "./data-k8s.ts";
import type { RoomData, RoomEventVM } from "./viewmodel.ts";

const FILE_SUFFIX = ".jsonl";

/**
 * A Kubernetes DNS-1123 label -- the only shape a namespace or a name may have.
 * No dot, no slash, no `%`, no `~`, so no segment of a validated resource can
 * mean anything to a path resolver.
 */
const LABEL = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;

/**
 * An actor id as it may appear in the durable log.
 *
 * Wider than a DNS label because personas and humans are named more freely
 * (`otto`, `otto.cli`, `agent_7`), and still a closed character class: no
 * separator, no control character, no `/`.
 */
const ACTOR_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;

/**
 * The file this Room's log lives in -- AND the only place a caller-supplied
 * string becomes a path component, which is why the validation is here.
 *
 * MEASURED 2026-09-11, and this was an arbitrary-file-append reachable from an
 * unauthenticated HTTP route. `api.ts`'s `decodeResource` runs
 * `decodeURIComponent` on the URL segment, so `%2F` arrives as a real `/` and
 * the `[^/]+` route pattern never saw it. The old mapping was
 * `resource.replace("/", "~")` -- `String.prototype.replace` with a STRING
 * pattern replaces the FIRST occurrence only -- so `../../etc/cron.d/x` became
 * `..~/../etc/cron.d/x`, `join(dir, ...)` resolved straight back out of the
 * volume, and `appendFileSync` created or grew a file anywhere this process can
 * write, with caller-influenced JSON in it.
 *
 * A wider replace would not have fixed it (`..~..~etc` still escapes nothing,
 * but `.` and `%` and a leading `-` are all still live), so the guard is an
 * ALLOW-LIST on the shape the domain actually has: `namespace/name`, or a bare
 * `name`, each a DNS-1123 label. Refuse, never mangle -- a normalised path is a
 * path whose meaning the caller can no longer predict.
 */
function fileFor(resource: string): string {
  const parts = resource.split("/");
  if (parts.length > 2 || !parts.every((seg) => LABEL.test(seg))) {
    throw new Error(
      `refusing room resource ${JSON.stringify(resource)}: expected "<namespace>/<name>" or "<name>" of DNS-1123 labels`,
    );
  }
  return `${parts.join("~")}${FILE_SUFFIX}`;
}

const resourceOf = (file: string) => file.slice(0, -FILE_SUFFIX.length).replaceAll("~", "/");

/**
 * An actor id on its way into the append-only log, or a refusal.
 *
 * The log is the Room's memory (#5 Memory Preservation): an identity written
 * into it is quoted back later as the proposer or the authorizer of an event,
 * so an unconstrained string here is an identity anyone upstream can invent.
 * `spec.ai.admin` on a Deployable CR reaches this through the chat route
 * without passing any check of its own -- CodeQL alert 182
 * (`js/http-to-file-access`) is that flow, from the Kubernetes API response to
 * this file's `appendFileSync`.
 *
 * Test and refuse, never mangle: a truncated or rewritten id names a different
 * actor, and silently attributing an event to the wrong one is worse than
 * refusing the write.
 */
function actorId(raw: string): string {
  if (!ACTOR_ID.test(raw)) {
    throw new Error(`refusing actor id ${JSON.stringify(raw)}: expected [A-Za-z0-9][A-Za-z0-9._-]{0,62}`);
  }
  return raw;
}

export class FileRoomStore implements RoomSource {
  private rooms = new Map<string, RoomData>();
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.replay();
  }

  /** Load every <ns>~<name>.jsonl into memory (one Event per line). */
  private replay(): void {
    for (const file of readdirSync(this.dir)) {
      if (!file.endsWith(FILE_SUFFIX)) continue;
      const resource = resourceOf(file);
      const events: RoomEventVM[] = [];
      const raw = readFileSync(join(this.dir, file), "utf8");
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          events.push(JSON.parse(t) as RoomEventVM);
        } catch {
          // a torn final line (crash mid-append) — skip it; the log is otherwise intact
        }
      }
      this.rooms.set(resource, { resource, events });
    }
  }

  /** Append one Event to a Room's log (durable) and to the in-memory view. */
  private appendEvent(resource: string, ev: RoomEventVM): void {
    appendFileSync(join(this.dir, fileFor(resource)), JSON.stringify(ev) + "\n");
    const room = this.rooms.get(resource);
    if (room) room.events.push(ev);
    else this.rooms.set(resource, { resource, events: [ev] });
  }

  /** The next deterministic id/seq for a Room (length-based; single-writer). */
  private nextSeq(resource: string): number {
    return this.rooms.get(resource)?.events.length ?? 0;
  }

  // ── RoomSource ────────────────────────────────────────────────────────
  async listRooms(): Promise<RoomData[]> {
    return [...this.rooms.values()];
  }
  async getRoom(resource: string): Promise<RoomData | undefined> {
    return this.rooms.get(resource);
  }

  async grant(resource: string, requestId: string, by: string, granted: boolean, note?: string): Promise<boolean> {
    const room = this.rooms.get(resource);
    if (!room) return false;
    if (!room.events.some((e) => e.id === requestId && e.body.type === "authorization-request")) return false;
    const seq = this.nextSeq(resource);
    const author = actorId(by); // the validated value is what continues, below and nowhere else
    this.appendEvent(resource, {
      id: `evt-${seq}`,
      seq,
      weight: 1,
      proposedBy: { id: author, kind: "human" },
      authorizedBy: { id: author, kind: "human" }, // only a human authorizes (no-directives)
      body: { type: "authorization-grant", requestId, granted, ...(note ? { note } : {}) },
    });
    return true;
  }

  /**
   * Append a typed Event to a Room (the room-service write path the controller +
   * persona runtime use). `by` is the proposer; `kind` defaults to persona.
   * Returns the appended Event so the caller can reference its id.
   */
  async append(resource: string, by: { id: string; kind?: "human" | "persona" }, body: RoomEventVM["body"]): Promise<RoomEventVM> {
    const seq = this.nextSeq(resource);
    const author = actorId(by.id); // validated value bound to a local; `by.id` is not used again
    const ev: RoomEventVM = { id: `evt-${seq}`, seq, weight: body.type === "retraction" ? -1 : 1, proposedBy: { id: author, kind: by.kind ?? "persona" }, body };
    this.appendEvent(resource, ev);
    return ev;
  }
}
