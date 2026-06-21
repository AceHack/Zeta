var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveStorageStatePath, validateStorageStateFile, validateGitHubSession, } from "./auth";
import { extractToggles, extractFormValues, extractVisibleFeatures } from "./snapshot";
import { diffPageSnapshots } from "./feature-diff";
import { appendEntry, DEFAULT_LOG_PATH } from "./drain-log";
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class MutationAuthorizationError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "MutationAuthorizationError";
    }
}
export class MutationExecutionError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "MutationExecutionError";
    }
}
// ---------------------------------------------------------------------------
// Authorized surfaces (from 081KR2E4K0008QG0R002A0AGBJ)
// ---------------------------------------------------------------------------
const AUTHORIZED_SURFACES_PATH = resolve(import.meta.dir, "authorized-surfaces.json");
export function loadAuthorizedSurfaces(path = AUTHORIZED_SURFACES_PATH) {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw);
    return data.surfaces;
}
// ---------------------------------------------------------------------------
// Authorization check — mandatory, no bypass path
// ---------------------------------------------------------------------------
function authorizeRequest(surfaces, request) {
    const surface = surfaces.find((s) => s.id === request.surfaceId);
    if (!surface) {
        throw new MutationAuthorizationError(`Surface "${request.surfaceId}" is not in the authorized-surfaces list. ` +
            `Only maintainer-approved surfaces may be mutated via this helper.`);
    }
    if (!surface.allowedActions.includes(request.action)) {
        throw new MutationAuthorizationError(`Action "${request.action}" is not allowed on surface "${request.surfaceId}". ` +
            `Allowed: ${surface.allowedActions.join(", ")}.`);
    }
}
// ---------------------------------------------------------------------------
// Inverse action mapping
// ---------------------------------------------------------------------------
function inverseOf(action) {
    if (action === "toggle-on")
        return "toggle-off";
    if (action === "toggle-off")
        return "toggle-on";
    throw new MutationExecutionError(`No known inverse for action "${action}". Add an inverse mapping before using this action.`);
}
// ---------------------------------------------------------------------------
// Params validation (runs before session open — fail fast)
// ---------------------------------------------------------------------------
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;
function validateParams(action, params) {
    switch (action) {
        case "toggle-on":
        case "toggle-off":
            if (!SAFE_KEY_PATTERN.test(params.toggleKey)) {
                return `Invalid toggleKey "${params.toggleKey}": must match /^[a-zA-Z0-9_-]+$/ to avoid selector injection.`;
            }
            return null;
        default:
            return `No executor for action "${action}" in mutate.ts — add one to extend this tool.`;
    }
}
// ---------------------------------------------------------------------------
// Snapshot capture (within an existing session)
// ---------------------------------------------------------------------------
async function captureSnapshot(page, url, username) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const html = await page.content();
    return {
        url: page.url(),
        timestamp: new Date().toISOString(),
        username,
        extracted: {
            toggles: extractToggles(html),
            formValues: extractFormValues(html),
            visibleFeatures: extractVisibleFeatures(html),
        },
    };
}
// ---------------------------------------------------------------------------
// Mutation executor
// ---------------------------------------------------------------------------
async function executeAction(page, action, params) {
    switch (action) {
        case "toggle-on":
        case "toggle-off": {
            // toggleKey already validated — this selector is safe
            const selector = `input[name="${params.toggleKey}"], input#${params.toggleKey}`;
            try {
                await page.click(selector);
            }
            catch (err) {
                throw new MutationExecutionError(`Failed to click toggle "${params.toggleKey}" on ${params.url}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
            }
            break;
        }
        default:
            throw new MutationExecutionError(`No executor for action "${action}" in mutate.ts.`);
    }
}
// ---------------------------------------------------------------------------
// Main mutate function
// ---------------------------------------------------------------------------
/**
 * Execute a guarded GitHub UI mutation with mandatory before/after snapshots
 * and authorization check against the 081KR2E4K0008QG0R002A0AGBJ authorized-surfaces list.
 *
 * Guardrails enforced in code (no bypass paths):
 *   - Authorization: surface + action must appear in authorized-surfaces.json
 *   - Snapshot pair: both before and after snapshots are always captured
 *   - Inverse action: recorded in the drain log entry for reversibility
 *
 * The drain log entry returned here is written to disk by 081KR2E4K0008QG0R002N1C3YJ (drain-log.ts).
 */
export async function mutate(request, options = {}) {
    // 1. Load authorized surfaces
    let surfaces;
    try {
        surfaces = loadAuthorizedSurfaces(options.authorizedSurfacesPath);
    }
    catch (err) {
        return {
            success: false,
            error: `Failed to load authorized surfaces: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    // 2. Authorization check — mandatory, no bypass path
    try {
        authorizeRequest(surfaces, request);
    }
    catch (err) {
        if (err instanceof MutationAuthorizationError) {
            return { success: false, error: err.message };
        }
        throw err;
    }
    // 3. Compute inverse (fail fast before opening session)
    let inverseAction;
    try {
        inverseAction = inverseOf(request.action);
    }
    catch (err) {
        if (err instanceof MutationExecutionError) {
            return { success: false, error: err.message };
        }
        throw err;
    }
    // 4. Validate params (fail fast before opening session)
    const paramError = validateParams(request.action, request.params);
    if (paramError !== null) {
        return { success: false, error: paramError };
    }
    // 5. Open authenticated session
    const storageStatePath = resolveStorageStatePath(options);
    await validateStorageStateFile(storageStatePath);
    const driver = options.driver ?? (await createDefaultMutableDriver());
    const context = await driver.newContext(storageStatePath);
    try {
        const page = await context.newPage();
        const username = await validateGitHubSession(page, options);
        // 6. Before snapshot — mandatory
        const before = await captureSnapshot(page, request.params.url, username);
        // 7. Execute mutation
        try {
            await executeAction(page, request.action, request.params);
        }
        catch (err) {
            if (err instanceof MutationExecutionError) {
                return { success: false, error: err.message };
            }
            throw err;
        }
        // 8. After snapshot — mandatory (reload page to capture updated state)
        const after = await captureSnapshot(page, request.params.url, username);
        // 9. Structured diff (echoed to chat output per don't-ask-permission echo discipline)
        const diff = diffPageSnapshots(before, after);
        // 10. Build drain log entry and persist it (append-only invariant)
        const drainLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            surfaceId: request.surfaceId,
            action: request.action,
            inverseAction,
            params: request.params,
            before,
            after,
            diff,
            status: "applied",
        };
        let drainLogWriteError;
        if (options.skipLog !== true) {
            const logPath = options.logPath ?? DEFAULT_LOG_PATH;
            try {
                appendEntry(drainLogEntry, logPath);
            }
            catch (err) {
                drainLogWriteError =
                    `Failed to append drain-log entry to ${logPath}: ${err instanceof Error ? err.message : String(err)}`;
            }
        }
        return drainLogWriteError === undefined
            ? { success: true, before, after, diff, drainLogEntry }
            : { success: true, before, after, diff, drainLogEntry, drainLogWriteError };
    }
    finally {
        await context.close();
    }
}
// ---------------------------------------------------------------------------
// Default Playwright-backed mutable driver
// ---------------------------------------------------------------------------
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
async function createDefaultMutableDriver() {
    const moduleName = "playwright";
    let imported;
    try {
        imported = await import(__rewriteRelativeImportExtension(moduleName));
    }
    catch (err) {
        throw new MutationExecutionError("Playwright is unavailable; install the project Playwright runtime or pass a test driver.", { cause: err });
    }
    if (!isRecord(imported) || !isRecord(imported.chromium)) {
        throw new MutationExecutionError("Playwright did not expose chromium.");
    }
    const chromium = imported.chromium;
    if (typeof chromium.launch !== "function") {
        throw new MutationExecutionError("Playwright did not expose chromium.launch.");
    }
    return {
        async newContext(storageStatePath) {
            const browser = await chromium.launch({ headless: true });
            let rawContext;
            try {
                rawContext = (await browser.newContext({ storageState: storageStatePath }));
            }
            catch (err) {
                await browser.close();
                throw err;
            }
            return {
                async newPage() {
                    return rawContext.newPage();
                },
                async close() {
                    try {
                        await rawContext.close();
                    }
                    finally {
                        await browser.close();
                    }
                },
            };
        },
    };
}
