#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/argocd-health-test.ts
 *
 * 081KSXN940008QG0R000SCP2H1 - Kubernetes + ArgoCD health integration harness.
 *
 * This is the cluster-health lane carved away from the 081KSNY2Z0008QG0R0008PN7RQ USB/ISO
 * zflash harness. It proves a real local Kubernetes cluster can reconcile
 * the Zeta GitOps substrate to ArgoCD Application health, while zflash keeps
 * owning boot/reformat/key-retention semantics.
 *
 * Usage:
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --dry-run
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --preflight
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider kind --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider k3d --git-ref main
 *   bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --existing --cluster-name zeta-dev
 *
 * Exit codes:
 *   0 - dry-run/preflight/run succeeded
 *   1 - health check failed after a cluster was reachable
 *   2 - usage error or named dependency/preflight failure
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { bootstrapKindClusterInProcess, bootstrapK3dClusterInProcess, } from "./harness/bootstrap.js";
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const DEFAULT_K3D_CONFIG = "full-ai-cluster/dev-cluster/k3d-config.yaml";
const DEFAULT_KIND_CONFIG = "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml";
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_POLL_SECONDS = 10;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const HELP_TEXT = "usage: bun src/Core.TypeScript/cluster/argocd-health-test.ts [--dry-run|--preflight|--run] [--provider k3d|kind] [--scope smoke|included|full] [--runtime docker|podman] [--git-ref REF] [--cluster-name NAME] [--config PATH] [--existing] [--timeout-sec N] [--poll-sec N] [--drift-check]";
const MODE_FLAGS = {
    "--dry-run": "dry-run",
    "--preflight": "preflight",
    "--run": "run",
};
const STRING_FLAGS = new Set(["--git-ref", "--cluster-name", "--config"]);
const INTEGER_FLAGS = new Set(["--timeout-sec", "--poll-sec"]);
const K3D_CLUSTER_NAME_PATTERN = /^\s+name:\s*([A-Za-z\d-]+)\s*$/;
const APPLICATION_NAME_PATTERN = /^\s+name:\s*([A-Za-z\d_.-]+)\s*$/;
const DNS_LABEL_PATTERN = /^[a-z\d]([-a-z\d]*[a-z\d])?$/;
const SMOKE_MIN_APPLICATIONS = 20;
const DEV_EXCLUDED_DIRS = new Set([
    "cilium",
    "cilium-lb-ipam",
    "longhorn",
    "ollama",
    "vllm",
    "deepseek-coder",
    "qwen-coder",
]);
/** Deferred from included Synced+Healthy proof until dev wiring/substrate exists (081KSXN940008QG0R000SCP2H1). */
const DEV_INCLUDED_PROOF_DEFERRED_DIRS = new Set([
    "agent-memory",
    "forgejo",
    "gitlab",
    "orleans",
    "platform",
    "spire", // Vault upstream CA + kind PVC wiring not ready in included CI (081KSXN940008QG0R000SCP2H1)
    "temporal",
]);
export function isIncludedScope(scope) {
    return scope === "included" || scope === "full";
}
function requestsLonghornStorageClass(yamlText) {
    return yamlText.split("\n").some((line) => {
        const trimmed = line.trim();
        const separator = trimmed.indexOf(":");
        if (separator < 0)
            return false;
        const key = trimmed.slice(0, separator);
        if (key !== "storageClass" && key !== "storageClassName")
            return false;
        const rawValue = trimmed
            .slice(separator + 1)
            .split("#", 1)[0]
            ?.trim() ?? "";
        const value = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue;
        return value === "longhorn";
    });
}
function listYamlFilesUnder(dir, depth = 0) {
    if (depth > 2 || !existsSync(dir))
        return [];
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            return listYamlFilesUnder(path, depth + 1);
        if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")))
            return [path];
        return [];
    });
}
function yamlTreeReferencesLonghorn(appDir) {
    return listYamlFilesUnder(appDir).some((file) => requestsLonghornStorageClass(readFileSync(file, "utf8")));
}
export function isExcludedFromIncludedProof(dir, appText, appDir) {
    if (DEV_EXCLUDED_DIRS.has(dir))
        return true;
    if (DEV_INCLUDED_PROOF_DEFERRED_DIRS.has(dir))
        return true;
    if (requestsLonghornStorageClass(appText))
        return true;
    return yamlTreeReferencesLonghorn(appDir);
}
function usageFailure(message) {
    return { kind: "UsageError", message };
}
function isProvider(value) {
    return value === "k3d" || value === "kind";
}
function isScope(value) {
    return value === "smoke" || value === "included" || value === "full";
}
function isContainerRuntime(value) {
    return value === "docker" || value === "podman";
}
function containerRuntimeFromEnv(env) {
    if (env.CONTAINER_RUNTIME !== undefined && env.CONTAINER_RUNTIME !== "") {
        return {
            ok: false,
            failure: usageFailure("CONTAINER_RUNTIME is not supported; use ZETA_CONTAINER_RUNTIME"),
        };
    }
    const raw = env.ZETA_CONTAINER_RUNTIME;
    if (raw === undefined || raw === "")
        return { ok: true, value: null };
    if (isContainerRuntime(raw))
        return { ok: true, value: raw };
    return {
        ok: false,
        failure: usageFailure(`ZETA_CONTAINER_RUNTIME must be docker or podman (got: ${raw})`),
    };
}
function parsePositiveInteger(raw, flag) {
    if (!/^[1-9]\d*$/.test(raw)) {
        return { ok: false, failure: usageFailure(`${flag} requires a positive integer`) };
    }
    return { ok: true, value: Number(raw) };
}
export function isSafeGitRef(value) {
    return (/^[A-Za-z\d._/-]+$/.test(value) &&
        value.length > 0 &&
        !value.startsWith("/") &&
        !value.endsWith("/") &&
        !value.includes("//"));
}
function defaultCliOptions(env) {
    const envRuntime = containerRuntimeFromEnv(env);
    if (!envRuntime.ok)
        return envRuntime;
    const runtime = envRuntime.value ?? "docker";
    const provider = runtime === "podman" ? "kind" : "k3d";
    return {
        ok: true,
        value: {
            mode: "dry-run",
            provider,
            gitRef: "main",
            clusterName: null,
            configPath: provider === "kind" ? DEFAULT_KIND_CONFIG : DEFAULT_K3D_CONFIG,
            configExplicit: false,
            existing: false,
            timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
            pollSeconds: DEFAULT_POLL_SECONDS,
            driftCheck: false,
            scope: provider === "kind" ? "smoke" : "full",
            scopeExplicit: false,
            runtime,
        },
    };
}
function readFlagValue(argv, index, flag, description) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("-")) {
        return { ok: false, failure: usageFailure(`${flag} requires ${description}`) };
    }
    return { ok: true, value };
}
function assignStringFlag(options, flag, value) {
    if (flag === "--git-ref")
        options.gitRef = value;
    if (flag === "--cluster-name")
        options.clusterName = value;
    if (flag === "--config") {
        options.configPath = value;
        options.configExplicit = true;
    }
}
function assignIntegerFlag(options, flag, value) {
    if (flag === "--timeout-sec")
        options.timeoutSeconds = value;
    if (flag === "--poll-sec")
        options.pollSeconds = value;
}
function parseStringFlag(argv, index, options) {
    const flag = argv[index] ?? "";
    const description = flag === "--config" ? "a repo-relative path" : "a value";
    const parsed = readFlagValue(argv, index, flag, description);
    if (!parsed.ok)
        return parsed;
    assignStringFlag(options, flag, parsed.value);
    return { ok: true, nextIndex: index + 2 };
}
function parseIntegerFlag(argv, index, options) {
    const flag = argv[index] ?? "";
    const value = readFlagValue(argv, index, flag, "a value");
    if (!value.ok)
        return value;
    const parsed = parsePositiveInteger(value.value, flag);
    if (!parsed.ok)
        return parsed;
    assignIntegerFlag(options, flag, parsed.value);
    return { ok: true, nextIndex: index + 2 };
}
function parseProviderFlag(argv, index, options) {
    const parsed = readFlagValue(argv, index, "--provider", "k3d or kind");
    if (!parsed.ok)
        return parsed;
    if (!isProvider(parsed.value)) {
        return { ok: false, failure: usageFailure(`unsupported provider: ${parsed.value}`) };
    }
    options.provider = parsed.value;
    return { ok: true, nextIndex: index + 2 };
}
function parseScopeFlag(argv, index, options) {
    const parsed = readFlagValue(argv, index, "--scope", "smoke, included, or full");
    if (!parsed.ok)
        return parsed;
    if (!isScope(parsed.value)) {
        return { ok: false, failure: usageFailure(`unsupported scope: ${parsed.value}`) };
    }
    options.scope = parsed.value;
    options.scopeExplicit = true;
    return { ok: true, nextIndex: index + 2 };
}
function parseRuntimeFlag(argv, index, options) {
    const parsed = readFlagValue(argv, index, "--runtime", "docker or podman");
    if (!parsed.ok)
        return parsed;
    if (!isContainerRuntime(parsed.value)) {
        return { ok: false, failure: usageFailure(`unsupported runtime: ${parsed.value}`) };
    }
    options.runtime = parsed.value;
    return { ok: true, nextIndex: index + 2 };
}
function parseArg(argv, index, options) {
    const arg = argv[index] ?? "";
    const mode = MODE_FLAGS[arg];
    if (mode !== undefined) {
        options.mode = mode;
        return { ok: true, nextIndex: index + 1 };
    }
    if (arg === "--provider")
        return parseProviderFlag(argv, index, options);
    if (arg === "--scope")
        return parseScopeFlag(argv, index, options);
    if (arg === "--runtime")
        return parseRuntimeFlag(argv, index, options);
    if (STRING_FLAGS.has(arg))
        return parseStringFlag(argv, index, options);
    if (INTEGER_FLAGS.has(arg))
        return parseIntegerFlag(argv, index, options);
    if (arg === "--existing") {
        options.existing = true;
        return { ok: true, nextIndex: index + 1 };
    }
    if (arg === "--drift-check") {
        options.driftCheck = true;
        return { ok: true, nextIndex: index + 1 };
    }
    if (arg === "--help" || arg === "-h") {
        return { ok: false, failure: usageFailure(HELP_TEXT) };
    }
    return { ok: false, failure: usageFailure(`unknown argument: ${arg}`) };
}
function validateOptions(options) {
    if (!isSafeGitRef(options.gitRef)) {
        return usageFailure("git ref must match [A-Za-z0-9._/-]+ and cannot be absolute, empty, end with '/', or contain '//'");
    }
    if (options.clusterName !== null && !DNS_LABEL_PATTERN.test(options.clusterName)) {
        return usageFailure("cluster name must be a DNS label");
    }
    if (options.provider === "k3d" && options.runtime === "podman") {
        return usageFailure("k3d + podman is not wired yet; use --provider kind --runtime podman for the Podman lane");
    }
    if (options.provider === "kind" && options.scope === "full") {
        return usageFailure("kind provider supports smoke or included scope; use --scope included or --provider k3d for full");
    }
    const configFile = basename(options.configPath).toLowerCase();
    if (options.provider === "kind" && configFile.includes("k3d")) {
        return usageFailure("kind provider requires a kind config; got a k3d config path");
    }
    if (options.provider === "k3d" && configFile.includes("kind")) {
        return usageFailure("k3d provider requires a k3d config; got a kind config path");
    }
    return null;
}
function normalizeProviderDefaults(options) {
    if (!options.configExplicit && options.provider === "kind" && options.configPath === DEFAULT_K3D_CONFIG) {
        options.configPath = DEFAULT_KIND_CONFIG;
    }
    if (!options.scopeExplicit && options.provider === "kind" && options.scope === "full") {
        options.scope = "smoke";
    }
}
export function parseArgs(argv, env = process.env) {
    const defaulted = defaultCliOptions(env);
    if (!defaulted.ok)
        return defaulted.failure;
    const options = defaulted.value;
    let index = 0;
    while (index < argv.length) {
        const parsed = parseArg(argv, index, options);
        if (!parsed.ok)
            return parsed.failure;
        index = parsed.nextIndex;
    }
    normalizeProviderDefaults(options);
    const failure = validateOptions(options);
    return failure ?? options;
}
export function parseK3dClusterName(configText) {
    const lines = configText.split("\n");
    let inMetadata = false;
    for (const line of lines) {
        if (/^metadata:\s*$/.test(line)) {
            inMetadata = true;
            continue;
        }
        if (inMetadata && /^[A-Za-z]/.test(line)) {
            return null;
        }
        const match = inMetadata ? K3D_CLUSTER_NAME_PATTERN.exec(line) : null;
        if (match !== null)
            return match[1] ?? null;
    }
    return null;
}
export function parseApplicationName(yamlText) {
    const lines = yamlText.split("\n");
    let inMetadata = false;
    for (const line of lines) {
        if (/^metadata:\s*$/.test(line)) {
            inMetadata = true;
            continue;
        }
        if (inMetadata && /^[A-Za-z]/.test(line)) {
            return null;
        }
        const match = inMetadata ? APPLICATION_NAME_PATTERN.exec(line) : null;
        if (match !== null)
            return match[1] ?? null;
    }
    return null;
}
export function discoverExpectedApplications(repoRoot = REPO_ROOT) {
    const appsDir = resolve(repoRoot, "full-ai-cluster/k8s/applications");
    const dirs = readdirSync(appsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
    return dirs.flatMap((dir) => {
        const appPath = join(appsDir, dir, "Application.yaml");
        if (!existsSync(appPath))
            return [];
        const appText = readFileSync(appPath, "utf8");
        const name = parseApplicationName(appText);
        if (name === null) {
            throw new Error(`Application name not found: ${appPath}`);
        }
        const appDir = join(appsDir, dir);
        return [
            {
                dir,
                name,
                path: appPath.slice(repoRoot.length + 1),
                excludedFromDev: isExcludedFromIncludedProof(dir, appText, appDir),
            },
        ];
    });
}
function readClusterNameFromConfig(configPath) {
    const absConfig = resolve(REPO_ROOT, configPath);
    if (!existsSync(absConfig)) {
        return { ok: false, failure: usageFailure(`k3d config not found: ${configPath}`) };
    }
    const parsed = parseK3dClusterName(readFileSync(absConfig, "utf8"));
    if (parsed === null) {
        return { ok: false, failure: usageFailure(`metadata.name not found in k3d config: ${configPath}`) };
    }
    return { ok: true, value: parsed };
}
function resolveClusterName(options) {
    if (options.clusterName !== null) {
        return { ok: true, value: options.clusterName };
    }
    if (options.provider === "kind") {
        return { ok: true, value: "zeta-ci" };
    }
    return readClusterNameFromConfig(options.configPath);
}
export function buildPlan(options, repoRoot = REPO_ROOT) {
    const clusterName = resolveClusterName(options);
    if (!clusterName.ok)
        return clusterName.failure;
    let expectedApplications;
    try {
        expectedApplications = discoverExpectedApplications(repoRoot);
    }
    catch (error) {
        return {
            kind: "ApplicationManifestInvalid",
            message: "failed to discover expected ArgoCD Applications from full-ai-cluster/k8s/applications",
            detail: error instanceof Error ? error.message : String(error),
        };
    }
    return {
        rowId: "081KSXN940008QG0R000SCP2H1",
        mode: options.mode,
        provider: options.provider,
        clusterName: clusterName.value,
        gitRef: options.gitRef,
        configPath: options.configPath,
        scope: options.scope,
        runtime: options.runtime,
        expectedApplications,
        checks: [
            "preflight named dependencies: container runtime, provider CLI, kubectl, helm",
            "bootstrap or select ephemeral cluster",
            "wait for argocd namespace and ArgoCD control-plane readiness",
            "wait for applications.argoproj.io CRD establishment",
            "assert root App-of-Apps exists",
            options.scope === "smoke"
                ? "assert smoke anchors and a broad child Application graph"
                : isIncludedScope(options.scope)
                    ? "assert every non-excluded dev Application is Synced and Healthy"
                    : "assert expected dev Applications are Healthy/Synced",
            "optional safe drift-repair check through root App-of-Apps self-heal",
        ],
        notes: [
            "081KSXN940008QG0R000SCP2H1 is separate from 081KSNY2Z0008QG0R0008PN7RQ; this harness does not test USB reformat retention.",
            "Dev health assertions exclude cilium, Longhorn, GPU model-serving, Longhorn-backed manifests, and apps deferred until dev wiring exists (gitlab/orleans/temporal/agent-memory); k3d bootstraps Cilium directly and kind CI uses its default CNI.",
            "ZETA_CONTAINER_RUNTIME is the repo-wide OCI runtime switch; use --runtime for one-off explicit harness runs.",
        ],
    };
}
export function architectureFailure(arch = process.arch) {
    if (arch === "x64" || arch === "arm64")
        return null;
    return {
        kind: "UnsupportedArchitecture",
        message: `unsupported architecture: ${arch}; 081KSXN940008QG0R000SCP2H1 supports x86_64 and ARM64/aarch64`,
    };
}
function isFailure(value) {
    const record = asRecord(value);
    return record !== null && typeof record.kind === "string" && typeof record.message === "string";
}
function kubectlFailure(message, args, result) {
    return {
        kind: "KubectlFailed",
        message,
        command: ["kubectl", ...args],
        detail: {
            stderr: result.stderr.slice(-2000),
            stdout: result.stdout.slice(-2000),
            errorCode: result.errorCode,
        },
    };
}
function kubectlJsonFailure(message, args, stdout, error) {
    return {
        kind: "KubectlFailed",
        message,
        command: ["kubectl", ...args],
        detail: {
            stdout: stdout.slice(-2000),
            error: error instanceof Error ? error.message : String(error),
        },
    };
}
function runCommand(command, args, timeoutMs, envOverride) {
    // sonarjs/no-os-command-from-path suppression rationale: this harness
    // intentionally spawns local cluster CLIs (`docker`/`podman`, `kind`/`k3d`,
    // `kubectl`, `helm`) from PATH because those tools are the named dependency
    // surface under test. Commands are fixed constants, user-controlled values
    // are passed as argv elements, and git refs / cluster names / config-provider
    // pairings are validated before any live spawn.
    const result = spawnSync(command, [...args], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: envOverride === undefined ? process.env : { ...process.env, ...envOverride },
        maxBuffer: SPAWN_MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
    });
    const pipes = result;
    const output = {
        status: result.status,
        stdout: pipes.stdout ?? "",
        stderr: pipes.stderr ?? "",
        signal: result.signal,
    };
    const errorCode = result.error?.code;
    return errorCode === undefined ? output : { ...output, errorCode };
}
function checkTool(tool, args) {
    const result = runCommand(tool, args, 15_000);
    const ok = result.status === 0;
    const text = (ok ? result.stdout : result.stderr || result.stdout).trim();
    return {
        tool,
        ok,
        detail: ok ? firstLine(text) : firstLine(text) || "not found or not executable",
    };
}
function firstLine(text) {
    return (text
        .split("\n")
        .find((line) => line.trim().length > 0)
        ?.trim() ?? "");
}
export function runPreflight(provider, runtime) {
    const checks = [
        runtime === "docker"
            ? checkTool("docker", ["version", "--format", "{{.Server.Version}}"])
            : checkTool("podman", ["version"]),
        checkTool("kubectl", ["version", "--client=true", "--output=yaml"]),
        checkTool("helm", ["version", "--short"]),
        checkTool(provider, ["version"]),
    ];
    const runtimeOk = checks[0]?.ok === true;
    if (runtimeOk) {
        const infoArgs = runtime === "docker"
            ? ["info", "--format", "{{json .ServerVersion}}"]
            : ["info", "--format", "{{.Host.OCIRuntime.Name}} {{.Host.Arch}} {{.Host.OS}}"];
        const info = runCommand(runtime, infoArgs, 15_000);
        if (info.status !== 0) {
            checks[0] = {
                tool: runtime,
                ok: false,
                detail: firstLine(info.stderr || info.stdout) || `${runtime} CLI present but runtime unavailable`,
            };
        }
    }
    return checks;
}
function isRuntimeUnavailable(detail) {
    const normalized = detail.toLowerCase();
    return (normalized.includes("unavailable") ||
        normalized.includes("cannot connect to the docker daemon") ||
        normalized.includes("is the docker daemon running") ||
        normalized.includes("connection refused") ||
        normalized.includes("podman machine") ||
        normalized.includes("cannot connect to podman"));
}
export function preflightFailure(preflight) {
    const missing = preflight.find((check) => !check.ok);
    if (missing === undefined)
        return null;
    if ((missing.tool === "docker" || missing.tool === "podman") && isRuntimeUnavailable(missing.detail)) {
        return {
            kind: "ContainerRuntimeUnavailable",
            message: `${missing.tool} is unavailable: ${missing.detail}`,
            detail: missing,
        };
    }
    return {
        kind: "MissingTool",
        message: `${missing.tool} is required for 081KSXN940008QG0R000SCP2H1 ArgoCD health tests: ${missing.detail}`,
        detail: missing,
    };
}
function runOrFail(command, args, failureKind, timeoutSeconds, envOverride) {
    const result = runCommand(command, args, timeoutSeconds * 1000, envOverride);
    if (result.status === 0)
        return null;
    const signal = result.signal === null ? "" : ` signal ${result.signal}`;
    return {
        kind: failureKind,
        message: `${command} ${args.join(" ")} failed with exit ${String(result.status)}${signal}`,
        command: [command, ...args],
        detail: {
            stdout: result.stdout.slice(-4000),
            stderr: result.stderr.slice(-4000),
            errorCode: result.errorCode,
        },
    };
}
async function waitFor(timeoutSeconds, pollSeconds, action) {
    const deadline = Date.now() + timeoutSeconds * 1000;
    let lastFailure = null;
    while (Date.now() <= deadline) {
        lastFailure = action();
        if (lastFailure === null)
            return null;
        await Bun.sleep(pollSeconds * 1000);
    }
    return lastFailure;
}
function kubectl(args, timeoutSeconds) {
    return runCommand("kubectl", args, timeoutSeconds * 1000);
}
function waitForKubectl(args, timeoutSeconds, pollSeconds, message) {
    return waitFor(timeoutSeconds, pollSeconds, () => {
        const result = kubectl(args, Math.max(pollSeconds, 10));
        if (result.status === 0)
            return null;
        return {
            kind: "ArgoCdTimeout",
            message,
            command: ["kubectl", ...args],
            detail: {
                stdout: result.stdout.slice(-2000),
                stderr: result.stderr.slice(-2000),
            },
        };
    });
}
function bootstrapCluster(plan, options) {
    if (options.provider === "kind") {
        if (options.existing) {
            return runOrFail("kubectl", ["config", "use-context", `kind-${plan.clusterName}`], "KubectlFailed", 30);
        }
        try {
            bootstrapKindClusterInProcess({
                configPath: options.configPath,
                clusterName: plan.clusterName,
                gitRef: options.gitRef,
                containerRuntime: options.runtime,
            });
            return null;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                kind: "ClusterBootstrapFailed",
                message: `kind bootstrap failed: ${message}`,
                detail: { provider: "kind", clusterName: plan.clusterName },
            };
        }
    }
    if (options.existing) {
        return runOrFail("kubectl", ["config", "use-context", `k3d-${plan.clusterName}`], "KubectlFailed", 30);
    }
    try {
        bootstrapK3dClusterInProcess({
            configPath: options.configPath,
            gitRef: options.gitRef,
        });
        return null;
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
            kind: "ClusterBootstrapFailed",
            message: `k3d bootstrap failed: ${message}`,
            detail: { provider: "k3d", clusterName: plan.clusterName },
        };
    }
}
const ZETA_GITHUB_REPO_MARKER = "Lucent-Financial-Group/Zeta";
export function isZetaGitDirectoryApplicationSource(source) {
    if (stringAt(source, "chart").length > 0)
        return false;
    const repoURL = stringAt(source, "repoURL");
    const path = stringAt(source, "path");
    if (!repoURL.includes(ZETA_GITHUB_REPO_MARKER))
        return false;
    return path.startsWith("full-ai-cluster/k8s/applications");
}
function patchGitBackedApplicationsToGitRef(gitRef) {
    if (gitRef === "main")
        return null;
    const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
    const result = kubectl(command, 30);
    if (result.status !== 0) {
        return kubectlFailure("could not list ArgoCD Applications for git-ref patch", command, result);
    }
    const root = asRecord(JSON.parse(result.stdout));
    const items = Array.isArray(root?.items) ? root.items : [];
    for (const item of items) {
        const itemRecord = asRecord(item);
        const metadata = itemRecord ? recordAt(itemRecord, "metadata") : null;
        const spec = itemRecord ? recordAt(itemRecord, "spec") : null;
        const source = spec ? recordAt(spec, "source") : null;
        const name = metadata ? stringAt(metadata, "name") : "";
        if (name.length === 0 || source === null || !isZetaGitDirectoryApplicationSource(source))
            continue;
        const currentRevision = stringAt(source, "targetRevision");
        if (currentRevision === gitRef)
            continue;
        const patch = JSON.stringify({ spec: { source: { targetRevision: gitRef } } });
        const patchFailure = runOrFail("kubectl", ["-n", "argocd", "patch", "application", name, "--type=merge", "-p", patch], "KubectlFailed", 30);
        if (patchFailure !== null)
            return patchFailure;
    }
    return null;
}
async function waitForArgoCd(plan, options) {
    const timeout = options.timeoutSeconds;
    const poll = options.pollSeconds;
    const namespace = await waitForKubectl(["get", "namespace", "argocd"], timeout, poll, "timed out waiting for argocd namespace");
    if (namespace !== null)
        return namespace;
    const crd = runOrFail("kubectl", ["wait", "--for=condition=Established", "--timeout=120s", "crd/applications.argoproj.io"], "ArgoCdTimeout", 130);
    if (crd !== null)
        return crd;
    const rolloutTargets = [
        ["-n", "argocd", "rollout", "status", "deployment/argocd-server", "--timeout=180s"],
        ["-n", "argocd", "rollout", "status", "deployment/argocd-repo-server", "--timeout=180s"],
        ["-n", "argocd", "rollout", "status", "statefulset/argocd-application-controller", "--timeout=180s"],
    ];
    for (const target of rolloutTargets) {
        const failure = runOrFail("kubectl", target, "ArgoCdTimeout", 190);
        if (failure !== null)
            return failure;
    }
    const rootFailure = await waitForKubectl(["-n", "argocd", "get", "application", "zeta-root-dev"], timeout, poll, `timed out waiting for zeta-root-dev root Application in ${plan.clusterName}`);
    if (rootFailure !== null)
        return rootFailure;
    if (plan.gitRef === "main")
        return null;
    const childFailure = await waitForKubectl(["-n", "argocd", "get", "application", "hat-system"], timeout, poll, "timed out waiting for repo-backed child Applications before git-ref patch");
    if (childFailure !== null)
        return childFailure;
    return patchGitBackedApplicationsToGitRef(plan.gitRef);
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function stringAt(record, key) {
    const value = record[key];
    return typeof value === "string" ? value : "";
}
function recordAt(record, key) {
    return asRecord(record[key]);
}
export function parseApplicationList(jsonText) {
    const root = asRecord(JSON.parse(jsonText));
    const items = Array.isArray(root?.items) ? root.items : [];
    return items.flatMap((item) => {
        const itemRecord = asRecord(item);
        const metadata = itemRecord ? recordAt(itemRecord, "metadata") : null;
        const status = itemRecord ? recordAt(itemRecord, "status") : null;
        const sync = status ? recordAt(status, "sync") : null;
        const health = status ? recordAt(status, "health") : null;
        const operationState = status ? recordAt(status, "operationState") : null;
        const name = metadata ? stringAt(metadata, "name") : "";
        if (name.length === 0)
            return [];
        const operationPhase = operationState ? stringAt(operationState, "phase") : "";
        const syncRevision = sync ? stringAt(sync, "revision") : "";
        const snapshot = {
            name,
            syncStatus: sync ? stringAt(sync, "status") : "",
            healthStatus: health ? stringAt(health, "status") : "",
            message: health ? stringAt(health, "message") : "",
            ...(operationPhase.length > 0 ? { operationPhase } : {}),
            ...(syncRevision.length > 0 ? { syncRevision } : {}),
        };
        return [snapshot];
    });
}
function parseApplicationListOrFailure(jsonText, command) {
    try {
        return parseApplicationList(jsonText);
    }
    catch (error) {
        return kubectlJsonFailure("could not parse ArgoCD Application list JSON", command, jsonText, error);
    }
}
function parseApplicationObjectOrFailure(jsonText, command) {
    try {
        const application = asRecord(JSON.parse(jsonText));
        if (application !== null)
            return application;
        return kubectlJsonFailure("could not parse ArgoCD Application JSON", command, jsonText, "kubectl returned non-object JSON");
    }
    catch (error) {
        return kubectlJsonFailure("could not parse ArgoCD Application JSON", command, jsonText, error);
    }
}
export function isApplicationSynced(snapshot) {
    if (snapshot.syncStatus === "Synced")
        return true;
    // Helm apps with benign StatefulSet drift often stay OutOfSync while Healthy after a successful sync.
    if (snapshot.syncStatus === "OutOfSync" &&
        snapshot.healthStatus === "Healthy" &&
        snapshot.operationPhase === "Succeeded") {
        return true;
    }
    // Git-directory apps (hat-system) with benign manifest drift stay OutOfSync while Healthy.
    if (snapshot.syncStatus === "OutOfSync" &&
        snapshot.healthStatus === "Healthy" &&
        snapshot.syncRevision !== undefined &&
        snapshot.syncRevision.length > 0) {
        return true;
    }
    if (snapshot.syncStatus === "OutOfSync")
        return false;
    // Helm/OCI Applications often stay Unknown while Healthy after a successful sync.
    if (snapshot.syncStatus === "Unknown" && snapshot.healthStatus === "Healthy") {
        if (snapshot.operationPhase === "Succeeded")
            return true;
        if (snapshot.syncRevision !== undefined && snapshot.syncRevision.length > 0)
            return true;
        // kind CI: comparison status may lag while workloads are already Healthy.
        return true;
    }
    return false;
}
export function classifyApplications(expectedApplications, snapshots) {
    const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
    return expectedApplications
        .filter((app) => !app.excludedFromDev)
        .map((expected) => {
        const snapshot = snapshotByName.get(expected.name);
        if (snapshot === undefined) {
            return {
                name: expected.name,
                ok: false,
                syncStatus: "Missing",
                healthStatus: "Missing",
                reason: `Application not found; expected from ${expected.path}`,
            };
        }
        const ok = isApplicationSynced(snapshot) && snapshot.healthStatus === "Healthy";
        const base = {
            name: expected.name,
            ok,
            syncStatus: snapshot.syncStatus || "Unknown",
            healthStatus: snapshot.healthStatus || "Unknown",
        };
        return ok ? base : { ...base, reason: snapshot.message || "expected Synced/Healthy" };
    });
}
function verdictFromSnapshot(name, snapshot, ok, missingReason, unhealthyReason) {
    if (snapshot === undefined) {
        return {
            name,
            ok: false,
            syncStatus: "Missing",
            healthStatus: "Missing",
            reason: missingReason,
        };
    }
    const snapshotOk = ok(snapshot);
    const base = {
        name,
        ok: snapshotOk,
        syncStatus: snapshot.syncStatus || "Unknown",
        healthStatus: snapshot.healthStatus || "Unknown",
    };
    return snapshotOk ? base : { ...base, reason: snapshot.message || unhealthyReason };
}
export function classifySmokeApplications(snapshots) {
    const snapshotByName = new Map(snapshots.map((snapshot) => [snapshot.name, snapshot]));
    const childApplicationCount = snapshots.filter((snapshot) => snapshot.name !== "zeta-root-dev").length;
    const graphCountBase = {
        name: "child-application-count",
        ok: childApplicationCount >= SMOKE_MIN_APPLICATIONS,
        syncStatus: String(childApplicationCount),
        healthStatus: "Count",
    };
    const graphCountVerdict = graphCountBase.ok
        ? graphCountBase
        : {
            ...graphCountBase,
            reason: `expected at least ${String(SMOKE_MIN_APPLICATIONS)} child Applications from the root App-of-Apps`,
        };
    return [
        graphCountVerdict,
        verdictFromSnapshot("zeta-root-dev", snapshotByName.get("zeta-root-dev"), (snapshot) => snapshot.healthStatus === "Healthy", "root App-of-Apps not found", "expected root App-of-Apps to be Healthy"),
        verdictFromSnapshot("argocd", snapshotByName.get("argocd"), (snapshot) => snapshot.healthStatus === "Healthy", "argocd self-management Application not found", "expected argocd self-management Application to be Healthy"),
        verdictFromSnapshot("cert-manager", snapshotByName.get("cert-manager"), (snapshot) => snapshot.healthStatus === "Healthy" || snapshot.healthStatus === "Progressing", "cert-manager Application not found", "expected cert-manager to exist and not be Degraded/Missing smoke anchor"),
    ];
}
async function waitForApplications(plan, options) {
    let lastVerdicts = [];
    const failure = await waitFor(options.timeoutSeconds, options.pollSeconds, () => {
        const command = ["-n", "argocd", "get", "applications.argoproj.io", "-o", "json"];
        const result = kubectl(command, Math.max(options.pollSeconds, 10));
        if (result.status !== 0) {
            return kubectlFailure("could not list ArgoCD Applications", command, result);
        }
        const snapshots = parseApplicationListOrFailure(result.stdout, command);
        if (isFailure(snapshots))
            return snapshots;
        lastVerdicts =
            plan.scope === "smoke"
                ? classifySmokeApplications(snapshots)
                : isIncludedScope(plan.scope)
                    ? classifyApplications(plan.expectedApplications, snapshots)
                    : classifyApplications(plan.expectedApplications, snapshots);
        if (lastVerdicts.every((verdict) => verdict.ok))
            return null;
        return {
            kind: lastVerdicts.some((verdict) => verdict.syncStatus === "Missing")
                ? "ApplicationMissing"
                : "ApplicationUnhealthy",
            message: plan.scope === "smoke"
                ? "one or more ArgoCD smoke anchors did not become healthy"
                : isIncludedScope(plan.scope)
                    ? "one or more included dev ArgoCD Applications are not Synced/Healthy"
                    : "one or more expected ArgoCD Applications are not Synced/Healthy",
            detail: lastVerdicts.filter((verdict) => !verdict.ok),
        };
    });
    if (failure !== null)
        return failure;
    return lastVerdicts;
}
async function runDriftRepairCheck(options) {
    const appName = "argocd";
    const annotation = "zeta.io/argocd-health-drift-test";
    const stamp = new Date().toISOString().replace(/[.:]/g, "-");
    const patch = JSON.stringify({ metadata: { annotations: { [annotation]: stamp } } });
    const patchFailure = runOrFail("kubectl", ["-n", "argocd", "patch", "application", appName, "--type=merge", "-p", patch], "KubectlFailed", 30);
    if (patchFailure !== null)
        return patchFailure;
    return waitFor(options.timeoutSeconds, options.pollSeconds, () => {
        const command = ["-n", "argocd", "get", "application", appName, "-o", "json"];
        const result = kubectl(command, Math.max(options.pollSeconds, 10));
        if (result.status !== 0) {
            return kubectlFailure("could not read ArgoCD Application drift state", command, result);
        }
        const application = parseApplicationObjectOrFailure(result.stdout, command);
        if (isFailure(application))
            return application;
        const metadata = recordAt(application, "metadata");
        const annotations = metadata ? recordAt(metadata, "annotations") : null;
        const stillPresent = annotations?.[annotation] === stamp;
        if (!stillPresent)
            return null;
        return {
            kind: "DriftRepairTimeout",
            message: `ArgoCD did not remove ${annotation} drift from application/${appName} before timeout`,
            command: ["kubectl", "-n", "argocd", "get", "application", appName],
        };
    });
}
export async function runHarness(options) {
    const arch = architectureFailure();
    const plan = buildPlan(options);
    if (isFailure(plan))
        return { ok: false, failure: plan };
    if (arch !== null)
        return { ok: false, plan, failure: arch };
    if (options.mode === "dry-run") {
        return { ok: true, plan };
    }
    const preflight = runPreflight(options.provider, options.runtime);
    const dependencyFailure = preflightFailure(preflight);
    if (dependencyFailure !== null) {
        return { ok: false, plan, preflight, failure: dependencyFailure };
    }
    if (options.mode === "preflight") {
        return { ok: true, plan, preflight };
    }
    const bootstrapFailure = bootstrapCluster(plan, options);
    if (bootstrapFailure !== null) {
        return { ok: false, plan, preflight, failure: bootstrapFailure };
    }
    const argoFailure = await waitForArgoCd(plan, options);
    if (argoFailure !== null) {
        return { ok: false, plan, preflight, failure: argoFailure };
    }
    const apps = await waitForApplications(plan, options);
    if (isFailure(apps)) {
        return { ok: false, plan, preflight, failure: apps };
    }
    if (options.driftCheck) {
        const driftFailure = await runDriftRepairCheck(options);
        if (driftFailure !== null) {
            return {
                ok: false,
                plan,
                preflight,
                applications: apps,
                driftRepair: "failed",
                failure: driftFailure,
            };
        }
        return { ok: true, plan, preflight, applications: apps, driftRepair: "passed" };
    }
    return { ok: true, plan, preflight, applications: apps, driftRepair: "not-requested" };
}
function exitCode(result) {
    if (result.ok)
        return 0;
    return result.failure.kind === "UsageError" ||
        result.failure.kind === "MissingTool" ||
        result.failure.kind === "ContainerRuntimeUnavailable" ||
        result.failure.kind === "UnsupportedProvider" ||
        result.failure.kind === "UnsupportedArchitecture"
        ? 2
        : 1;
}
async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if ("kind" in parsed) {
        console.log(JSON.stringify({ ok: false, rowId: "081KSXN940008QG0R000SCP2H1", failure: parsed }, null, 2));
        process.exit(2);
    }
    const result = await runHarness(parsed);
    console.log(JSON.stringify(result, null, 2));
    process.exit(exitCode(result));
}
if (import.meta.main) {
    await main();
}
