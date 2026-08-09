import { installBrowserServiceWorkerRuntime } from "./browser-service-worker-runtime";
import { runBrowserZetaDbWake } from "./browser-zetadb-image-port";
import { installBrowserZetaDbWakeRuntime } from "./browser-zetadb-wake-runtime";

export const BROWSER_SERVICE_WORKER_ENTRY_RESULT = installBrowserServiceWorkerRuntime(globalThis, {
  maxClients: 32,
  maxFeedback: 32,
});

export const BROWSER_ZETA_DB_SERVICE_WORKER_ENTRY_RESULT = installBrowserZetaDbWakeRuntime(globalThis, (request) =>
  runBrowserZetaDbWake(
    globalThis,
    { databaseName: "zeta-browser-node", storeName: "database-images" },
    { ...request, executorKind: "service-worker-event" },
  ),
);
