import { installBrowserServiceWorkerRuntime } from "./browser-service-worker-runtime";

export const BROWSER_SERVICE_WORKER_ENTRY_RESULT = installBrowserServiceWorkerRuntime(globalThis, {
  maxClients: 32,
  maxFeedback: 32,
});
