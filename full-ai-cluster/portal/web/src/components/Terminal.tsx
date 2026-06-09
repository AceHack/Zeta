import { useEffect, useRef, useState } from "react";
import { ChevronRight, Eraser, Loader2 } from "lucide-react";
import { api, type LogLine } from "@/lib/api";
import { cn } from "@/lib/utils";

type Row = LogLine & { kind?: "log" | "cmd" };

const levelColor: Record<LogLine["level"], string> = {
  info: "text-slate-300",
  warn: "text-amber-400",
  error: "text-rose-400",
  debug: "text-slate-500",
};

/** A single terminal that streams the resource's logs AND runs console commands
 *  inline — Console and Logs unified. RCON for game servers, shell for pods. */
export function Terminal({ fqn, kind }: { fqn: string; kind: "shell" | "rcon" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cmd, setCmd] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.logs(fqn).then((lines) => setRows(lines.map((l) => ({ ...l, kind: "log" as const }))));
  }, [fqn]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [rows]);

  const run = async () => {
    const c = cmd.trim();
    if (!c || running) return;
    setRows((r) => [...r, { ts: "›", level: "info", text: c, kind: "cmd" }]);
    setHistory((h) => [c, ...h].slice(0, 50));
    setHIdx(-1);
    setCmd("");
    if (c === "clear") {
      setRows([]);
      return;
    }
    setRunning(true);
    try {
      const out = await api.exec(fqn, c);
      setRows((r) => [...r, ...out.map((l) => ({ ...l, kind: "log" as const }))]);
    } catch (e) {
      setRows((r) => [...r, { ts: "", level: "error", text: (e as Error).message, kind: "log" }]);
    } finally {
      setRunning(false);
      input.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run();
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(hIdx + 1, history.length - 1);
      if (history[i] !== undefined) { setHIdx(i); setCmd(history[i]); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(hIdx - 1, -1);
      setHIdx(i);
      setCmd(i === -1 ? "" : history[i] ?? "");
    }
  };

  return (
    <div className="flex h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-[#0b0f17] shadow-inner">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="size-3 rounded-full bg-rose-500/80" />
            <span className="size-3 rounded-full bg-amber-500/80" />
            <span className="size-3 rounded-full bg-emerald-500/80" />
          </span>
          <span className="ml-2 text-xs font-medium text-slate-400">{kind === "rcon" ? "Game console — RCON + log stream" : "Shell — exec + log stream"}</span>
        </div>
        <button onClick={() => setRows([])} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"><Eraser className="size-3" /> Clear</button>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed" onClick={() => input.current?.focus()}>
        {rows.map((r, i) =>
          r.kind === "cmd" ? (
            <div key={i} className="flex items-center gap-2 text-sky-300"><ChevronRight className="size-3.5 shrink-0 text-sky-500" />{r.text}</div>
          ) : (
            <div key={i} className="flex gap-3 whitespace-pre-wrap break-words">
              {r.ts && r.ts !== "now" && <span className="shrink-0 select-none text-slate-600">{r.ts}</span>}
              <span className={cn(levelColor[r.level])}>{r.text}</span>
            </div>
          ),
        )}
        {running && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="size-3.5 animate-spin" /> running…</div>}
      </div>

      <div className="flex items-center gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-2.5 font-mono text-[12.5px]">
        <ChevronRight className="size-4 shrink-0 text-sky-500" />
        <input
          ref={input}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          placeholder={kind === "rcon" ? "status   (try: players, changelevel gm_construct, help)" : "ls   (try: ps, env, help)"}
          className="flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
