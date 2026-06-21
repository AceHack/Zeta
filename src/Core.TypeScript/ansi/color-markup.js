/**
 * src/Core.TypeScript/ansi/color-markup.ts
 *
 * Text-carried color so color can ROUND-TRIP through a plain-text channel (the
 * Otto↔operator copy-paste). The problem (per the 2026-06-02 vision note §10 +
 * the iTerm answer): a terminal RENDERS ANSI into pixels and copy gives back
 * PLAIN text — the color is gone; and an agent receives plain text, so it never
 * "sees" rendered color. The fix: express color as LITERAL TEXT both ways —
 *
 *   - a copy-paste-safe MARKUP the agent can emit + read: `{c:…}text{/c}`
 *     (foreground) and `{bg:…}text{/bg}` (background), where `…` is a name
 *     (`red`, `brightcyan`), a 256-index (`203`), or a hex (`#ff5555`);
 *   - `renderToAnsi(markup)` turns it into real terminal ANSI so a HUMAN SEES color;
 *   - `parseFromAnsi(ansiText)` turns real (or `cat -v` caret `^[[`) ANSI back into
 *     the markup, so already-colored output becomes round-trippable.
 *
 * Round-trip is exact for the three color forms (256→`{c:N}`→256; truecolor→
 * `{c:#hex}`→truecolor; basic 30-37/90-97 → named → basic). The markup is the
 * canonical text form: the agent emits it, the human renders it, the human copies
 * the markup back, the agent reads the color. "Where the life can be seen living."
 */
const BASIC = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    brightblack: 90,
    brightred: 91,
    brightgreen: 92,
    brightyellow: 93,
    brightblue: 94,
    brightmagenta: 95,
    brightcyan: 96,
    brightwhite: 97,
};
const BASIC_FG_TO_NAME = Object.fromEntries(Object.entries(BASIC).map(([n, c]) => [c, n]));
const ESC = "\x1b";
const RESET = `${ESC}[0m`;
const SGR_RE_SOURCE = `${ESC}\\[([0-9;]*)m`;
const STRIP_SGR_RE_SOURCE = `${ESC}\\[[0-9;]*m`;
function isChannel(value) {
    return value === "c" || value === "bg";
}
/** A resolved color spec → the SGR parameter list for fg (`fg=true`) or bg. */
function specToSgr(spec, fg) {
    const base = fg ? 38 : 48;
    const code = BASIC[spec.toLowerCase()];
    if (code !== undefined) {
        const codeWithPlane = code + (fg ? 0 : 10);
        return String(codeWithPlane);
    }
    if (/^#[0-9a-fA-F]{6}$/.test(spec)) {
        const channels = [spec.slice(1, 3), spec.slice(3, 5), spec.slice(5, 7)].map((hex) => parseInt(hex, 16));
        return [base, 2, ...channels].map(String).join(";");
    }
    if (/^\d{1,3}$/.test(spec)) {
        const n = Number(spec);
        if (n >= 0 && n <= 255) {
            return [base, 5, n].map(String).join(";");
        }
    }
    return null; // unrecognized spec → leave markup as-is (don't fabricate color)
}
function basicForegroundName(code) {
    if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
        return BASIC_FG_TO_NAME[code];
    }
    return undefined;
}
function basicBackgroundName(code) {
    if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
        return BASIC_FG_TO_NAME[code - 10];
    }
    return undefined;
}
function parseByte(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 255 ? n : null;
}
function parseMarkupTokens(markup) {
    const tokenRe = /\{(c|bg):([^}]+)\}|\{\/(c|bg)\}/g;
    const tokens = [];
    let index = 0;
    let match;
    while ((match = tokenRe.exec(markup)) !== null) {
        if (match.index > index) {
            tokens.push({ kind: "text", value: markup.slice(index, match.index) });
        }
        const openChannel = match[1];
        const closeChannel = match[3];
        if (isChannel(openChannel)) {
            tokens.push({ kind: "open", channel: openChannel, spec: match[2] ?? "" });
        }
        else if (isChannel(closeChannel)) {
            tokens.push({ kind: "close", channel: closeChannel });
        }
        index = tokenRe.lastIndex;
    }
    if (index < markup.length) {
        tokens.push({ kind: "text", value: markup.slice(index) });
    }
    return tokens;
}
function lastReal(stack) {
    for (let i = stack.length - 1; i >= 0; i--) {
        const value = stack[i];
        if (value) {
            return value;
        }
    }
    return undefined;
}
function currentSgr(foreground, background) {
    const parts = [lastReal(foreground), lastReal(background)]
        .map((spec, index) => (spec === undefined ? null : specToSgr(spec, index === 0)))
        .filter((part) => part !== null);
    if (parts.length === 0) {
        return RESET;
    }
    return `${ESC}[0;${parts.join(";")}m`;
}
function renderToken(token, foreground, background) {
    if (token.kind === "text") {
        return token.value;
    }
    const stack = token.channel === "c" ? foreground : background;
    if (token.kind === "open") {
        if (specToSgr(token.spec, token.channel === "c") === null) {
            stack.push(null);
            return `{${token.channel}:${token.spec}}`;
        }
        stack.push(token.spec);
        return currentSgr(foreground, background);
    }
    const popped = stack.pop();
    if (popped === null) {
        return `{/${token.channel}}`;
    }
    return currentSgr(foreground, background);
}
function closeForeground(state) {
    if (state.fgOpen) {
        state.out += "{/c}";
        state.fgOpen = false;
    }
}
function closeBackground(state) {
    if (state.bgOpen) {
        state.out += "{/bg}";
        state.bgOpen = false;
    }
}
function closeOpen(state) {
    closeBackground(state);
    closeForeground(state);
}
function openForeground(state, spec) {
    closeForeground(state);
    state.out += `{c:${spec}}`;
    state.fgOpen = true;
}
function openBackground(state, spec) {
    closeBackground(state);
    state.out += `{bg:${spec}}`;
    state.bgOpen = true;
}
function parseExtendedSpec(params, index) {
    const mode = Number(params[index + 1]);
    if (mode === 5) {
        const color = parseByte(params[index + 2]);
        return { spec: color === null ? null : String(color), next: index + 3 };
    }
    if (mode === 2) {
        const channels = [parseByte(params[index + 2]), parseByte(params[index + 3]), parseByte(params[index + 4])];
        if (channels.every((value) => value !== null)) {
            return {
                spec: `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
                next: index + 5,
            };
        }
        return { spec: null, next: index + 5 };
    }
    return { spec: null, next: index + 1 };
}
function applyColorCode(state, code, params, index) {
    if (code === 38 || code === 48) {
        const { spec, next } = parseExtendedSpec(params, index);
        if (spec !== null) {
            if (code === 38) {
                openForeground(state, spec);
            }
            else {
                openBackground(state, spec);
            }
        }
        return next;
    }
    const fgName = basicForegroundName(code);
    if (fgName !== undefined) {
        openForeground(state, fgName);
        return index + 1;
    }
    const bgName = basicBackgroundName(code);
    if (bgName !== undefined) {
        openBackground(state, bgName);
        return index + 1;
    }
    return null;
}
function applySgrParam(state, params, index) {
    const code = Number(params[index]);
    if (code === 0) {
        closeOpen(state);
        return index + 1;
    }
    if (code === 39) {
        closeForeground(state);
        return index + 1;
    }
    if (code === 49) {
        closeBackground(state);
        return index + 1;
    }
    const colorNext = applyColorCode(state, code, params, index);
    return colorNext ?? index + 1; // non-color SGR (bold/underline/etc.) — dropped
}
function parseSgrParams(rawParams) {
    return rawParams === "" ? ["0"] : rawParams.split(";");
}
// --- render: markup → real terminal ANSI -------------------------------------
/**
 * Render color markup to terminal ANSI. Foreground + background each maintain a
 * stack (so nesting works); after every change the current combined state is
 * emitted as a single SGR (reset + active fg + active bg). Unknown specs are
 * left as literal text (no fabricated color).
 */
export function renderToAnsi(markup) {
    // Stacks hold a spec string, or `null` for an UNRECOGNIZED open kept as literal
    // markup (so its matching close is also emitted literally, not as a reset).
    const foreground = [];
    const background = [];
    let out = "";
    for (const token of parseMarkupTokens(markup)) {
        out += renderToken(token, foreground, background);
    }
    if (foreground.some(Boolean) || background.some(Boolean)) {
        out += RESET;
    }
    return out;
}
// --- parse: real/caret ANSI → markup -----------------------------------------
/** Normalize `cat -v` caret notation (`^[`) to real ESC so one parser handles both. */
export function caretToEsc(text) {
    return text.replace(/\^\[/g, ESC);
}
/**
 * Convert ANSI-colored text (real ESC, or `cat -v` caret `^[[`) into round-trippable
 * markup. Emits FLAT spans (each color run closed before the next opens) — correct
 * and simple for the common case. Recognizes fg/bg in truecolor (38;2/48;2),
 * 256-color (38;5/48;5), and basic (30-37/90-97, 40-47/100-107); `0`/empty resets.
 * Non-color SGR (bold/underline/…) and unrecognized params are dropped.
 */
export function parseFromAnsi(input) {
    const text = caretToEsc(input);
    const sgr = new RegExp(SGR_RE_SOURCE, "g");
    const state = { out: "", fgOpen: false, bgOpen: false };
    let last = 0;
    let match;
    while ((match = sgr.exec(text)) !== null) {
        state.out += text.slice(last, match.index); // literal text before this SGR
        last = sgr.lastIndex;
        const params = parseSgrParams(match[1] ?? "");
        for (let index = 0; index < params.length;) {
            index = applySgrParam(state, params, index);
        }
    }
    state.out += text.slice(last);
    closeOpen(state);
    return state.out;
}
/** Strip ALL ANSI (real or caret) → plain text. */
export function stripAnsi(input) {
    return caretToEsc(input).replace(new RegExp(STRIP_SGR_RE_SOURCE, "g"), "");
}
