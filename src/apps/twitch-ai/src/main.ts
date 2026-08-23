if (typeof self !== 'undefined' && typeof (self as any).process === 'undefined') {
  (self as any).process = { env: {} };
}
if (typeof self !== 'undefined' && typeof (self as any).Buffer === 'undefined') {
  (self as any).Buffer = { from: (str: string) => new TextEncoder().encode(str) };
}
import { Chip8TvPlayer } from "./components/Chip8TvPlayer";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
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
      </div>
      
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">API Key (Saved to localStorage)</label>
        <input type="password" id="api-key" placeholder="sk-..." style="width: 100%; padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 4px;" />
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Leave empty to use local Mock LLM for free. Using an API Key exposes your key to this static host's localStorage.</div>
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 1rem;">
        <button id="settings-cancel" class="upload-btn" style="background: transparent;">Cancel</button>
        <button id="settings-save" class="upload-btn" style="background: var(--primary);">Save & Reload</button>
      </div>
    </div>
  </div>
`;

// Setup Settings Modal
const settingsModal = document.getElementById("settings-modal")!;
const settingsBtn = document.getElementById("settings-btn")!;
const settingsCancel = document.getElementById("settings-cancel")!;
const settingsSave = document.getElementById("settings-save")!;
const baseUrlInput = document.getElementById("api-base-url") as HTMLInputElement;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;

settingsBtn.addEventListener("click", () => {
  baseUrlInput.value = localStorage.getItem("zeta_llm_base_url") || "";
  apiKeyInput.value = localStorage.getItem("zeta_llm_api_key") || "";
  settingsModal.style.display = "flex";
});

settingsCancel.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

settingsSave.addEventListener("click", () => {
  if (baseUrlInput.value.trim()) {
    localStorage.setItem("zeta_llm_base_url", baseUrlInput.value.trim());
  } else {
    localStorage.removeItem("zeta_llm_base_url");
  }
  
  if (apiKeyInput.value.trim()) {
    localStorage.setItem("zeta_llm_api_key", apiKeyInput.value.trim());
  } else {
    localStorage.removeItem("zeta_llm_api_key");
  }
  
  settingsModal.style.display = "none";
  window.location.reload(); // Reload to re-initialize SwarmController with new credentials
});

async function startSwarmSimulation() {
  const agentId = "browser-node";
  console.log(`[Twitch] Initializing Swarm Engine in PWA mode for ${agentId}...`);

  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";

  const player = new Chip8TvPlayer("streams-container", agentId);

  // ROM Upload Logic
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("rom-upload") as HTMLInputElement;

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
  }

  // Instantiate Swarm Web Worker
  const worker = new Worker(new URL('./swarm.worker.ts', import.meta.url), { type: 'module' });

  // Setup ModelBackend Config from LocalStorage
  const savedApiKey = localStorage.getItem("zeta_llm_api_key");
  const savedBaseUrl = localStorage.getItem("zeta_llm_base_url");

  worker.postMessage({
    type: "INIT",
    payload: {
      apiKey: savedApiKey,
      baseUrl: savedBaseUrl
    }
  });

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      console.log(`[Twitch] Injecting Epigenetic Material to Worker`);
      worker.postMessage({
        type: "INJECT_EPIGENETIC_MATERIAL",
        payload: { buffer }
      }, [buffer]); // Transfer buffer for performance
    });
  }

  // Listen for frames from the worker
  worker.onmessage = (e) => {
    const { type, payload } = e.data;
    if (type === "FRAME") {
      player.updateFrame(payload.display);
      player.updatePredictions(payload);
    }
  };
  worker.onerror = (e) => {
    console.error("[SwarmWorker Error]", e.message, e.filename, e.lineno);
  };
}

startSwarmSimulation().catch(console.error);
