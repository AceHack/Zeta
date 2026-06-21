#!/usr/bin/env bun
// full-ai-cluster/tools/cluster-inventory/capture.ts
//
// Capture precise hardware inventory for cluster nodes into
// `full-ai-cluster/docs/cluster-hardware/<hostname>/`.
//
// Requires:
//   - kubectl configured against the cluster
//   - hwloc installed locally for optional SVG rendering
//   - NFD already running on the cluster
//   - either `kubectl debug node/<name>` support or SSH access as zeta
//
// Usage:
//   bun full-ai-cluster/tools/cluster-inventory/capture.ts
//   bun full-ai-cluster/tools/cluster-inventory/capture.ts worker-gpu-01 worker-gpu-02
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const NFD_LABEL_PREFIX = "feature.node.kubernetes.io/";
const SAFE_NODE_NAME = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
function runCommand(command, args, allowFailure = false) {
    const result = spawnSync(command, [...args], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.error !== undefined) {
        if (allowFailure) {
            return { status: 127, stdout: "", stderr: result.error.message };
        }
        throw new Error(`failed to start ${command}: ${result.error.message}`);
    }
    const status = result.status ?? 1;
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    if (status !== 0 && !allowFailure) {
        const message = stderr.trim() !== "" ? stderr.trim() : `${command} exited ${String(status)}`;
        throw new Error(message);
    }
    return { status, stdout, stderr };
}
function repoRootFromGit() {
    return runCommand("git", ["rev-parse", "--show-toplevel"]).stdout.trim();
}
export function parseNodeNames(raw) {
    return raw
        .split(/\s+/)
        .map((node) => node.trim())
        .filter((node) => node.length > 0);
}
export function isSafeNodeName(node) {
    return SAFE_NODE_NAME.test(node);
}
function assertSafeNodeName(node) {
    if (!isSafeNodeName(node)) {
        throw new Error(`unsafe node name: ${node}`);
    }
}
function allClusterNodes() {
    const output = runCommand("kubectl", ["get", "nodes", "-o", "jsonpath={.items[*].metadata.name}"]).stdout;
    return parseNodeNames(output);
}
export function nfdLabelLines(labels) {
    return Object.entries(labels)
        .filter(([key]) => key.startsWith(NFD_LABEL_PREFIX))
        .map(([key, value]) => `${key}=${String(value)}`)
        .sort((a, b) => a.localeCompare(b));
}
function nodeLabels(node) {
    const output = runCommand("kubectl", ["get", "node", node, "-o", "json"], true);
    if (output.status !== 0) {
        process.stderr.write(`  warning: failed to read NFD labels for ${node}; writing empty label set\n`);
        return {};
    }
    const parsed = JSON.parse(output.stdout);
    return parsed.metadata?.labels ?? {};
}
function firstLinesMatching(lines, pattern) {
    return lines.filter((line) => pattern.test(line)).slice(0, 10);
}
export function renderSummary(node, labels, capturedAt) {
    const sections = [
        ["CPU", /cpu-model\.|cpu-cpuid\./],
        ["Memory + Storage", /memory-|storage-/],
        ["PCI vendors present (top 10)", /pci-/],
        ["Network", /network-/],
    ];
    const output = [`# ${node}`, "", `Captured: ${capturedAt}`, ""];
    for (const [title, pattern] of sections) {
        output.push(`## ${title}`);
        output.push(...firstLinesMatching(labels, pattern));
        output.push("");
    }
    output.push("See `topology.svg` for NUMA / PCI / cache hierarchy.");
    return `${output.join("\n")}\n`;
}
function supportsKubectlDebug() {
    return runCommand("kubectl", ["debug", "--help"], true).status === 0;
}
function captureTopologyXml(node, outDir, useKubectlDebug) {
    let xml;
    if (useKubectlDebug) {
        const debug = runCommand("kubectl", [
            "debug",
            `node/${node}`,
            "--image=ghcr.io/open-mpi/hwloc:latest",
            "--quiet",
            "--",
            "chroot",
            "/host",
            "lstopo",
            "--of",
            "xml",
        ], true);
        if (debug.status === 0) {
            xml = debug.stdout;
        }
        else {
            process.stderr.write("  kubectl debug failed; trying ssh fallback\n");
            xml = runCommand("ssh", [
                "-o",
                "StrictHostKeyChecking=no",
                "-o",
                "BatchMode=yes",
                `zeta@${node}`,
                "lstopo --of xml",
            ]).stdout;
        }
    }
    else {
        xml = runCommand("ssh", [
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "BatchMode=yes",
            `zeta@${node}`,
            "lstopo --of xml",
        ]).stdout;
    }
    writeFileSync(join(outDir, "topology.xml"), xml);
}
function renderTopologySvg(outDir) {
    if (runCommand("lstopo", ["--version"], true).status !== 0)
        return;
    const svg = runCommand("lstopo", ["--input", join(outDir, "topology.xml"), "--of", "svg"], true);
    if (svg.status === 0) {
        writeFileSync(join(outDir, "topology.svg"), svg.stdout);
    }
}
function usage() {
    return [
        "Usage:",
        "  bun full-ai-cluster/tools/cluster-inventory/capture.ts",
        "  bun full-ai-cluster/tools/cluster-inventory/capture.ts worker-gpu-01 worker-gpu-02",
    ].join("\n");
}
export function main(argv = process.argv.slice(2)) {
    if (argv.includes("-h") || argv.includes("--help")) {
        process.stdout.write(`${usage()}\n`);
        return 0;
    }
    try {
        const repoRoot = repoRootFromGit();
        const inventoryRoot = join(repoRoot, "full-ai-cluster", "docs", "cluster-hardware");
        mkdirSync(inventoryRoot, { recursive: true });
        const nodes = argv.length > 0 ? argv : allClusterNodes();
        const useKubectlDebug = supportsKubectlDebug();
        for (const node of nodes) {
            assertSafeNodeName(node);
            process.stdout.write(`=== ${node} ===\n`);
            const outDir = join(inventoryRoot, node);
            mkdirSync(outDir, { recursive: true });
            const labels = nfdLabelLines(nodeLabels(node));
            writeFileSync(join(outDir, "nfd-labels.txt"), `${labels.join("\n")}${labels.length > 0 ? "\n" : ""}`);
            captureTopologyXml(node, outDir, useKubectlDebug);
            renderTopologySvg(outDir);
            writeFileSync(join(outDir, "summary.md"), renderSummary(node, labels, new Date().toISOString().replace(/\.\d{3}Z$/, "Z")));
            process.stdout.write(`  -> ${outDir}/\n`);
        }
        process.stdout.write("\nDone. Review + commit:\n" +
            "  git diff --stat full-ai-cluster/docs/cluster-hardware/\n" +
            "  git add full-ai-cluster/docs/cluster-hardware/\n" +
            "  git commit -m 'chore(inventory): capture cluster hardware <date>'\n");
        return 0;
    }
    catch (err) {
        process.stderr.write(`cluster-inventory: ${err.message}\n`);
        return 2;
    }
}
if (import.meta.main) {
    process.exit(main());
}
