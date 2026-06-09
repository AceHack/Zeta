// full-ai-cluster/portal/src/viewmodel.ts
//
// The portal's pure view-model layer — the "base for everything". Turns raw
// platform data (Deployable CRs, Blueprint CRs, collaboration Rooms) into the
// clean view objects the UI renders: the top-down Resource list, the deploy
// Catalog, a Room view, and the human's "needs-me" board (pending authorizations
// aggregated across every Room). Pure + fully unit-tested; the server and the
// React shell are thin layers over this.

// ── inbound shapes (minimal slices of the CRs / Room we read) ──────────
export interface DeployableCR {
  metadata: { name: string; namespace: string };
  spec: { blueprint: string; expose?: string; host?: string; ai?: { admin?: string; policy?: string; room?: string } };
  status?: { phase?: string; children?: string[]; message?: string };
}
export interface BlueprintCR {
  metadata: { name: string; namespace: string };
  spec: { category?: string; image: string; stateful?: boolean; defaultExpose?: string; variables?: Array<{ name: string; default?: string; description?: string }> };
}

export type ParticipantKind = "human" | "persona";
export interface RoomEventVM {
  id: string;
  seq: number;
  weight: 1 | -1;
  proposedBy: { id: string; kind: ParticipantKind };
  authorizedBy?: { id: string; kind: ParticipantKind };
  body: Record<string, unknown> & { type: string };
}
export interface RoomData {
  resource: string; // namespace/name
  events: RoomEventVM[];
}

// ── outbound view models ───────────────────────────────────────────────
export type Health = "ready" | "progressing" | "error" | "unknown";

export interface ResourceVM {
  name: string;
  namespace: string;
  blueprint: string;
  category: string;
  health: Health;
  phase: string;
  expose: string;
  host?: string;
  admin: string;
  message?: string;
  children: string[];
}

export interface CategoryGroupVM {
  category: string;
  count: number;
  resources: ResourceVM[];
}

export interface CatalogEntryVM {
  blueprint: string;
  category: string;
  image: string;
  stateful: boolean;
  defaultExpose: string;
  variables: Array<{ name: string; default?: string; description?: string }>;
}

export interface NeedsMeItemVM {
  resource: string;
  requestId: string;
  proposedBy: string;
  gated?: string;
  summary: string;
}

const CATEGORY_ORDER = ["game", "web", "database", "app", "other"];

/** Map a Deployable's status phase to a coarse health for the portal badge. */
export function health(phase: string | undefined): Health {
  switch (phase) {
    case "Ready":
    case "Running":
      return "ready";
    case "Error":
    case "CrashLoopBackOff":
    case "Failed":
      return "error";
    case undefined:
    case "":
      return "unknown";
    default:
      return "progressing";
  }
}

/** Build the per-resource view model, resolving its Blueprint's category. */
export function toResourceVM(d: DeployableCR, blueprints: BlueprintCR[]): ResourceVM {
  const bp = blueprints.find((b) => b.metadata.name === d.spec.blueprint);
  const phase = d.status?.phase ?? "";
  return {
    name: d.metadata.name,
    namespace: d.metadata.namespace,
    blueprint: d.spec.blueprint,
    category: bp?.spec.category ?? "other",
    health: health(phase),
    phase: phase || "Unknown",
    expose: d.spec.expose ?? bp?.spec.defaultExpose ?? "none",
    ...(d.spec.host ? { host: d.spec.host } : {}),
    admin: d.spec.ai?.admin ?? "otto",
    ...(d.status?.message ? { message: d.status.message } : {}),
    children: d.status?.children ?? [],
  };
}

/** The top-down view: resources grouped by category, stable order, sorted by name. */
export function resourceGroups(deployables: DeployableCR[], blueprints: BlueprintCR[]): CategoryGroupVM[] {
  const vms = deployables.map((d) => toResourceVM(d, blueprints));
  const byCat = new Map<string, ResourceVM[]>();
  for (const vm of vms) (byCat.get(vm.category) ?? byCat.set(vm.category, []).get(vm.category)!).push(vm);
  const cats = [...byCat.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib) || a.localeCompare(b);
  });
  return cats.map((category) => {
    const resources = byCat.get(category)!.sort((a, b) => a.name.localeCompare(b.name));
    return { category, count: resources.length, resources };
  });
}

/** The deploy catalog: one entry per Blueprint, ordered by category then name. */
export function catalog(blueprints: BlueprintCR[]): CatalogEntryVM[] {
  return blueprints
    .map((b) => ({
      blueprint: b.metadata.name,
      category: b.spec.category ?? "other",
      image: b.spec.image,
      stateful: b.spec.stateful ?? !!b.spec.variables, // best-effort; engine decides authoritatively
      defaultExpose: b.spec.defaultExpose ?? "none",
      variables: b.spec.variables ?? [],
    }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category), ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.blueprint.localeCompare(b.blueprint);
    });
}

/** Pending authorizations in one Room (live requests with no grant yet). */
export function pendingInRoom(room: RoomData): NeedsMeItemVM[] {
  const retracted = new Set<string>();
  const decided = new Set<string>();
  for (const e of room.events) {
    if (e.body.type === "retraction") retracted.add(String(e.body.retracts));
    if (e.body.type === "authorization-grant") decided.add(String(e.body.requestId));
  }
  const out: NeedsMeItemVM[] = [];
  for (const e of room.events) {
    if (e.weight !== 1 || e.body.type !== "authorization-request") continue;
    if (retracted.has(e.id) || decided.has(e.id)) continue;
    const action = (e.body.action ?? {}) as { summary?: string };
    out.push({
      resource: room.resource,
      requestId: e.id,
      proposedBy: e.proposedBy.id,
      ...(e.body.gated ? { gated: String(e.body.gated) } : {}),
      summary: action.summary ?? "(no summary)",
    });
  }
  return out;
}

/** The "needs-me" board: every pending authorization across all Rooms, the human's queue. */
export function needsMe(rooms: RoomData[]): NeedsMeItemVM[] {
  return rooms.flatMap(pendingInRoom);
}

/** A compact Room view for the collaboration pane: live events + participants + phase. */
export interface RoomVM {
  resource: string;
  phase?: string;
  participants: Array<{ id: string; kind: ParticipantKind }>;
  events: RoomEventVM[]; // live (retractions netted out), in order
  pending: NeedsMeItemVM[];
}
export function toRoomVM(room: RoomData): RoomVM {
  const retracted = new Set<string>();
  for (const e of room.events) if (e.body.type === "retraction") retracted.add(String(e.body.retracts));
  const live = room.events.filter((e) => e.weight === 1 && e.body.type !== "retraction" && !retracted.has(e.id));
  const states = live.filter((e) => e.body.type === "state-change");
  const lastPhase = states.length ? String(states[states.length - 1]!.body.phase) : undefined;
  const seen = new Map<string, { id: string; kind: ParticipantKind }>();
  for (const e of room.events) seen.set(`${e.proposedBy.kind}:${e.proposedBy.id}`, e.proposedBy);
  return {
    resource: room.resource,
    ...(lastPhase ? { phase: lastPhase } : {}),
    participants: [...seen.values()],
    events: live,
    pending: pendingInRoom(room),
  };
}
