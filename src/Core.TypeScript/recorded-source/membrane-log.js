/**
 * membrane-log — one line of the membrane log (the RecordedSource wire form). TS parity oracle; mirrors
 * src/Core/RecordedSource.fs (the F# oracle that LOCKED the membrane-log treaty) and the C#/Rust
 * siblings. toLine/ofLine must reproduce ./golden-vectors.lines byte-for-byte.
 */
const INT_KINDS = ["TimerElapsed", "DotGitSaturation", "RoundsElapsedSinceFreeTime", "PeerPRMerged"];
const STR_KINDS = ["RateLimitExhausted", "OperatorMessageArrived", "CIFailureDetected"];
function esc(s) {
    return s.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\n", "\\n").replaceAll("\r", "\\r");
}
function unesc(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "\\" && i + 1 < s.length) {
            const c = s[i + 1];
            out += c === "t" ? "\t" : c === "n" ? "\n" : c === "r" ? "\r" : c;
            i++;
        }
        else {
            out += s[i];
        }
    }
    return out;
}
/** Serialize to the canonical wire line (byte-identical to the F# oracle). */
export function toLine(c) {
    if (INT_KINDS.includes(c.kind))
        return `${c.tick}\t${c.kind}\t${c.intArg}`;
    if (STR_KINDS.includes(c.kind))
        return `${c.tick}\t${c.kind}\t${esc(c.strArg)}`;
    return `${c.tick}\t${c.kind}`;
}
/** Parse a canonical wire line; null on malformed/unknown-kind (honest refusal). */
export function ofLine(line) {
    const parts = line.split("\t");
    if (parts.length < 2)
        return null;
    const tick = Number(parts[0]);
    if (!Number.isInteger(tick) || parts[0] === "")
        return null;
    const kind = parts[1];
    if (kind === "SentinelMissing") {
        return parts.length === 2 ? { tick, kind, intArg: null, strArg: null } : null;
    }
    if (INT_KINDS.includes(kind)) {
        if (parts.length !== 3)
            return null;
        const v = Number(parts[2]);
        if (!Number.isInteger(v) || parts[2] === "")
            return null;
        return { tick, kind, intArg: v, strArg: null };
    }
    if (STR_KINDS.includes(kind)) {
        return parts.length === 3 ? { tick, kind, intArg: null, strArg: unesc(parts[2]) } : null;
    }
    return null;
}
