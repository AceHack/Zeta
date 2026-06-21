function stripManifestComment(line) {
    for (let i = 0; i < line.length; i++) {
        if (line[i] !== "#")
            continue;
        if (i === 0 || /\s/.test(line[i - 1])) {
            return line.slice(0, i);
        }
    }
    return line;
}
function parseAttrFields(fields) {
    const tokens = [];
    const attrs = {};
    for (const field of fields) {
        const equals = field.indexOf("=");
        if (equals > 0) {
            attrs[field.slice(0, equals)] = field.slice(equals + 1);
        }
        else {
            tokens.push(field);
        }
    }
    return { tokens, attrs };
}
export function parseSetupManifest(text) {
    const entries = [];
    const lines = text.split(/\r?\n/);
    for (const [index, rawLine] of lines.entries()) {
        const line = stripManifestComment(rawLine).trim();
        if (line.length === 0)
            continue;
        const fields = line.split(/\s+/);
        const spec = fields[0];
        const attrs = {};
        for (const field of fields.slice(1)) {
            const equals = field.indexOf("=");
            if (equals <= 0)
                continue;
            attrs[field.slice(0, equals)] = field.slice(equals + 1);
        }
        entries.push({ line: index + 1, spec, attrs });
    }
    return entries;
}
/** Parse mechanism manifests: all non-attr tokens preserved, key=value → attrs. */
export function parseMechanismManifest(text) {
    const entries = [];
    const lines = text.split(/\r?\n/);
    for (const [index, rawLine] of lines.entries()) {
        const line = stripManifestComment(rawLine).trim();
        if (line.length === 0)
            continue;
        const { tokens, attrs } = parseAttrFields(line.split(/\s+/));
        if (tokens.length === 0)
            continue;
        entries.push({ line: index + 1, tokens, attrs });
    }
    return entries;
}
export function pointerFromSetupManifest(args) {
    const pointer = {
        schema: "zeta.ace.package-manager-pointers.v1",
        purpose: args.purpose,
        realizer: args.realizer,
        manifest: args.manifest,
        dependencies: parseSetupManifest(args.text).map((entry) => {
            const dep = {
                ecosystem: entry.attrs.ecosystem !== undefined ? entry.attrs.ecosystem : args.ecosystem,
                spec: entry.spec,
                update: entry.attrs.update ??
                    args.defaultUpdate ??
                    "pinned",
            };
            return {
                ...dep,
                ...(entry.attrs.role !== undefined ? { role: entry.attrs.role } : {}),
                ...(entry.attrs.lang !== undefined ? { lang: entry.attrs.lang } : {}),
                ...(entry.attrs.when !== undefined ? { when: entry.attrs.when } : {}),
            };
        }),
    };
    if (args.optIn !== undefined) {
        return { ...pointer, opt_in: args.optIn };
    }
    return pointer;
}
/** Build an Ace pointer from a source/mechanism manifest (from-url, from-deb, …). */
export function pointerFromMechanismManifest(args) {
    const pointer = {
        schema: "zeta.ace.package-manager-pointers.v1",
        purpose: args.purpose,
        realizer: args.realizer,
        manifest: args.manifest,
        dependencies: parseMechanismManifest(args.text).map((entry) => {
            const dep = {
                ecosystem: entry.attrs.ecosystem ?? args.mechanism,
                spec: entry.tokens.join(" "),
                update: entry.attrs.update ??
                    args.defaultUpdate ??
                    defaultUpdateForMechanism(args.mechanism),
            };
            return {
                ...dep,
                ...(entry.attrs.role !== undefined ? { role: entry.attrs.role } : {}),
                ...(entry.attrs.lang !== undefined ? { lang: entry.attrs.lang } : {}),
                ...(entry.attrs.when !== undefined ? { when: entry.attrs.when } : {}),
            };
        }),
    };
    if (args.optIn !== undefined) {
        return { ...pointer, opt_in: args.optIn };
    }
    return pointer;
}
function defaultUpdateForMechanism(mechanism) {
    switch (mechanism) {
        case "from-url":
            return "pinned-url";
        case "from-installer":
            return "self-updating";
        case "from-deb":
        case "from-shim":
            return "when-drift-bump-pin";
        default:
            return "pinned";
    }
}
