import { canonicalYaml, fromCanonicalYaml } from "./yaml";
export function parseMarkdown(text) {
    text = text ?? "";
    if (text.startsWith("---") && (text.length === 3 || text[3] === "\n" || (text[3] === "\r" && text.length > 4 && text[4] === "\n"))) {
        const headerLen = text[3] === "\r" ? 5 : 4;
        let index = headerLen;
        let closeStart = -1;
        let newlineLen = -1;
        let closeEnd = -1;
        while (index < text.length) {
            let isNewline = false;
            let curNewlineLen = 0;
            let nextIdx = index;
            if (text[index] === "\n") {
                isNewline = true;
                curNewlineLen = 1;
                nextIdx = index + 1;
            }
            else if (text[index] === "\r" && index + 1 < text.length && text[index + 1] === "\n") {
                isNewline = true;
                curNewlineLen = 2;
                nextIdx = index + 2;
            }
            if (isNewline) {
                if (nextIdx + 3 <= text.length && text.substring(nextIdx, nextIdx + 3) === "---") {
                    const tailIdx = nextIdx + 3;
                    if (tailIdx === text.length) {
                        closeStart = index;
                        newlineLen = curNewlineLen;
                        closeEnd = tailIdx;
                        break;
                    }
                    else if (text[tailIdx] === "\n") {
                        closeStart = index;
                        newlineLen = curNewlineLen;
                        closeEnd = tailIdx + 1;
                        break;
                    }
                    else if (text[tailIdx] === "\r" && tailIdx + 1 < text.length && text[tailIdx + 1] === "\n") {
                        closeStart = index;
                        newlineLen = curNewlineLen;
                        closeEnd = tailIdx + 2;
                        break;
                    }
                }
                index = nextIdx;
            }
            else {
                index++;
            }
        }
        if (closeStart === -1) {
            return { ok: false, error: "Unclosed frontmatter delimiter" };
        }
        const yamlPart = text.substring(headerLen, closeStart + newlineLen);
        const bodyPart = text.substring(closeEnd);
        const fromYamlRes = fromCanonicalYaml(yamlPart);
        if (!fromYamlRes.ok) {
            return { ok: false, error: `Failed to parse frontmatter YAML: ${fromYamlRes.error}` };
        }
        if (fromYamlRes.value.t !== "obj") {
            return { ok: false, error: "Frontmatter must be a YAML map (Object)" };
        }
        return { ok: true, metadata: fromYamlRes.value, body: bodyPart };
    }
    else {
        return { ok: true, metadata: { t: "obj", v: [] }, body: text };
    }
}
export function serializeMarkdown(metadata, body) {
    if (metadata.t !== "obj") {
        return { ok: false, error: "Metadata must be a Object" };
    }
    if (metadata.v.length === 0) {
        return { ok: true, value: body ?? "" };
    }
    const toYamlRes = canonicalYaml(metadata);
    if (!toYamlRes.ok) {
        return { ok: false, error: toYamlRes.error };
    }
    const result = `---\n${toYamlRes.value}---\n${body ?? ""}`;
    return { ok: true, value: result };
}
