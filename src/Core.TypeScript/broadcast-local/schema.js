// schema.ts -- structured contract for ~/.local/share/zeta-broadcasts.
export const LOCAL_BROADCAST_SCHEMA_VERSION = 1;
export const DEFAULT_LOCAL_BROADCAST_TTL_MS = 30 * 60 * 1000;
const AGENTS = ["otto", "vera", "riven"];
const PRIORITIES = ["P0", "P1", "P2", "P3"];
const STATUSES = ["ok", "working", "blocked", "idle"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isOneOf(value, allowed) {
    return typeof value === "string" && allowed.includes(value);
}
function isIsoTimestamp(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
export function localBroadcastExpiresAt(writtenAt, ttlMs = DEFAULT_LOCAL_BROADCAST_TTL_MS) {
    const timestamp = Date.parse(writtenAt);
    if (Number.isNaN(timestamp)) {
        throw new Error(`invalid broadcast writtenAt timestamp: ${writtenAt}`);
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
        throw new Error(`invalid local broadcast ttl: ${ttlMs}`);
    }
    return new Date(timestamp + ttlMs).toISOString();
}
export function isLocalBroadcastStale(envelope, now = new Date()) {
    const expiresAt = Date.parse(envelope.expiresAt);
    if (Number.isNaN(expiresAt)) {
        return true;
    }
    return expiresAt <= now.getTime();
}
export function makeLocalBroadcastReceipt(config) {
    return {
        kind: "read",
        from: config.from,
        readAt: config.readAt,
        broadcastId: config.envelope.id,
        broadcastFrom: config.envelope.from,
        observedWrittenAt: config.envelope.writtenAt,
        ...(config.sourcePath === undefined ? {} : { sourcePath: config.sourcePath }),
        ...(config.note === undefined ? {} : { note: config.note }),
    };
}
function localBroadcastScopeKey(scope) {
    return JSON.stringify([scope.kind, scope.value]);
}
function compareStrings(left, right) {
    const leftChars = Array.from(left);
    const rightChars = Array.from(right);
    const length = Math.min(leftChars.length, rightChars.length);
    for (let index = 0; index < length; index += 1) {
        const leftCodePoint = leftChars[index]?.codePointAt(0) ?? 0;
        const rightCodePoint = rightChars[index]?.codePointAt(0) ?? 0;
        if (leftCodePoint !== rightCodePoint) {
            return leftCodePoint - rightCodePoint;
        }
    }
    return leftChars.length - rightChars.length;
}
function activeConflictCandidates(envelopes, now) {
    return [...envelopes]
        .filter((envelope) => envelope.status !== "idle" && !isLocalBroadcastStale(envelope, now))
        .sort((left, right) => {
        const agentCompare = compareStrings(left.from, right.from);
        if (agentCompare !== 0) {
            return agentCompare;
        }
        return compareStrings(left.id, right.id);
    });
}
export function detectLocalBroadcastScopeConflicts(envelopes, now = new Date()) {
    const ownersByScope = new Map();
    const conflicts = [];
    for (const envelope of activeConflictCandidates(envelopes, now)) {
        const seenInEnvelope = new Set();
        const scopes = [...(envelope.scope ?? [])].sort((left, right) => compareStrings(localBroadcastScopeKey(left), localBroadcastScopeKey(right)));
        for (const scope of scopes) {
            const key = localBroadcastScopeKey(scope);
            if (seenInEnvelope.has(key)) {
                continue;
            }
            seenInEnvelope.add(key);
            const owners = ownersByScope.get(key) ?? [];
            for (const owner of owners) {
                if (owner.from === envelope.from || owner.id === envelope.id) {
                    continue;
                }
                conflicts.push({
                    scope,
                    broadcastIds: [owner.id, envelope.id],
                    agents: [owner.from, envelope.from],
                    summaries: [owner.summary, envelope.summary],
                });
            }
            ownersByScope.set(key, [...owners, envelope]);
        }
    }
    return [...conflicts].sort((left, right) => {
        const scopeCompare = compareStrings(localBroadcastScopeKey(left.scope), localBroadcastScopeKey(right.scope));
        if (scopeCompare !== 0) {
            return scopeCompare;
        }
        return compareStrings(JSON.stringify(left.broadcastIds), JSON.stringify(right.broadcastIds));
    });
}
export function validateLocalBroadcastEnvelope(value) {
    const errors = [];
    if (!isRecord(value)) {
        return { ok: false, errors: ["envelope must be an object"] };
    }
    if (value.schemaVersion !== LOCAL_BROADCAST_SCHEMA_VERSION) {
        errors.push(`schemaVersion must be ${LOCAL_BROADCAST_SCHEMA_VERSION}`);
    }
    if (typeof value.id !== "string" || value.id.length === 0) {
        errors.push("id must be a non-empty string");
    }
    if (!isOneOf(value.from, AGENTS)) {
        errors.push("from must be one of otto, vera, riven");
    }
    if (!isIsoTimestamp(value.writtenAt)) {
        errors.push("writtenAt must be an ISO-8601 timestamp");
    }
    if (!isIsoTimestamp(value.expiresAt)) {
        errors.push("expiresAt must be an ISO-8601 timestamp");
    }
    if (!isOneOf(value.priority, PRIORITIES)) {
        errors.push("priority must be P0, P1, P2, or P3");
    }
    if (!isOneOf(value.status, STATUSES)) {
        errors.push("status must be ok, working, blocked, or idle");
    }
    if (typeof value.summary !== "string" || value.summary.length === 0) {
        errors.push("summary must be a non-empty string");
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    return { ok: true, value: value };
}
