// format_version is 2 iff a mark remains, else 1.  Also strips empty mark maps
// so a v1 result never carries revoked:{} or quarantined:{}, which parseIndex rejects.
function withFmt(c, issuedAt) {
    const hasMarks = (m) => !!m && Object.keys(m).length > 0;
    const out = { ...c, issued_at: issuedAt };
    if (!hasMarks(out.revoked))
        delete out.revoked;
    if (!hasMarks(out.quarantined))
        delete out.quarantined;
    out.format_version = (hasMarks(c.revoked) || hasMarks(c.quarantined)) ? 2 : 1;
    return out;
}
function clone(m) {
    // deep-ish clone (own keys only; null-proto to avoid prototype pollution)
    const out = Object.create(null);
    for (const n of Object.keys(m ?? {})) {
        out[n] = Object.create(null);
        for (const v of Object.keys(m[n]))
            out[n][v] = { ...m[n][v] };
    }
    return out;
}
function has(m, name, version) {
    return !!m && !!m[name] && m[name][version] !== undefined;
}
function add(m, name, version, entry) {
    (m[name] ?? (m[name] = Object.create(null)))[version] = entry;
}
function remove(m, name, version) {
    if (m[name]) {
        delete m[name][version];
        if (Object.keys(m[name]).length === 0)
            delete m[name];
    }
}
export function applyRevoke(prev, name, version, reason, at) {
    const revoked = clone(prev.revoked);
    const quarantined = clone(prev.quarantined);
    remove(quarantined, name, version); // revoke supersedes quarantine
    add(revoked, name, version, reason !== undefined ? { reason, at } : { at });
    return withFmt({ ...prev, revoked, quarantined }, at);
}
export function applyQuarantine(prev, name, version, reason, at) {
    if (has(prev.revoked, name, version))
        return { error: `${name}@${version} is revoked (terminal); cannot quarantine` };
    const quarantined = clone(prev.quarantined);
    add(quarantined, name, version, reason !== undefined ? { reason, at } : { at });
    return withFmt({ ...prev, quarantined }, at);
}
export function applyUnquarantine(prev, name, version, at) {
    if (!has(prev.quarantined, name, version))
        return { error: `${name}@${version} is not quarantined` };
    const quarantined = clone(prev.quarantined);
    remove(quarantined, name, version);
    return withFmt({ ...prev, quarantined }, at);
}
