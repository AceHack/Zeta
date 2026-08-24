// Some Core.TypeScript imports probe `process`/`Buffer`; give the page
// global minimal stand-ins so those probes see defined objects.
const pageGlobal = self as unknown as {
  process?: { env: Record<string, string> };
  Buffer?: { from(str: string): Uint8Array };
};
if (typeof pageGlobal.process === "undefined") {
  pageGlobal.process = { env: {} };
}
if (typeof pageGlobal.Buffer === "undefined") {
  pageGlobal.Buffer = { from: (str: string) => new TextEncoder().encode(str) };
}
/**
 * PURGE THE DEAD CREDENTIAL SINK.
 *
 * Until this change the page collected an LLM API key, persisted it to
 * `localStorage` in clear text, and posted it to the swarm worker \u2014 which
 * logged a warning and dropped it. `SwarmController` builds all three of its
 * backends with the literal string "dummy" and resolves its host from the
 * persona-registry, so the key authenticated nothing. It carried 100% of the
 * exposure of a stored secret and 0% of the function. (CodeQL
 * js/clear-text-storage-of-sensitive-data, main.ts:120 as it stood.)
 *
 * Deleting the collection code is NOT sufficient on its own: a visitor who
 * already saved a key keeps it in their browser forever, orphaned and still
 * readable by any script on the origin. Removal without a purge would close the
 * alert and leave every existing viewer's secret exactly where it was. So the
 * key is actively destroyed on load, on every load, permanently \u2014 this is
 * not a migration step to delete later.
 */
const LEGACY_API_KEY_STORAGE_KEY = "zeta_llm_api_key";
const purgedLegacyApiKey = localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY) !== null;
if (purgedLegacyApiKey) {
  localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
  console.warn(
    "[Twitch] Removed an LLM API key stored by an earlier version of this page. " +
      "It was never used by the engine. If it is still valid, rotate it.",
  );
}

import { Chip8TvPlayer } from "./components/Chip8TvPlayer";
import { StudyRunner } from "./study";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol";

/** getElementById that throws with the id instead of returning null. */
function mustGet(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`required element #${id} is missing from the page`);
  return el;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("required element #app is missing from the page");
app.innerHTML = `
  <header>
    <h1>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
        <polygon points="16 12 10 16 10 8 16 12"></polygon>
      </svg>
      Zeta Twitch <span style="font-weight: 300; font-size: 1rem; color: var(--text-muted);">| The LLMTV Multi-Stream (PWA Mode)</span>
    </h1>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <button id="upload-btn" class="upload-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Upload CHIP-8 Cart
      </button>
      <input type="file" id="rom-upload" style="display: none;" accept=".ch8,.bin" />
      <button id="settings-btn" class="upload-btn" style="padding: 0.4rem 0.6rem;" title="API Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
      <div class="live-badge">LIVE</div>
    </div>
  </header>
  <main id="streams-container">
    <div id="loading" style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
       <div class="mono" style="animation: pulse 2s infinite">Initializing Swarm Engine in Browser...</div>
    </div>
  </main>

  <!-- Settings Modal -->
  <div id="settings-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
    <div style="background: var(--surface); border: 1px solid var(--border); padding: 2rem; border-radius: 8px; width: 100%; max-width: 400px;">
      <h2 style="margin-top: 0; margin-bottom: 1.5rem; font-size: 1.25rem;">LLM Provider Settings</h2>

      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">OpenAI-Compatible Base URL</label>
        <input type="text" id="api-base-url" placeholder="https://api.openai.com" style="width: 100%; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 4px;" />
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Saved in this browser as a preference. The engine does not read it yet &mdash; <code>SwarmController</code> resolves host and model from the persona-registry and exposes no override.</div>
      </div>

      <div style="margin-bottom: 1.5rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: 4px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
        <strong style="color: var(--text);">This page does not ask for an API key.</strong>
        The arena runs fully offline: the CHIP-8 path bypasses the LLM, and the
        engine builds every backend with a placeholder credential. There is
        nothing a key would authenticate, so collecting one would store a secret
        in exchange for no capability.
      </div>

      <div id="storage-disclosure" style="margin-bottom: 1.5rem; font-size: 0.75rem; color: var(--text-muted);"></div>

      <div style="display: flex; justify-content: flex-end; gap: 1rem;">
        <button id="settings-clear-key" class="upload-btn" style="background: transparent; margin-right: auto;">Clear stored settings</button>
        <button id="settings-cancel" class="upload-btn" style="background: transparent;">Cancel</button>
        <button id="settings-save" class="upload-btn" style="background: var(--primary);">Save & Reload</button>
      </div>
    </div>
  </div>
`;

// Setup Settings Modal
const settingsModal = mustGet("settings-modal");
const settingsBtn = mustGet("settings-btn");
const settingsCancel = mustGet("settings-cancel");
const settingsClear = mustGet("settings-clear-key");
const settingsSave = mustGet("settings-save");
const baseUrlInput = mustGet("api-base-url") as HTMLInputElement;
const storageDisclosure = mustGet("storage-disclosure");

/**
 * Ordinal (UTF-16 code-unit) comparison, never `localeCompare` \u2014 the
 * repo's collation treaty forbids linguistic comparison because it varies by
 * locale and ICU version (.claude/rules/culture-invariant-by-default.md).
 */
function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Render what this origin ACTUALLY holds, read back out of `localStorage` at
 * the moment the panel opens.
 *
 * This is a readout, not a promise. A hardcoded list of "what we store" is a
 * claim that goes stale the moment some other module writes a key; enumerating
 * the live store cannot go stale, because it *is* the store. Key names and byte
 * lengths only \u2014 never values. That is the discipline the rest of the repo
 * applies to secrets (prove presence, never print the value), kept here even
 * though nothing this page writes is a credential any more, because this is the
 * pattern the next browser surface will copy.
 */
function renderStorageDisclosure(): void {
  const entries: { readonly key: string; readonly bytes: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("zeta") !== true) continue;
    entries.push({ key, bytes: (localStorage.getItem(key) ?? "").length });
  }
  entries.sort((a, b) => ordinalCompare(a.key, b.key));

  // Built with textContent, never innerHTML: these strings come back out of a
  // store that any script on the origin can write, so they are treated as data.
  storageDisclosure.replaceChildren();

  const heading = document.createElement("div");
  heading.style.cssText = "color: var(--text); font-weight: 600; margin-bottom: 0.4rem;";
  heading.textContent = "Stored by this page, in this browser";
  storageDisclosure.appendChild(heading);

  if (purgedLegacyApiKey) {
    const purged = document.createElement("div");
    purged.style.cssText =
      "margin-bottom: 0.5rem; padding: 0.5rem; border-left: 2px solid var(--primary); color: var(--text);";
    purged.textContent =
      "An API key saved by an earlier version of this page was found in this " +
      "browser and has been deleted. It was never used \u2014 the engine " +
      "ignored it. If that key is still valid, rotate it: it sat in clear text, " +
      "readable by any script on this origin.";
    storageDisclosure.appendChild(purged);
  }

  if (entries.length === 0) {
    const none = document.createElement("div");
    none.textContent = "Nothing. No keys are set.";
    storageDisclosure.appendChild(none);
    return;
  }

  const list = document.createElement("ul");
  list.style.cssText = "margin: 0; padding-left: 1.1rem;";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "mono";
    item.textContent = `${entry.key} \u2014 ${String(entry.bytes)} bytes`;
    list.appendChild(item);
  }
  storageDisclosure.appendChild(list);

  const note = document.createElement("div");
  note.style.cssText = "margin-top: 0.4rem;";
  note.textContent = "Names and sizes only \u2014 values are never displayed.";
  storageDisclosure.appendChild(note);
}

settingsBtn.addEventListener("click", () => {
  baseUrlInput.value = localStorage.getItem("zeta_llm_base_url") ?? "";
  renderStorageDisclosure();
  settingsModal.style.display = "flex";
});

settingsCancel.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

settingsClear.addEventListener("click", () => {
  localStorage.removeItem("zeta_llm_base_url");
  baseUrlInput.value = "";
  renderStorageDisclosure();
});

settingsSave.addEventListener("click", () => {
  if (baseUrlInput.value.trim()) {
    localStorage.setItem("zeta_llm_base_url", baseUrlInput.value.trim());
  } else {
    localStorage.removeItem("zeta_llm_base_url");
  }

  settingsModal.style.display = "none";
  window.location.reload(); // Reload to re-initialize the swarm with the new setting
});

function startSwarmSimulation(): void {
  const agentId = "browser-node";
  console.log(`[Twitch] Initializing Swarm Engine in PWA mode for ${agentId}...`);

  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";

  const player = new Chip8TvPlayer("streams-container", agentId);

  // ROM Upload Logic
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("rom-upload") as HTMLInputElement | null;

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  // Instantiate Swarm Web Worker
  const worker = new Worker(new URL("./swarm.worker.ts", import.meta.url), { type: "module" });
  const post = (message: MainToWorkerMessage, transfer?: Transferable[]): void => {
    if (transfer) worker.postMessage(message, transfer);
    else worker.postMessage(message);
  };

  // Attach Controller Events
  const keyMap: Record<string, number> = {
    [`btn-start-${agentId}`]: 0,
    [`btn-lt-${agentId}`]: 1,
    [`btn-up-${agentId}`]: 2,
    [`btn-rt-${agentId}`]: 3,
    [`btn-left-${agentId}`]: 4,
    [`btn-a-${agentId}`]: 5,
    [`btn-right-${agentId}`]: 6,
    [`btn-x-${agentId}`]: 7,
    [`btn-down-${agentId}`]: 8,
    [`btn-b-${agentId}`]: 9,
    [`btn-lb-${agentId}`]: 10,
    [`btn-rb-${agentId}`]: 11,
    [`btn-y-${agentId}`]: 12,
    [`btn-l3-${agentId}`]: 13,
    [`btn-r3-${agentId}`]: 14,
    [`btn-select-${agentId}`]: 15,
  };

  Object.entries(keyMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("pointerdown", () => {
        post({ type: "KEY_DOWN", payload: { key } });
      });
      el.addEventListener("pointerup", () => {
        post({ type: "KEY_UP", payload: { key } });
      });
      el.addEventListener("pointerleave", () => {
        post({ type: "KEY_UP", payload: { key } });
      });
    }
  });

  // `apiKey` stays in the INIT payload SHAPE because `swarm.worker.ts` still
  // reads the field in order to warn that it is ignored, but this page has no
  // key to put in it and never will: it is pinned `null` at the only call site.
  // Dropping the field from the protocol is the worker owner's follow-up.
  const savedBaseUrl = localStorage.getItem("zeta_llm_base_url");

  post({
    type: "INIT",
    payload: {
      apiKey: null,
      baseUrl: savedBaseUrl,
    },
  });

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      file
        .arrayBuffer()
        .then((buffer) => {
          console.log("[Twitch] Injecting Epigenetic Material to Worker");
          post({ type: "INJECT_EPIGENETIC_MATERIAL", payload: { buffer } }, [buffer]); // Transfer buffer for performance
        })
        .catch((err: unknown) => {
          console.error("[Twitch] Failed to read uploaded cart:", err);
        });
    });
  }

  // D6 (?study=1): the prediction falsifier — pauses at probe points, asks
  // "where next?", grades against the agent's actual displacement, and
  // counterbalances full/none/placebo/arrow-only conditions.
  const study =
    new URLSearchParams(window.location.search).get("study") === "1"
      ? new StudyRunner(post, player)
      : null;

  // Listen for frames from the worker (FRAME is currently the only variant;
  // the protocol union will grow with the attention overlay).
  worker.onmessage = (e: MessageEvent<WorkerToMainMessage>) => {
    const { payload } = e.data;
    player.updateFrame(payload.display);
    player.updatePredictions(payload);
    study?.onFrame(payload);
  };
  worker.onerror = (e) => {
    console.error("[SwarmWorker Error]", e.message, e.filename, e.lineno);
  };
}

startSwarmSimulation();

