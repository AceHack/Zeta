/**
 * service/persona-registry.ts — data-driven persona configuration.
 *
 * Adding a new persona is a DATA change (add an entry here), not a code change.
 * The unified loop-tick and IServiceManager consume this registry.
 */
export const PERSONAS = [
    {
        name: "otto", label: "com.lucent.zeta.otto-loop",
        scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
        preferredModel: "claude-opus-4-8",
        fallbackModels: ["claude-sonnet-4-6"],
        harness: { command: "claude", args: ["-p", "--model", "{{MODEL}}", "--permission-mode", "auto", "{{PROMPT}}"], defaultModel: "claude-opus-4-8" },
    },
    {
        name: "kiro", label: "com.lucent.zeta.kiro-loop",
        scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
        preferredModel: "auto",
        harness: { command: "kiro-cli", args: ["chat", "--no-interactive", "--trust-all-tools", "{{PROMPT}}"], defaultModel: "auto" },
    },
    {
        name: "codex", label: "com.lucent.zeta.codex-loop",
        scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
        preferredModel: "gpt-5.5",
        fallbackModels: ["o3"],
        harness: { command: "codex", args: ["--approval-mode", "full-auto", "--model", "{{MODEL}}", "{{PROMPT}}"], defaultModel: "gpt-5.5" },
    },
    {
        name: "riven", label: "com.lucent.zeta.riven-loop",
        scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
        preferredModel: "grok-4-3",
        fallbackModels: ["grok-4-3"],
        harness: { command: "cursor-agent", args: ["--print", "--model", "{{MODEL}}", "{{PROMPT}}"], ideNative: true, defaultModel: "grok-4-3" },
    },
    {
        name: "soraya", label: "com.lucent.zeta.soraya-loop",
        scheduleInterval: 60, gateInterval: 0, gateTimeout: 0, defaultRef: "main",
        preferredModel: "claude-opus-4-8",
        fallbackModels: ["claude-sonnet-4-6"],
        harness: { command: "claude", args: ["-p", "--model", "{{MODEL}}", "--permission-mode", "auto", "{{PROMPT}}"], defaultModel: "claude-opus-4-8" },
    },
    {
        name: "lior", label: "com.lucent.zeta.lior-loop",
        scheduleInterval: 60, gateInterval: 900, gateTimeout: 1800, defaultRef: "main",
        preferredModel: "gemini-3.5-flash",
        fallbackModels: ["gemini-3.1-pro"],
        harness: { command: "agy", args: ["-p", "{{PROMPT}}", "--model", "{{MODEL}}", "--dangerously-skip-permissions"], defaultModel: "gemini-3.5-flash" },
    },
];
/** Mutable runtime registry — starts with the static PERSONAS, can be extended at runtime. */
const registry = [...PERSONAS];
export function getPersona(name) {
    return registry.find((p) => p.name === name);
}
export function listPersonas() {
    return registry;
}
export function listPersonaNames() {
    return registry.map((p) => p.name);
}
/**
 * Register a persona at runtime (ephemeral — not persisted to disk).
 * Use for test personas, local-LLM personas, or personas that don't
 * need a permanent entry in the static array.
 *
 * If a persona with the same name already exists, it is replaced.
 */
export function registerPersona(config) {
    const idx = registry.findIndex((p) => p.name === config.name);
    if (idx >= 0) {
        registry[idx] = config;
    }
    else {
        registry.push(config);
    }
}
/**
 * Create a local-LLM persona config (convenience helper).
 * No external CLI required — calls ollama directly.
 */
export function localLlmPersona(name, opts) {
    return {
        name,
        label: `local-llm-${name}`,
        scheduleInterval: 0,
        gateInterval: 0,
        gateTimeout: 60,
        defaultRef: "main",
        preferredModel: opts?.model ?? "qwen3.6:0.6b",
        harness: {
            type: "local-llm",
            command: "ollama", // not actually shelled out — marker only
            args: [],
            model: opts?.model ?? "qwen3.6:0.6b",
            defaultModel: "qwen2.5:0.5b", // fallback to what's installed locally
            host: opts?.host ?? "http://127.0.0.1:11434",
            systemPrompt: opts?.systemPrompt ?? `You are ${name}, a local test persona. Respond concisely.`,
        },
    };
}
