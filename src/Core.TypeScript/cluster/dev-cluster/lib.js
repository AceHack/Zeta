#!/usr/bin/env bun
// Pure validation, config parsing, and substrate paths for dev-cluster CLIs.
// No process spawn — external deps flow through cluster/ports.ts adapters only.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
export const REPO_ROOT = resolve(import.meta.dir, "../../../..");
export const DEV_CLUSTER_SUBSTRATE_DIR = join(REPO_ROOT, "full-ai-cluster/dev-cluster");
const GITHUB_REPO_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?$/;
export function fail(message) {
    console.error(message);
    process.exit(1);
}
export function isDnsLabel(value) {
    return /^[a-z\d]([-a-z\d]*[a-z\d])?$/.test(value);
}
export function isSafeGitRef(value) {
    return (/^[A-Za-z\d._/-]+$/.test(value) &&
        value.length > 0 &&
        !value.startsWith("/") &&
        !value.endsWith("/") &&
        !value.includes("//"));
}
export function isGitHubRepoUrl(value) {
    return GITHUB_REPO_URL.test(value);
}
export function assertSafeGitRef(gitRef) {
    if (!isSafeGitRef(gitRef)) {
        fail(`ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${gitRef}')`);
    }
}
export function assertGitHubRepoUrl(gitRepoUrl) {
    if (!isGitHubRepoUrl(gitRepoUrl)) {
        fail(`ERROR: git repo URL must be an https://github.com/<owner>/<repo> URL (got: '${gitRepoUrl}')`);
    }
}
export function assertDnsLabel(name, label) {
    if (!isDnsLabel(name)) {
        fail(`ERROR: ${label} must be a DNS label (got: '${name}')`);
    }
}
export function assertFileExists(path, label) {
    if (!existsSync(path)) {
        fail(`ERROR: ${label} not found: ${path}`);
    }
}
export function parseK3dClusterName(configPath) {
    const text = readFileSync(configPath, "utf8");
    let inMetadata = false;
    for (const line of text.split("\n")) {
        if (/^metadata:\s*$/.test(line)) {
            inMetadata = true;
            continue;
        }
        if (inMetadata && /^[^\s]/.test(line))
            break;
        if (inMetadata) {
            const match = line.match(/^\s+name:\s*(\S+)/);
            if (match)
                return match[1];
        }
    }
    fail(`ERROR: k3d config metadata.name not found: ${configPath}`);
}
export function parseK3dAgentCount(configPath) {
    const text = readFileSync(configPath, "utf8");
    for (const line of text.split("\n")) {
        const match = line.match(/^\s*agents:\s*(\d+)\s*$/);
        if (match)
            return Number(match[1]);
    }
    return 0;
}
export function readFlagValue(argv, index, flag) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("-")) {
        console.error(`usage: ${flag} requires a value`);
        process.exit(1);
    }
    return value;
}
export const DEFAULT_GIT_REPO_URL = process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta";
