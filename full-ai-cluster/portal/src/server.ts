// full-ai-cluster/portal/src/server.ts
//
// The portal server: routes /api/* through the BFF (api.ts) over a PlatformData
// source, and serves the static Fluent UI shell for everything else. In-cluster
// it reads Deployables/Blueprints live from k8s; with PORTAL_DEMO=1 it serves a
// seeded in-memory platform so the UI runs on a laptop with no cluster.

import { join } from "node:path";
import { handle, type PlatformData } from "./api.ts";
import { InMemoryPlatform } from "./data-memory.ts";
import { K8sPlatform } from "./data-k8s.ts";
import { demoPlatform } from "./demo.ts";

const UI_DIR = join(import.meta.dir, "ui");
const PORT = Number(process.env.PORT ?? 8080);

function makeData(): PlatformData {
  if (process.env.PORTAL_DEMO === "1") return demoPlatform();
  // In-cluster: live resources from k8s; Rooms from an in-memory source until the
  // git-event-store-backed persona runtime lands (COLLABORATION-MODEL §9).
  return new K8sPlatform(new InMemoryPlatform([], [], []));
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
