/**
 * src/Core.TypeScript/observe/event-sink-folder.ts — the real EventSink: folder-direct-to-main.
 *
 * The sovereign transport for `execute` (per the observe-act + DB-design + keystone
 * ADRs). Where `execute.ts` defines the `EventSink` port (append a chosen action to
 * the durable log), THIS is the production adapter: it writes the event as a
 * ZetaId-named JSON file into a git folder and commits it **direct to `main`,
 * no-PR** (081KSNY2Z0008QG0R000E5KTPX folders-on-main; same mechanism as the agent-bus G-Set,
 * 081KSXN940008QG0R00171YAZW). Corporate batch-to-main (081KSNY2Z0008QG0R0017JSTGD) is the same event shape behind a
 * different commit fn — swap `commit`, not the envelope.
 *
 * ── Fact, not command (per the design review) ────────────────────────────────
 * Replay must fold FACTS, not redo COMMANDS. So the durable record is an
 * `EventEnvelope` — `{ id, at, by, action }` — a fact ("at t, actor X recorded
 * this action"), carrying a **stable ZetaId identity** (design-review caution #2) so the
 * log is idempotent (the filename IS the id; re-appending the same id is a
 * no-op — the G-Set CRDT property). The richer executed-event envelope
 * (ActionExecutionStarted/Succeeded/Failed/ModeChanged) is the next refinement;
 * this slice logs the chosen action as the fact, with identity + actor + time.
 *
 * ── Conflict discipline (design-review cautions #5/#6) ───────────────────────
 * Direct-to-main is safe here for the same reason the bus is: events are
 * **disjoint ZetaId files** — two agents appending never touch the same path, so
 * a concurrent peer advancing `main` only causes a non-fast-forward push, which
 * `git pull --rebase` + retry resolves cleanly (G-Set merge = set union). The
 * on-main guard + ahead-check (mirrored from the bus) prevent shoving unrelated
 * local commits to main.
 *
 * ── Never throws (Result discipline) ─────────────────────────────────────────
 * Every failure (not-on-main, local-ahead, write error, push failure) becomes an
 * `AppendOutcome { ok: false; reason }` — the sink AUTHORS its outcome channel
 * (asymmetric-authorship); the caller (`execute`) surfaces it as feedback.
 *
 * I/O is injectable (`mint` / `now` / `commit`) so the whole adapter is testable
 * with no real git and a temp dir.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/execute.ts (the EventSink port this implements)
 *   - src/Core.TypeScript/observe/observe.ts (NextAction — the action recorded)
 *   - tools/agent-bus/publish.ts (the proven atomic-write + git-direct-to-main pattern this mirrors)
 *   - src/Core.TypeScript/zeta-id (the ZetaId codec — Category.WorkItem ids)
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
 *   - docs/backlog/P1/081KSNY2Z0008QG0R000E5KTPX-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md
 *   - docs/backlog/P2/081KSXN940008QG0R000R76H45-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md (the read side: indexes over this log)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pack, DEFAULT_ENV } from "../zeta-id/zeta-id";
import { Category, IdVersion, Chromosome, Firefly, Persona, LocationHint, } from "../zeta-id/types";
/**
 * Mint a WorkItem-category ZetaId as 32-hex — the observe-event identity.
 * `DEFAULT_ENV` (crypto randomness) makes each call unique; pass a deterministic
 * env in tests for reproducible ids. Mirrors the bus minter but tags the id
 * `Category.WorkItem` (planning/workflow), not `Category.Bus`.
 */
export function mintObserveEventIdHex(env = DEFAULT_ENV, atMs = Date.now()) {
    const obs = {
        version: IdVersion.V1,
        timestamp: atMs,
        chromosome: Chromosome.MetaCoherence,
        category: Category.WorkItem,
        firefly: Firefly.NoDirective,
        authority: { type: "TrustedAgent" },
        persona: Persona.FireflyCoherence,
        momentum: { type: "Normal" },
        location: LocationHint.EastUS_VA1,
    };
    return pack(obs, env).toString(16).padStart(32, "0");
}
/** A canonical observe-event id is 32 lowercase hex chars (mintObserveEventIdHex output). */
export function isCanonicalEventId(id) {
    return /^[0-9a-f]{32}$/.test(id);
}
/**
 * Write the envelope as an atomic, ZetaId-named file. `flag: "wx"` fails if the
 * file exists — but for a G-Set the same id means the same event already landed,
 * so EEXIST is idempotent SUCCESS, not an error.
 */
// `created` distinguishes a file WE wrote this append (safe to clean up on failure) from a
// pre-existing durable event found via EEXIST-replay (must NEVER be deleted — that would drop a
// landed G-Set event, Copilot #6312 P0).
function writeEventFile(envelope, eventDir) {
    const path = join(eventDir, `${envelope.id}.json`);
    try {
        mkdirSync(eventDir, { recursive: true });
        writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`, { flag: "wx" });
        return { ok: true, path, created: true }; // WE created it → ours to clean up on failure
    }
    catch (err) {
        const e = err;
        if (e.code === "EEXIST") {
            // Same id already on disk. Idempotent SUCCESS only if the content matches
            // (the true G-Set property). A reused id with a different action/by/at is a
            // real collision — surface it, never silently accept stale (Codex #6312 P2).
            try {
                const existing = readFileSync(path, "utf-8");
                if (existing === `${JSON.stringify(envelope, null, 2)}\n`)
                    return { ok: true, path, created: false }; // pre-existing → do NOT delete
                return { ok: false, reason: `id collision: ${envelope.id} already exists with different content` };
            }
            catch (readErr) {
                return { ok: false, reason: `EEXIST but re-read failed: ${readErr.message}` };
            }
        }
        return { ok: false, reason: `write failed: ${e.message}` };
    }
}
/**
 * Harness-specific `Co-Authored-By` trailer derived from the acting agent id.
 * The sink is SHARED — Vera/Riven/Alexa/Lior all use it — and the repo requires
 * per-surface trailers (agent-roster-reference-card), so a hardcoded Claude
 * trailer mis-attributes every non-Otto surface's events (Codex #6312 P2).
 * Mirrors the agent-bus `coauthorFor` map; falls back to naming the sender.
 */
export function coauthorFor(by) {
    const id = by.toLowerCase();
    // Match the EXACT surface id or a hyphen-delimited variant (otto, otto-cli, otto-desktop) —
    // NOT a bare prefix, so "ottobot" / "liorx" fall back to the sender trailer instead of being
    // mis-stamped (Codex #6312: mirror the agent-bus exact-or-hyphen matching, not startsWith).
    const TRAILERS = [
        ["otto", "Co-Authored-By: Claude <noreply@anthropic.com>"],
        ["alexa", "Co-Authored-By: Kiro <noreply@kiro.dev>"],
        ["riven", "Co-Authored-By: Grok <noreply@x.ai>"],
        ["vera", "Co-Authored-By: Codex <noreply@openai.com>"],
        ["lior", "Co-Authored-By: Gemini <noreply@google.com>"],
    ];
    for (const [surface, trailer] of TRAILERS) {
        if (id === surface || id.startsWith(`${surface}-`))
            return trailer;
    }
    return `Co-Authored-By: ${by} <noreply@zeta.local>`;
}
/**
 * Push HEAD:main with rebase-retry. A concurrent peer advancing main rejects the push
 * non-fast-forward, but disjoint ZetaId files (G-Set CRDT) never conflict → `pull --rebase
 * --autostash` (tolerates a dirty checkout) + retry. On exhausted/failed rebase, `undoLocalCommit`
 * leaves no local residue. Extracted from gitCommitToMain to keep each function's complexity bounded.
 */
function pushWithRebaseRetry(run, undoLocalCommit) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            run(["push", "origin", "HEAD:main"]);
            return { ok: true };
        }
        catch {
            try {
                run(["pull", "--rebase", "--autostash", "origin", "main"]);
            }
            catch {
                try {
                    run(["rebase", "--abort"]);
                }
                catch {
                    /* no rebase in progress to abort — fine */
                }
                undoLocalCommit();
                return { ok: false, reason: "push rejected and rebase failed (peer contention); local commit undone" };
            }
        }
    }
    undoLocalCommit();
    return { ok: false, reason: "push failed after 3 rebase-retry attempts; local commit undone" };
}
export function gitCommitToMain(filePath, envelope) {
    const run = (args) => 
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFileSync("git", [...args], { encoding: "utf-8" }).trim();
    const gitPath = filePath.replaceAll("\\", "/");
    try {
        const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
        if (branch !== "main") {
            return { ok: false, reason: `observe event sink must run on a main checkout (on '${branch}')` };
        }
        run(["fetch", "origin", "main"]);
        const ahead = run(["rev-list", "--count", "origin/main..HEAD"]);
        if (ahead !== "0") {
            return {
                ok: false,
                reason: `local main is ${ahead} commit(s) ahead of origin/main; reconcile before appending events`,
            };
        }
        run(["add", gitPath]);
        // Idempotent re-append: if the file is already committed + unchanged, `git add` stages
        // nothing, so `git commit` would fail ("nothing to commit"). That's a no-op, not an error —
        // return ok (the event already landed durably). `git diff --cached --quiet` exits 0 when
        // nothing is staged (Copilot #6312 — re-append of an already-landed event must be idempotent ok).
        let staged = false;
        try {
            run(["diff", "--cached", "--quiet", "--", gitPath]);
        }
        catch {
            staged = true; // non-zero exit = staged changes present
        }
        if (!staged)
            return { ok: true };
        const msg = [
            `observe(${envelope.by}): ${envelope.action.kind} ${gitPath}`,
            "",
            `Observe event ${envelope.id} appended folder-direct-to-main (sovereign transport, 081KSNY2Z0008QG0R000E5KTPX).`,
            "",
            coauthorFor(envelope.by),
        ].join("\n");
        run(["commit", "--no-verify", "-q", "-m", msg, "--", gitPath]);
        // After this point the commit exists on local main. If the push never lands we MUST undo it
        // WITHOUT clobbering unrelated edits: a `reset --hard` would wipe an agent's concurrent
        // uncommitted work in other files (Codex #6312 P1). Targeted undo instead: `reset --soft`
        // (move HEAD back; stages ONLY our commit's diff = our event file; other files untouched) then
        // `restore --staged -- <our path>` (unstage ONLY our file → untracked; nothing else touched).
        // The orphaned event file itself is removed by `append` on the ok:false return (so it can't be
        // half-read by loadWorld). Net: commit gone, our file gone, every other file exactly as it was.
        const undoLocalCommit = () => {
            try {
                run(["reset", "--soft", "HEAD~1"]);
                run(["restore", "--staged", "--", gitPath]);
            }
            catch {
                /* nothing to undo — fine */
            }
        };
        return pushWithRebaseRetry(run, undoLocalCommit);
    }
    catch (err) {
        // If `git commit` itself failed AFTER `git add` (e.g. missing git identity, a commit hook),
        // our path is left STAGED; append's rmSync would then remove the worktree file but leave a
        // staged-add of a now-deleted file = dirty index that blocks the next rebase. Unstage our path
        // (best-effort; no-op if nothing was staged) so the index is clean too (Codex #6312 P2).
        try {
            run(["restore", "--staged", "--", gitPath]);
        }
        catch {
            /* nothing staged for our path — fine */
        }
        return { ok: false, reason: `git commit failed: ${err.message}` };
    }
}
/** Best-effort remove a file WE created this append (null = we created nothing → nothing to remove). */
function removeOurFile(path) {
    if (path === null)
        return;
    try {
        rmSync(path, { force: true });
    }
    catch {
        /* already gone (e.g. undo removed it) — fine */
    }
}
/**
 * The real folder-direct-to-main EventSink. `append` mints a ZetaId, builds the
 * fact envelope, atomically writes `<eventDir>/<id>.json`, and commits it to main.
 * Pure-shaped (Result; never throws); I/O injected for tests.
 */
export function folderSink(opts) {
    const mint = opts.mint ?? (() => mintObserveEventIdHex());
    const now = opts.now ?? (() => Date.now());
    const commit = opts.commit ?? gitCommitToMain;
    return {
        append: (action) => {
            // `ourFile` is set ONLY to a file WE created this append — so failure-cleanup removes our own
            // residue but NEVER a pre-existing durable event found via EEXIST-replay (Copilot #6312 P0).
            let ourFile = null;
            // Wrap the whole body: the injected `mint` / `now` / `commit` could throw (e.g. now()=NaN
            // makes toISOString() throw, or commit() throws). The documented contract is Result-only —
            // ANY throw converts to { ok: false } AND still cleans up our own file (Copilot #6312 P1).
            try {
                const id = mint();
                // `mint` is injectable + FolderSinkOptions is exported, so a caller could return a
                // path-traversal segment ("../outside") or a Windows-reserved name. The id is used as a
                // path segment — reject anything but a canonical 32-hex ZetaId before joining a path
                // (the bus guards its segments the same way). Security-relevant (Copilot #6312 P1).
                if (!isCanonicalEventId(id)) {
                    return Promise.resolve({ ok: false, reason: `non-canonical event id (expected 32 lowercase hex): '${id}'` });
                }
                const at = new Date(now()).toISOString();
                const envelope = { id, at, by: opts.by, action };
                const written = writeEventFile(envelope, opts.eventDir);
                if (!written.ok)
                    return Promise.resolve({ ok: false, reason: written.reason });
                if (written.created)
                    ourFile = written.path; // only OUR new file is ours to clean up
                const committed = commit(written.path, envelope);
                if (!committed.ok) {
                    removeOurFile(ourFile); // pre-existing durable events are NOT touched (created === false)
                    return Promise.resolve({ ok: false, reason: committed.reason });
                }
                return Promise.resolve({ ok: true, eventId: id });
            }
            catch (err) {
                // A throw (e.g. from an injected commit) must route through the SAME cleanup, so a failed
                // append never leaves a half-written file we created (Copilot #6312 P1).
                removeOurFile(ourFile);
                return Promise.resolve({ ok: false, reason: `append failed: ${err.message}` });
            }
        },
    };
}
