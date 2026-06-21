import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { architectureFailure, buildPlan, classifyApplications, classifySmokeApplications, discoverExpectedApplications, isExcludedFromIncludedProof, isApplicationSynced, isIncludedScope, isZetaGitDirectoryApplicationSource, parseApplicationList, parseApplicationName, parseArgs, parseK3dClusterName, preflightFailure, runHarness, } from "./argocd-health-test.js";
const SMOKE_APPLICATION_LIST = JSON.stringify({
    items: [
        {
            metadata: { name: "zeta-root-dev" },
            status: { sync: { status: "OutOfSync" }, health: { status: "Healthy", message: "" } },
        },
        {
            metadata: { name: "argocd" },
            status: { sync: { status: "Unknown" }, health: { status: "Healthy", message: "" } },
        },
        {
            metadata: { name: "cert-manager" },
            status: { sync: { status: "Synced" }, health: { status: "Healthy", message: "" } },
        },
        ...Array.from({ length: 20 }, (_value, index) => ({
            metadata: { name: `child-${String(index)}` },
            status: { sync: { status: "OutOfSync" }, health: { status: "Missing", message: "" } },
        })),
    ],
});
async function withFakeClusterCli(mode, action) {
    const cliDir = mkdtempSync(join(tmpdir(), "zeta-argocd-health-cli-"));
    const previousPath = process.env.PATH;
    const previousMode = process.env.ZETA_FAKE_KUBECTL_MODE;
    const script = [
        "#!/usr/bin/env bash",
        "set -eu",
        'tool=$(basename "$0")',
        'if [ "$tool" = docker ]; then exit 0; fi',
        'if [ "$tool" = helm ]; then exit 0; fi',
        'if [ "$tool" = kind ]; then exit 0; fi',
        'if [ "$tool" != kubectl ]; then exit 127; fi',
        "mode=${ZETA_FAKE_KUBECTL_MODE:-healthy}",
        "if [ \"${1:-}\" = version ]; then echo 'clientVersion: {}'; exit 0; fi",
        'if [ "${1:-}" = config ] && [ "${2:-}" = use-context ]; then exit 0; fi',
        'if [ "${1:-}" = get ] && [ "${2:-}" = namespace ]; then exit 0; fi',
        'if [ "${1:-}" = wait ]; then exit 0; fi',
        'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = rollout ]; then exit 0; fi',
        'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = application ] && [ "${5:-}" = zeta-root-dev ]; then exit 0; fi',
        'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = applications.argoproj.io ]; then',
        "  if [ \"$mode\" = invalid-list-json ]; then printf '{not json'; exit 0; fi",
        "  cat <<'JSON'",
        SMOKE_APPLICATION_LIST,
        "JSON",
        "  exit 0",
        "fi",
        'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = patch ] && [ "${4:-}" = application ]; then exit 0; fi',
        'if [ "${1:-}" = -n ] && [ "${2:-}" = argocd ] && [ "${3:-}" = get ] && [ "${4:-}" = application ] && [ "${5:-}" = argocd ]; then',
        "  echo 'simulated API read failure' >&2",
        "  exit 7",
        "fi",
        'echo "unexpected kubectl invocation: $*" >&2',
        "exit 66",
        "",
    ].join("\n");
    try {
        for (const tool of ["docker", "helm", "kind", "kubectl"]) {
            const toolPath = join(cliDir, tool);
            writeFileSync(toolPath, script);
            chmodSync(toolPath, 0o755);
        }
        process.env.PATH = `${cliDir}:${previousPath ?? ""}`;
        process.env.ZETA_FAKE_KUBECTL_MODE = mode;
        await action();
    }
    finally {
        if (previousPath === undefined)
            delete process.env.PATH;
        else
            process.env.PATH = previousPath;
        if (previousMode === undefined)
            delete process.env.ZETA_FAKE_KUBECTL_MODE;
        else
            process.env.ZETA_FAKE_KUBECTL_MODE = previousMode;
        rmSync(cliDir, { recursive: true, force: true });
    }
}
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test argument parsing", () => {
    test("defaults to safe dry-run against the k3d dev cluster", () => {
        const parsed = parseArgs([], {});
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.mode).toBe("dry-run");
        expect(parsed.provider).toBe("k3d");
        expect(parsed.gitRef).toBe("main");
        expect(parsed.runtime).toBe("docker");
        expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/k3d-config.yaml");
    });
    test("rejects git refs that could inject YAML or shell syntax", () => {
        const parsed = parseArgs(["--git-ref", "feature/good\nbad"], {});
        expect("kind" in parsed).toBe(true);
        if (!("kind" in parsed))
            throw new Error("expected usage failure");
        expect(parsed.kind).toBe("UsageError");
    });
    test("accepts explicit live k3d mode with bounded polling", () => {
        const parsed = parseArgs([
            "--run",
            "--provider",
            "k3d",
            "--git-ref",
            "claim/example-2026-06-01",
            "--timeout-sec",
            "60",
            "--poll-sec",
            "5",
            "--drift-check",
        ], {});
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.mode).toBe("run");
        expect(parsed.provider).toBe("k3d");
        expect(parsed.timeoutSeconds).toBe(60);
        expect(parsed.pollSeconds).toBe(5);
        expect(parsed.driftCheck).toBe(true);
    });
    test("switches kind runs to the CI kind profile by default", () => {
        const parsed = parseArgs(["--run", "--provider", "kind"], {});
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.provider).toBe("kind");
        expect(parsed.scope).toBe("smoke");
        expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml");
    });
    test("accepts kind on podman for the OCI-runtime lane", () => {
        const parsed = parseArgs(["--run", "--provider", "kind", "--runtime", "podman"], {});
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.provider).toBe("kind");
        expect(parsed.runtime).toBe("podman");
    });
    test("uses ZETA_CONTAINER_RUNTIME as the repo-wide OCI runtime switch", () => {
        const parsed = parseArgs(["--run"], { ZETA_CONTAINER_RUNTIME: "podman" });
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.provider).toBe("kind");
        expect(parsed.runtime).toBe("podman");
        expect(parsed.scope).toBe("smoke");
        expect(parsed.configPath).toBe("full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml");
    });
    test("rejects CONTAINER_RUNTIME instead of treating it as an alias", () => {
        const parsed = parseArgs(["--run", "--provider", "kind"], { CONTAINER_RUNTIME: "podman" });
        expect("kind" in parsed).toBe(true);
        if (!("kind" in parsed))
            throw new Error("expected usage error");
        expect(parsed.message).toContain("CONTAINER_RUNTIME is not supported");
    });
    test("rejects mismatched provider and config flavors before spawning CLIs", () => {
        const parsed = parseArgs(["--run", "--provider", "kind", "--config", "full-ai-cluster/dev-cluster/k3d-config.yaml"], {});
        expect("kind" in parsed).toBe(true);
        if (!("kind" in parsed))
            throw new Error("expected usage error");
        expect(parsed.message).toContain("kind provider requires a kind config");
    });
    test("rejects explicit full scope on kind instead of silently coercing it", () => {
        const parsed = parseArgs(["--run", "--provider", "kind", "--scope", "full"], {});
        expect("kind" in parsed).toBe(true);
        if (!("kind" in parsed))
            throw new Error("expected usage error");
        expect(parsed.message).toContain("kind provider supports smoke or included scope");
    });
    test("accepts included scope on kind for Synced+Healthy proof", () => {
        const parsed = parseArgs(["--run", "--provider", "kind", "--scope", "included"], {});
        expect("kind" in parsed).toBe(false);
        if ("kind" in parsed)
            throw new Error(parsed.message);
        expect(parsed.scope).toBe("included");
        expect(isIncludedScope(parsed.scope)).toBe(true);
    });
});
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test manifest parsing", () => {
    test("extracts the k3d cluster name from metadata", () => {
        expect(parseK3dClusterName("apiVersion: k3d.io/v1alpha5\nkind: Simple\nmetadata:\n  name: zeta-ci\n")).toBe("zeta-ci");
    });
    test("extracts ArgoCD Application metadata.name", () => {
        const yaml = [
            "apiVersion: argoproj.io/v1alpha1",
            "kind: Application",
            "metadata:",
            "  name: argocd",
            "  namespace: argocd",
            "spec:",
            "  project: default",
            "",
        ].join("\n");
        expect(parseApplicationName(yaml)).toBe("argocd");
    });
    test("discovers current dev Application graph and marks dev exclusions", () => {
        const applications = discoverExpectedApplications();
        expect(applications.length).toBeGreaterThan(20);
        expect(applications.some((app) => app.name === "argocd" && !app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "cilium" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "cilium-lb-ipam" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "longhorn" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "vault" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "agent-memory" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "gitlab" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "orleans" && app.excludedFromDev)).toBe(true);
        expect(applications.some((app) => app.dir === "temporal" && app.excludedFromDev)).toBe(true);
        const included = applications.filter((app) => !app.excludedFromDev);
        expect(included.length).toBeGreaterThan(10);
        expect(included.some((app) => app.name === "trust-manager")).toBe(true);
        expect(included.some((app) => app.name === "forgejo")).toBe(false);
    });
    test("isExcludedFromIncludedProof catches Longhorn in child manifests", () => {
        const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-longhorn-"));
        try {
            const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/demo");
            mkdirSync(appDir, { recursive: true });
            writeFileSync(join(appDir, "Application.yaml"), "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: demo\nspec: {}\n");
            writeFileSync(join(appDir, "statefulset.yaml"), "spec:\n  volumeClaimTemplates:\n    - spec:\n        storageClassName: longhorn\n");
            const appText = readFileSync(join(appDir, "Application.yaml"), "utf8");
            expect(isExcludedFromIncludedProof("demo", appText, appDir)).toBe(true);
        }
        finally {
            rmSync(repoRoot, { recursive: true, force: true });
        }
    });
    test("smoke scope accepts a broad graph with lightweight healthy anchors", () => {
        const verdicts = classifySmokeApplications([
            { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
            { name: "argocd", syncStatus: "Unknown", healthStatus: "Healthy", message: "" },
            { name: "cert-manager", syncStatus: "Synced", healthStatus: "Healthy", message: "" },
            ...Array.from({ length: 20 }, (_value, index) => ({
                name: `child-${String(index)}`,
                syncStatus: "OutOfSync",
                healthStatus: "Missing",
                message: "",
            })),
        ]);
        expect(verdicts.every((verdict) => verdict.ok)).toBe(true);
    });
    test("smoke scope tolerates cert-manager progressing while sync settles", () => {
        const verdicts = classifySmokeApplications([
            { name: "zeta-root-dev", syncStatus: "OutOfSync", healthStatus: "Healthy", message: "" },
            { name: "argocd", syncStatus: "Unknown", healthStatus: "Healthy", message: "" },
            { name: "cert-manager", syncStatus: "Unknown", healthStatus: "Progressing", message: "" },
            ...Array.from({ length: 20 }, (_value, index) => ({
                name: `child-${String(index)}`,
                syncStatus: "OutOfSync",
                healthStatus: "Missing",
                message: "",
            })),
        ]);
        expect(verdicts.every((verdict) => verdict.ok)).toBe(true);
    });
});
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test Application verdicts", () => {
    test("parses kubectl Application JSON into compact snapshots", () => {
        const snapshots = parseApplicationList(JSON.stringify({
            items: [
                {
                    metadata: { name: "argocd" },
                    status: {
                        sync: { status: "Synced", revision: "7.7.10" },
                        health: { status: "Healthy", message: "" },
                        operationState: { phase: "Succeeded" },
                    },
                },
            ],
        }));
        expect(snapshots).toEqual([
            {
                name: "argocd",
                syncStatus: "Synced",
                healthStatus: "Healthy",
                message: "",
                operationPhase: "Succeeded",
                syncRevision: "7.7.10",
            },
        ]);
    });
    test("isApplicationSynced accepts Unknown Helm apps that reconciled successfully", () => {
        expect(isApplicationSynced({
            name: "cert-manager",
            syncStatus: "Unknown",
            healthStatus: "Healthy",
            message: "",
            operationPhase: "Succeeded",
            syncRevision: "v1.16.2",
        })).toBe(true);
        expect(isApplicationSynced({
            name: "sealed-secrets",
            syncStatus: "Unknown",
            healthStatus: "Healthy",
            message: "",
        })).toBe(true);
        expect(isApplicationSynced({
            name: "hat-system",
            syncStatus: "OutOfSync",
            healthStatus: "Healthy",
            message: "",
            syncRevision: "abc123",
        })).toBe(true);
        expect(isApplicationSynced({
            name: "dapr",
            syncStatus: "OutOfSync",
            healthStatus: "Healthy",
            message: "",
            operationPhase: "Succeeded",
        })).toBe(true);
    });
    test("reports exact missing and unhealthy Applications", () => {
        const verdicts = classifyApplications([
            {
                dir: "argocd",
                name: "argocd",
                excludedFromDev: false,
                path: "full-ai-cluster/k8s/applications/argocd/Application.yaml",
            },
            {
                dir: "cilium",
                name: "cilium",
                excludedFromDev: true,
                path: "full-ai-cluster/k8s/applications/cilium/Application.yaml",
            },
            {
                dir: "vault",
                name: "vault",
                excludedFromDev: false,
                path: "full-ai-cluster/k8s/applications/vault/Application.yaml",
            },
        ], [
            {
                name: "argocd",
                syncStatus: "OutOfSync",
                healthStatus: "Healthy",
                message: "chart values drift",
            },
        ]);
        expect(verdicts).toEqual([
            {
                name: "argocd",
                ok: false,
                syncStatus: "OutOfSync",
                healthStatus: "Healthy",
                reason: "chart values drift",
            },
            {
                name: "vault",
                ok: false,
                syncStatus: "Missing",
                healthStatus: "Missing",
                reason: "Application not found; expected from full-ai-cluster/k8s/applications/vault/Application.yaml",
            },
        ]);
    });
});
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test planning", () => {
    test("builds the 081KSXN940008QG0R000SCP2H1 plan without touching Docker or Kubernetes", () => {
        const parsed = parseArgs(["--dry-run"], {});
        if ("kind" in parsed)
            throw new Error(parsed.message);
        const plan = buildPlan(parsed);
        if ("kind" in plan)
            throw new Error(plan.message);
        expect(plan.rowId).toBe("081KSXN940008QG0R000SCP2H1");
        expect(plan.scope).toBe("full");
        expect(plan.clusterName).toBe("zeta-dev");
        expect(plan.expectedApplications.some((app) => app.name === "argocd")).toBe(true);
        expect(plan.expectedApplications.filter((app) => !app.excludedFromDev).length).toBeGreaterThan(10);
        expect(plan.notes.join("\n")).toContain("separate from 081KSNY2Z0008QG0R0008PN7RQ");
    });
    test("included dry-run lists proof targets on kind", () => {
        const parsed = parseArgs(["--dry-run", "--provider", "kind", "--scope", "included"], {});
        if ("kind" in parsed)
            throw new Error(parsed.message);
        const plan = buildPlan(parsed);
        if ("kind" in plan)
            throw new Error(plan.message);
        expect(plan.scope).toBe("included");
        expect(plan.checks.join("\n")).toContain("Synced and Healthy");
        const included = plan.expectedApplications.filter((app) => !app.excludedFromDev).map((app) => app.name);
        expect(included).not.toContain("gitlab");
        expect(included).not.toContain("forgejo");
        expect(included).not.toContain("agent-memory");
        expect(included).not.toContain("spire");
    });
    test("detects repo-backed child Applications that should track the harness git ref", () => {
        expect(isZetaGitDirectoryApplicationSource({
            repoURL: "https://github.com/Lucent-Financial-Group/Zeta",
            targetRevision: "main",
            path: "full-ai-cluster/k8s/applications/hat-system",
        })).toBe(true);
        expect(isZetaGitDirectoryApplicationSource({
            repoURL: "https://grafana.github.io/helm-charts",
            chart: "loki",
            targetRevision: "6.18.0",
        })).toBe(false);
    });
    test("architecture guard names the supported hardware classes", () => {
        expect(architectureFailure("x64")).toBeNull();
        expect(architectureFailure("arm64")).toBeNull();
        expect(architectureFailure("s390x")?.message).toContain("x86_64 and ARM64/aarch64");
    });
    test("turns invalid Application manifests into structured failures", () => {
        const repoRoot = mkdtempSync(join(tmpdir(), "zeta-argocd-health-"));
        try {
            const appDir = join(repoRoot, "full-ai-cluster/k8s/applications/broken");
            mkdirSync(appDir, { recursive: true });
            writeFileSync(join(appDir, "Application.yaml"), "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\nspec: {}\n");
            const parsed = parseArgs(["--dry-run", "--provider", "kind"], {});
            if ("kind" in parsed)
                throw new Error(parsed.message);
            const plan = buildPlan(parsed, repoRoot);
            expect("kind" in plan).toBe(true);
            if (!("kind" in plan))
                throw new Error("expected structured failure");
            expect(plan.kind).toBe("ApplicationManifestInvalid");
            expect(plan.message).toContain("failed to discover expected ArgoCD Applications");
        }
        finally {
            rmSync(repoRoot, { recursive: true, force: true });
        }
    });
});
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test preflight failures", () => {
    test("classifies a present but down container runtime separately from missing tools", () => {
        const failure = preflightFailure([
            {
                tool: "docker",
                ok: false,
                detail: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
            },
        ]);
        expect(failure?.kind).toBe("ContainerRuntimeUnavailable");
    });
});
describe("081KSXN940008QG0R000SCP2H1 argocd-health-test live failure shaping", () => {
    test("returns a structured failure when kubectl emits malformed Application list JSON", async () => {
        await withFakeClusterCli("invalid-list-json", async () => {
            const parsed = parseArgs(["--run", "--provider", "kind", "--existing", "--timeout-sec", "1", "--poll-sec", "1"], {});
            if ("kind" in parsed)
                throw new Error(parsed.message);
            const result = await runHarness(parsed);
            expect(result.ok).toBe(false);
            if (result.ok)
                throw new Error("expected malformed JSON to fail the harness");
            expect(result.failure.kind).toBe("KubectlFailed");
            expect(result.failure.message).toContain("could not parse ArgoCD Application list JSON");
        });
    });
    test("does not treat drift-check kubectl read failures as repaired drift", async () => {
        await withFakeClusterCli("drift-read-fails", async () => {
            const parsed = parseArgs(["--run", "--provider", "kind", "--existing", "--drift-check", "--timeout-sec", "1", "--poll-sec", "1"], {});
            if ("kind" in parsed)
                throw new Error(parsed.message);
            const result = await runHarness(parsed);
            expect(result.ok).toBe(false);
            if (result.ok)
                throw new Error("expected kubectl drift read failure to fail the harness");
            expect(result.failure.kind).toBe("KubectlFailed");
            expect(result.failure.message).toContain("could not read ArgoCD Application drift state");
            expect(result.driftRepair).toBe("failed");
        });
    });
});
