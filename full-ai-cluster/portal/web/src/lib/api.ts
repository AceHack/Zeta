// Typed client for the portal BFF (/api/*). Mirrors the server view models.

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
export interface CatalogVar {
  name: string;
  default?: string;
  description?: string;
}
export interface CatalogEntryVM {
  blueprint: string;
  category: string;
  image: string;
  stateful: boolean;
  defaultExpose: string;
  variables: CatalogVar[];
}
export interface NeedsMeItemVM {
  resource: string;
  requestId: string;
  proposedBy: string;
  gated?: string;
  summary: string;
}
export interface RoomEventVM {
  id: string;
  seq: number;
  weight: 1 | -1;
  proposedBy: { id: string; kind: "human" | "persona" };
  authorizedBy?: { id: string; kind: "human" | "persona" };
  body: Record<string, unknown> & { type: string };
}
export interface RoomVM {
  resource: string;
  phase?: string;
  participants: Array<{ id: string; kind: "human" | "persona" }>;
  events: RoomEventVM[];
  pending: NeedsMeItemVM[];
}

const j = async <T>(p: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(p, init);
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${p} → ${r.status}`);
  return r.json() as Promise<T>;
};

const enc = (resource: string) => resource.replace("/", "~");

export const api = {
  resources: () => j<{ groups: CategoryGroupVM[] }>("/api/resources").then((d) => d.groups),
  catalog: () => j<{ catalog: CatalogEntryVM[] }>("/api/catalog").then((d) => d.catalog),
  needsMe: () => j<{ items: NeedsMeItemVM[] }>("/api/needs-me").then((d) => d.items),
  room: (resource: string) => j<{ room: RoomVM }>(`/api/rooms/${enc(resource)}`).then((d) => d.room),
  grant: (resource: string, requestId: string, by: string, granted: boolean, note?: string) =>
    j<{ ok: boolean }>(`/api/rooms/${enc(resource)}/grant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, by, granted, note }),
    }),
};
