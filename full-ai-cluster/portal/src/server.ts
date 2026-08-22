// full-ai-cluster/portal/src/server.ts
//
// The portal server: routes /api/* through the BFF (api.ts) over a PlatformData
// source, and serves the static Fluent UI shell for everything else. In-cluster
// it reads Deployables/Blueprints live from k8s; with PORTAL_DEMO=1 it serves a
// seeded in-memory platform so the UI runs on a laptop with no cluster.

import { join } from "node:path";
import { handle, type PlatformData } from "./api.ts";
import type { AdminData } from "./admin.ts";
import { K8sPlatform } from "./data-k8s.ts";
import { K8sAdmin } from "./data-admin-k8s.ts";
import { FileRoomStore } from "./data-file.ts";
import { CompositePlatform } from "./data-composite.ts";
import { DemoOps } from "./ops-demo.ts";
import { demoAdmin } from "./admin-demo.ts";
import { demoPlatform, demoResources } from "./demo.ts";

// The built React SPA (web/ -> dist/). Built by `bun run build` in web/.
const UI_DIR = join(import.meta.dir, "..", "dist");
const PORT = Number(process.env.PORT ?? 8080);

/** Attach the cluster-admin reads to a platform (PlatformData.admin is optional). */
function withAdmin(p: PlatformData, admin: AdminData): PlatformData {
  (p as { admin?: AdminData }).admin = admin;
  return p;
}

function makeData(): PlatformData {
  // Local dev with DURABLE rooms: demo resources + a real FileRoomStore. Lets you
  // exercise the durable room-service on a laptop (set ZETA_ROOMS_DIR).
  if (process.env.PORTAL_DEMO === "1") {
    const dir = process.env.ZETA_ROOMS_DIR;
    const base = dir ? new CompositePlatform(demoResources(), new FileRoomStore(dir), new DemoOps()) : demoPlatform();
    return withAdmin(base, demoAdmin());
  }
  // In-cluster: live resources + cluster-admin reads from k8s; Rooms persisted to
  // a Longhorn-backed append-only JSONL log (durable across pod restarts — the
  // StatefulSet volume) which is also the agent-memory substrate (#5).
  const roomsDir = process.env.ZETA_ROOMS_DIR ?? "/var/lib/zeta-rooms";
  return withAdmin(new K8sPlatform(new FileRoomStore(roomsDir)), new K8sAdmin());
}

const data = makeData();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const apiResp = await handle(req, data);
    if (apiResp) return apiResp;

    // static file serving (the SPA shell)
    const url = new URL(req.url);
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(UI_DIR, rel));
    if (await file.exists()) return new Response(file);
    // SPA fallback
    return new Response(Bun.file(join(UI_DIR, "index.html")));
  },
});

console.log(`zeta portal on http://localhost:${server.port}  (demo=${process.env.PORTAL_DEMO === "1"})`);
