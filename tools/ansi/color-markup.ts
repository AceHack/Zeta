/**
 * tools/ansi/color-markup.ts
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

// --- named basic colors (SGR 30-37 / 90-97 foreground; +10 for background) ---

const BASIC: Record<string, number> = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  brightblack: 90, brightred: 91, brightgreen: 92, brightyellow: 93,
  brightblue: 94, brightmagenta: 95, brightcyan: 96, brightwhite: 97,
};
const BASIC_FG_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(BASIC).map(([n, c]) => [c, n]),
);

const ESC = "\x1b";
const RESET = `${ESC}[0m`;

/** A resolved color spec → the SGR parameter list for fg (`fg=true`) or bg. */
function specToSgr(spec: string, fg: boolean): string | null {
  const base = fg ? 38 : 48;
  const lower = spec.toLowerCase();
  if (lower in BASIC) {
    const code = BASIC[lower]! + (fg ? 0 : 10);
    return String(code);
  }
  if (/^#[0-9a-fA-F]{6}$/.test(spec)) {
    const r = parseInt(spec.slice(1, 3), 16);
    const g = parseInt(spec.slice(3, 5), 16);
    const b = parseInt(spec.slice(5, 7), 16);
    return `${base};2;${r};${g};${b}`;
  }
  if (/^\d{1,3}$/.test(spec)) {
    const n = Number(spec);
    if (n >= 0 && n <= 255) return `${base};5;${n}`;
  }
  return null; // unrecognized spec → leave markup as-is (don't fabricate color)
}

// --- render: markup → real terminal ANSI -------------------------------------

const OPEN_RE = /\{(c|bg):([^}]+)\}/g;
const CLOSE_RE = /\{\/(c|bg)\}/g;

/**
 * Render color markup to terminal ANSI. Foreground + background each maintain a
 * stack (so nesting works); after every change the current combined state is
 * emitted as a single SGR (reset + active fg + active bg). Unknown specs are
 * left as literal text (no fabricated color).
 */
export function renderToAnsi(markup: string): string {
  type Tok = { kind: "text"; v: string } | { kind: "open"; ch: "c" | "bg"; spec: string } | { kind: "close"; ch: "c" | "bg" };
  const toks: Tok[] = [];
  let i = 0;
  while (i < markup.length) {
    OPEN_RE.lastIndex = i;
    CLOSE_RE.lastIndex = i;
    const open = OPEN_RE.exec(markup);
    const close = CLOSE_RE.exec(markup);
    // earliest match at/after i
    const next = [open, close].filter((m): m is RegExpExecArray => m !== null && m.index >= i).sort((a, b) => a.index - b.index)[0];
    if (!next) {
      toks.push({ kind: "text", v: markup.slice(i) });
      break;
    }
    if (next.index > i) toks.push({ kind: "text", v: markup.slice(i, next.index) });
    if (next === open) toks.push({ kind: "open", ch: open![1] as "c" | "bg", spec: open![2]! });
    else toks.push({ kind: "close", ch: close![1] as "c" | "bg" });
    i = next.index + next[0].length;
  }

  // Stacks hold a spec string, or `null` for an UNRECOGNIZED open kept as literal
  // markup (so its matching close is also emitted literally, not as a reset).
  const fg: (string | null)[] = [];
  const bg: (string | null)[] = [];
  const lastReal = (arr: readonly (string | null)[]): string | undefined => {
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      if (v) return v;
    }
    return undefined;
  };
  const sgrFor = (): string => {
    const parts: string[] = [];
    const f = lastReal(fg);
    const b = lastReal(bg);
    if (f) {
      const s = specToSgr(f, true);
      if (s) parts.push(s);
    }
    if (b) {
      const s = specToSgr(b, false);
      if (s) parts.push(s);
    }
    if (parts.length === 0) return RESET;
    return `${ESC}[0;${parts.join(";")}m`;
  };

  let out = "";
  for (const t of toks) {
    if (t.kind === "text") {
      out += t.v;
    } else if (t.kind === "open") {
      const stack = t.ch === "c" ? fg : bg;
      if (specToSgr(t.spec, t.ch === "c") === null) {
        // unrecognized spec: keep the literal markup (don't drop intent) + push a
        // null placeholder so the matching close is emitted literally too.
        stack.push(null);
        out += `{${t.ch}:${t.spec}}`;
      } else {
        stack.push(t.spec);
        out += sgrFor();
      }
    } else {
      const stack = t.ch === "c" ? fg : bg;
      const popped = stack.pop();
      if (popped === null) out += `{/${t.ch}}`; // matched a literal open
      else out += sgrFor();
    }
  }
  if (fg.some(Boolean) || bg.some(Boolean)) out += RESET;
  return out;
}

// --- parse: real/caret ANSI → markup -----------------------------------------

/** Normalize `cat -v` caret notation (`^[`) to real ESC so one parser handles both. */
export function caretToEsc(text: string): string {
  return text.replace(/\^\[/g, ESC);
}

/**
 * Convert ANSI-colored text (real ESC, or `cat -v` caret `^[[`) into round-trippable
 * markup. Emits FLAT spans (each color run closed before the next opens) — correct
 * and simple for the common case. Recognizes fg/bg in truecolor (38;2/48;2),
 * 256-color (38;5/48;5), and basic (30-37/90-97, 40-47/100-107); `0`/empty resets.
 * Non-color SGR (bold/underline/…) and unrecognized params are dropped.
 */
export function parseFromAnsi(input: string): string {
  const text = caretToEsc(input);
  const sgr = /\x1b\[([0-9;]*)m/g;
  let out = "";
  let last = 0;
  let fgOpen = false;
  let bgOpen = false;
  const closeOpen = (): void => {
    if (bgOpen) {
      out += "{/bg}";
      bgOpen = false;
    }
    if (fgOpen) {
      out += "{/c}";
      fgOpen = false;
    }
  };
  let m: RegExpExecArray | null;
  while ((m = sgr.exec(text)) !== null) {
    out += text.slice(last, m.index); // literal text before this SGR
    last = sgr.lastIndex;
    const params = m[1] === "" ? ["0"] : m[1]!.split(";");
    let p = 0;
    while (p < params.length) {
      const code = Number(params[p]);
      if (code === 0) {
        closeOpen();
        p += 1;
      } else if (code === 39) {
        // default foreground — selective reset of just the fg span
        if (fgOpen) {
          out += "{/c}";
          fgOpen = false;
        }
        p += 1;
      } else if (code === 49) {
        // default background — selective reset of just the bg span
        if (bgOpen) {
          out += "{/bg}";
          bgOpen = false;
        }
        p += 1;
      } else if (code === 38 || code === 48) {
        const isFg = code === 38;
        const mode = Number(params[p + 1]);
        let spec: string | null = null;
        if (mode === 5) {
          spec = String(Number(params[p + 2]));
          p += 3;
        } else if (mode === 2) {
          const r = Number(params[p + 2]), g = Number(params[p + 3]), b = Number(params[p + 4]);
          spec = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
          p += 5;
        } else {
          p += 1;
        }
        if (spec !== null) {
          if (isFg) {
            if (fgOpen) out += "{/c}";
            out += `{c:${spec}}`;
            fgOpen = true;
          } else {
            if (bgOpen) out += "{/bg}";
            out += `{bg:${spec}}`;
            bgOpen = true;
          }
        }
      } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
        if (fgOpen) out += "{/c}";
        out += `{c:${BASIC_FG_TO_NAME[code]}}`;
        fgOpen = true;
        p += 1;
      } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
        const name = BASIC_FG_TO_NAME[code - 10];
        if (name) {
          if (bgOpen) out += "{/bg}";
          out += `{bg:${name}}`;
          bgOpen = true;
        }
        p += 1;
      } else {
        p += 1; // non-color SGR (bold/underline/etc.) — dropped
      }
    }
  }
  out += text.slice(last);
  closeOpen();
  return out;
}

/** Strip ALL ANSI (real or caret) → plain text. */
export function stripAnsi(input: string): string {
  return caretToEsc(input).replace(/\x1b\[[0-9;]*m/g, "");
}
