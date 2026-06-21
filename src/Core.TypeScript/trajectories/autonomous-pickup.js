#!/usr/bin/env bun
// autonomous-pickup.ts -- Tier 1 trajectory packet picker.
//
// Trajectory packets are lane-state substrate, not direct coding prompts.
// This tool keeps that boundary explicit: broad trajectory surfaces produce
// child-packet creation or decomposition prompts before implementation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const GIT_BIN = "/usr/bin/git";
function usage() {
    return [
        "Usage:",
        "  bun tools/trajectories/autonomous-pickup.ts [--json] [--repo-root DIR]",
        "    [--active-claim TEXT] [--no-git-claims]",
        "",
        "Selects the next bounded trajectory packet action.",
    ].join("\n");
}
function parseArgs(argv) {
    const args = {
        repoRoot: process.cwd(),
        json: false,
        activeClaim: [],
        noGitClaims: false,
    };
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === undefined) {
            continue;
        }
        if (arg === "--json") {
            args.json = true;
        }
        else if (arg === "--repo-root") {
            args.repoRoot = requireValue(arg, argv[++index]);
        }
        else if (arg === "--active-claim") {
            args.activeClaim.push(requireValue(arg, argv[++index]));
        }
        else if (arg === "--no-git-claims") {
            args.noGitClaims = true;
        }
        else if (arg === "--help" || arg === "-h") {
            process.stdout.write(`${usage()}\n`);
            process.exit(0);
        }
        else {
            throw new Error(`unknown arg: ${arg}`);
        }
    }
    args.repoRoot = resolve(args.repoRoot);
    return args;
}
function requireValue(flag, value) {
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
    }
    return value;
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function stripMarkdown(value) {
    let trimmed = value.replaceAll("**", "").replaceAll("`", "").trim();
    while (trimmed.endsWith(".")) {
        trimmed = trimmed.slice(0, -1).trim();
    }
    return trimmed;
}
function isPlaceholderAction(value) {
    if (value === null) {
        return true;
    }
    const normalized = stripMarkdown(value).toLowerCase();
    return (normalized === "" ||
        normalized === "none" ||
        normalized === "none currently selected" ||
        normalized === "no current action" ||
        normalized === "not currently selected" ||
        normalized === "n/a" ||
        normalized === "na" ||
        normalized === "tbd");
}
function actionableText(value) {
    if (value === null) {
        return null;
    }
    const stripped = stripMarkdown(value);
    return isPlaceholderAction(stripped) ? null : stripped;
}
function firstHeading(lines, fallback) {
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("# ")) {
            return stripMarkdown(trimmed.slice(2));
        }
    }
    return fallback;
}
function fieldValue(line, label) {
    const stripped = line.trim().replaceAll("**", "");
    const prefix = `${label}:`;
    if (!stripped.toLowerCase().startsWith(prefix.toLowerCase())) {
        return null;
    }
    return stripMarkdown(stripped.slice(prefix.length));
}
function isFieldLikeLine(line) {
    const stripped = line.trim().replaceAll("**", "");
    const colonIndex = stripped.indexOf(":");
    if (colonIndex <= 0 || colonIndex > 80) {
        return false;
    }
    const label = stripped.slice(0, colonIndex).trim();
    return /^[A-Za-z][A-Za-z0-9 /_-]*$/.test(label);
}
function fieldWithContinuations(lines, index, label) {
    const value = fieldValue(lines[index] ?? "", label);
    if (value === null) {
        return null;
    }
    const parts = [value];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex++) {
        const trimmed = lines[nextIndex]?.trim() ?? "";
        if (trimmed === "" ||
            trimmed.startsWith("#") ||
            trimmed.startsWith("- ") ||
            trimmed.startsWith("|") ||
            isFieldLikeLine(trimmed)) {
            break;
        }
        parts.push(stripMarkdown(trimmed));
    }
    return stripMarkdown(parts.join(" "));
}
function firstField(lines, labels) {
    for (let index = 0; index < lines.length; index++) {
        for (const label of labels) {
            const value = fieldWithContinuations(lines, index, label);
            if (value !== null && value.length > 0) {
                return value;
            }
        }
    }
    return null;
}
function sectionLines(lines, heading) {
    const wanted = heading.toLowerCase();
    const out = [];
    let inside = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("## ")) {
            if (inside) {
                break;
            }
            inside = stripMarkdown(trimmed.slice(3)).toLowerCase() === wanted;
            continue;
        }
        if (inside) {
            out.push(line);
        }
    }
    return out;
}
function bulletsFromSection(lines, heading) {
    return sectionLines(lines, heading)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => stripMarkdown(line.slice(2)))
        .filter((line) => !isPlaceholderAction(line));
}
function paragraphFromSection(lines, heading) {
    const paragraph = sectionLines(lines, heading)
        .map((line) => stripMarkdown(line))
        .filter(Boolean)
        .find((line) => !line.startsWith("|") && !line.startsWith("---"));
    return paragraph ?? null;
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
function backlogRefs(content) {
    const refs = [];
    const tokens = content.split(/[^A-Za-z0-9-]+/);
    for (const token of tokens) {
        if (token.length === 6 && token.startsWith("B-")) {
            const rawNumber = token.slice(2);
            let onlyDigits = true;
            for (const char of rawNumber) {
                if (char < "0" || char > "9") {
                    onlyDigits = false;
                    break;
                }
            }
            if (onlyDigits) {
                refs.push(token);
            }
        }
    }
    return uniqueSorted(refs);
}
function backlogRowPath(repoRoot, ref) {
    const backlogDir = join(repoRoot, "docs", "backlog");
    if (!isDirectory(backlogDir)) {
        return null;
    }
    for (const priority of readdirSync(backlogDir, { withFileTypes: true })) {
        if (!priority.isDirectory()) {
            continue;
        }
        const priorityDir = join(backlogDir, priority.name);
        for (const entry of readdirSync(priorityDir, { withFileTypes: true })) {
            const isBacklogRow = entry.isFile() &&
                entry.name.endsWith(".md") &&
                (entry.name === `${ref}.md` || entry.name.startsWith(`${ref}-`));
            if (isBacklogRow) {
                return join(priorityDir, entry.name);
            }
        }
    }
    return null;
}
function frontmatterStatus(content) {
    const lines = content.split(/\r?\n/);
    if ((lines[0] ?? "").trim() !== "---") {
        return null;
    }
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index]?.trim() ?? "";
        if (line === "---") {
            return null;
        }
        const match = /^status:\s*["']?([^"']+)["']?\s*$/i.exec(line);
        if (match !== null) {
            return stripMarkdown(match[1] ?? "");
        }
    }
    return null;
}
function isClosedBacklogRef(repoRoot, ref) {
    const rowPath = backlogRowPath(repoRoot, ref);
    if (rowPath === null) {
        return false;
    }
    try {
        const status = frontmatterStatus(readFileSync(rowPath, "utf8"));
        const normalized = status?.toLowerCase();
        return normalized === "closed" || normalized?.startsWith("superseded-by-") === true;
    }
    catch {
        return false;
    }
}
function refsAreResolved(refs, closedRefs) {
    return refs.length > 0 && refs.every((ref) => closedRefs.has(ref));
}
function textRefsAreResolved(value, closedRefs) {
    return refsAreResolved(backlogRefs(value), closedRefs);
}
function firstSelectableChildCandidate(packet) {
    const closedRefs = new Set(packet.closedActionBacklogRefs);
    return packet.childCandidates.find((candidate) => !isPlaceholderAction(candidate) && !textRefsAreResolved(candidate, closedRefs));
}
function trajectoryNumber(slug) {
    if (slug === "factory-trajectory-surface") {
        return 0;
    }
    if (slug === "typescript-bun-migration") {
        return 10;
    }
    return 100;
}
function readPacket(repoRoot, slug) {
    const absolutePath = join(repoRoot, "docs", "trajectories", slug, "RESUME.md");
    try {
        const content = readFileSync(absolutePath, "utf8");
        const lines = content.split(/\r?\n/);
        const childCandidates = bulletsFromSection(lines, "Next Child Packets");
        const explicitNextAction = actionableText(firstField(lines, ["Next concrete action", "Recommended next action"])) ??
            actionableText(paragraphFromSection(lines, "Recommended next action"));
        const actionBacklogRefs = backlogRefs([explicitNextAction ?? "", ...childCandidates].join("\n"));
        const closedActionBacklogRefs = actionBacklogRefs.filter((ref) => isClosedBacklogRef(repoRoot, ref));
        const closedRefs = new Set(closedActionBacklogRefs);
        const nextAction = explicitNextAction ??
            childCandidates.find((candidate) => !isPlaceholderAction(candidate) && !textRefsAreResolved(candidate, closedRefs)) ??
            (childCandidates.length > 0 ? (childCandidates[0] ?? null) : null);
        return {
            slug,
            title: firstHeading(lines, slug),
            relativePath: relative(repoRoot, absolutePath).split("\\").join("/"),
            status: firstField(lines, ["Status"]),
            blocker: firstField(lines, ["Current blocker", "Active blocker", "Blocker"]),
            nextAction,
            childCandidates,
            backlogRefs: backlogRefs(content),
            actionBacklogRefs,
            closedActionBacklogRefs,
            bodyLineCount: lines.length,
        };
    }
    catch {
        return null;
    }
}
export function readTrajectoryPackets(repoRoot) {
    const trajectoryDir = join(repoRoot, "docs", "trajectories");
    if (!isDirectory(trajectoryDir)) {
        return [];
    }
    const packets = [];
    for (const entry of readdirSync(trajectoryDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }
        const packet = readPacket(repoRoot, entry.name);
        if (packet !== null) {
            packets.push(packet);
        }
    }
    return packets.sort((a, b) => {
        const rankDelta = trajectoryNumber(a.slug) - trajectoryNumber(b.slug);
        return rankDelta === 0 ? a.slug.localeCompare(b.slug) : rankDelta;
    });
}
function blockerReason(packet) {
    if (packet.blocker !== null && packet.blocker.toLowerCase() !== "none") {
        return `active blocker: ${packet.blocker}`;
    }
    const normalizedStatus = packet.status?.toLowerCase() ?? "";
    if (normalizedStatus.includes("closed-maintained") || normalizedStatus.includes("closed maintained")) {
        return `closed-maintained trajectory: ${packet.status}`;
    }
    if (packet.nextAction === null || isPlaceholderAction(packet.nextAction)) {
        return "no next action found";
    }
    return null;
}
function claimMatchesPacket(claim, packet) {
    const normalized = claim.toLowerCase();
    return normalized.includes(packet.slug.toLowerCase());
}
function claimBlocker(packet, activeClaims) {
    const claim = activeClaims.find((candidate) => claimMatchesPacket(candidate, packet));
    return claim ? `active claim ${claim}` : null;
}
function closedActionBacklogBlocker(packet) {
    const selectedActionRefs = backlogRefs([packet.nextAction ?? "", firstSelectableChildCandidate(packet) ?? ""].join("\n"));
    if (selectedActionRefs.length === 0) {
        return null;
    }
    const closedRefs = new Set(packet.closedActionBacklogRefs);
    const allActionRefsClosed = refsAreResolved(selectedActionRefs, closedRefs);
    return allActionRefsClosed ? `action backlog refs already closed: ${selectedActionRefs.join(", ")}` : null;
}
function actionFor(packet) {
    const next = packet.nextAction?.toLowerCase() ?? "";
    if (firstSelectableChildCandidate(packet) !== undefined) {
        return "create-child-packet";
    }
    if (next.includes("possible follow-ups") ||
        next.includes("candidate") ||
        next.includes("maintainer decision") ||
        next.includes("(a)") ||
        next.includes(";")) {
        return "decompose";
    }
    return "claim-and-implement";
}
function promptFor(packet, action) {
    let lead = `Claim and implement the next concrete trajectory action for ${packet.slug}.`;
    if (action === "create-child-packet") {
        lead = `Create exactly one child trajectory packet for ${packet.slug}.`;
    }
    else if (action === "decompose") {
        lead = `Decompose ${packet.slug} into one atomic, claimable next trajectory action.`;
    }
    const firstChild = firstSelectableChildCandidate(packet);
    const childLine = firstChild === undefined ? [] : [`First child candidate: ${firstChild}`, ""];
    return [
        lead,
        "",
        `Trajectory: ${packet.title}`,
        `Trajectory path: ${packet.relativePath}`,
        `Current status: ${packet.status ?? "unknown"}`,
        `Next action text: ${packet.nextAction ?? "unknown"}`,
        ...childLine,
        "Rules:",
        "- Trajectory is number one: preserve lane memory while enhancing as you go.",
        "- Use a dedicated worktree and pushed claim branch before write work.",
        "- Do not touch the contested root checkout.",
        "- Take exactly one bounded step and open a PR.",
        "- Fix bounded breakage directly; decompose broad work into backlog rows and trajectory child packets before implementation.",
        "- Link any backlog rows or evidence artifacts the trajectory names.",
    ].join("\n");
}
export function selectNextTrajectory(packets, activeClaims) {
    const blocked = [];
    for (const packet of packets) {
        const blockedByState = blockerReason(packet);
        if (blockedByState !== null) {
            blocked.push({ packet, reason: blockedByState });
            continue;
        }
        const blockedByClaim = claimBlocker(packet, activeClaims);
        if (blockedByClaim !== null) {
            blocked.push({ packet, reason: blockedByClaim });
            continue;
        }
        const blockedByClosedBacklog = closedActionBacklogBlocker(packet);
        if (blockedByClosedBacklog !== null) {
            blocked.push({ packet, reason: blockedByClosedBacklog });
            continue;
        }
        const action = actionFor(packet);
        return {
            status: "selected",
            selected: packet,
            action,
            reason: "highest-ranked unblocked trajectory packet with next-action evidence",
            blocked,
            activeClaims: [...activeClaims],
            executionPrompt: promptFor(packet, action),
        };
    }
    return {
        status: "empty",
        selected: null,
        action: null,
        reason: "no unblocked trajectory packets with next-action evidence",
        blocked,
        activeClaims: [...activeClaims],
        executionPrompt: null,
    };
}
function runGit(repoRoot, args) {
    const result = spawnSync(GIT_BIN, ["-C", repoRoot, ...args], {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status !== 0) {
        return [];
    }
    return result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}
function readActiveClaims(repoRoot) {
    const remoteClaims = runGit(repoRoot, ["branch", "-r", "--list", "origin/claim/*"]).map((line) => line.replace(/^origin\//, ""));
    const localClaimsDir = join(repoRoot, "docs", "claims");
    const localClaims = isDirectory(localClaimsDir)
        ? readdirSync(localClaimsDir)
            .filter((name) => name.endsWith(".md") && name !== "README.md")
            .map((name) => `docs/claims/${basename(name, ".md")}`)
        : [];
    return uniqueSorted([...remoteClaims, ...localClaims]);
}
function printText(selection) {
    if (selection.status === "empty") {
        process.stdout.write(`no-pick: ${selection.reason}\n`);
        return;
    }
    if (selection.selected === null || selection.action === null) {
        process.stdout.write("no-pick: malformed selection\n");
        return;
    }
    process.stdout.write(`${selection.action}: ${selection.selected.slug}\n`);
    process.stdout.write(`${selection.selected.relativePath}\n`);
    process.stdout.write(`${selection.reason}\n`);
}
export function main(argv) {
    let args;
    try {
        args = parseArgs(argv);
    }
    catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
        return 1;
    }
    const packets = readTrajectoryPackets(args.repoRoot);
    const gitClaims = args.noGitClaims ? [] : readActiveClaims(args.repoRoot);
    const activeClaims = uniqueSorted([...gitClaims, ...args.activeClaim]);
    const selection = selectNextTrajectory(packets, activeClaims);
    if (args.json) {
        process.stdout.write(`${JSON.stringify(selection, null, 2)}\n`);
    }
    else {
        printText(selection);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
