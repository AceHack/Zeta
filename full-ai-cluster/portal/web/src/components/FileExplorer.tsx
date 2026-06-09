import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, FileArchive, FileCode, FileCog, FileText, Folder, HardDriveUpload,
  Home, Loader2, Trash2, Upload,
} from "lucide-react";
import { api, type FileNode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROOTS: Record<string, string> = { game: "/data", database: "/var/lib/postgresql/data", web: "/", other: "/" };

const fileIcon = (name: string) => {
  if (/\.(gma|zip|tar|gz)$/i.test(name)) return FileArchive;
  if (/\.(lua|js|ts|sh|py)$/i.test(name)) return FileCode;
  if (/\.(cfg|conf|ini|env|yaml|yml|toml)$/i.test(name)) return FileCog;
  return FileText;
};
const fmtSize = (n: number) => (n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export function FileExplorer({ fqn, category }: { fqn: string; category: string }) {
  const root = ROOTS[category] ?? "/";
  const [path, setPath] = useState(root);
  const [entries, setEntries] = useState<FileNode[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setErr(null);
    api.files(fqn, path).then((d) => setEntries(d.entries)).catch((e) => setErr(e.message));
  }, [fqn, path]);
  useEffect(load, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const doUpload = async (files: FileList | File[]) => {
    setBusy(true);
    for (const f of Array.from(files)) await api.upload(fqn, path, { name: f.name, size: f.size });
    setBusy(false);
    flash(`Uploaded ${Array.from(files).length} file(s) to ${path}`);
    load();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
  };
  const del = async (f: FileNode) => {
    await api.deleteFile(fqn, f.path);
    flash(`Deleted ${f.name}`);
    load();
  };

  // breadcrumb segments
  const segs = path === "/" ? [] : path.replace(/^\//, "").split("/");
  const crumbTo = (i: number) => "/" + segs.slice(0, i + 1).join("/");

  return (
    <div
      className={cn("relative rounded-xl border bg-card/40 transition-colors", dragging ? "border-primary ring-2 ring-primary/30" : "border-border")}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}
    >
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <button onClick={() => setPath(root)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Home"><Home className="size-4" /></button>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {segs.length === 0 ? <span className="text-muted-foreground">/</span> : segs.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-muted-foreground/50">/</span>
              <button onClick={() => setPath(crumbTo(i))} className={cn("rounded px-1.5 py-0.5 hover:bg-accent", i === segs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</button>
            </span>
          ))}
        </div>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => e.target.files && doUpload(e.target.files)} />
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload
        </Button>
      </div>

      {toast && <div className="border-b border-primary/20 bg-primary/10 px-4 py-1.5 text-xs text-primary">{toast}</div>}

      {/* listing */}
      <div className="min-h-[300px]">
        {err ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">File access needs the SFTP sidecar (game servers) or pod exec.</div>
        ) : !entries ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded bg-muted/40" />)}</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">Empty folder. Drag files here to upload.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Size</th><th className="px-4 py-2 font-medium">Modified</th><th className="w-20 px-4 py-2" /></tr></thead>
            <tbody>
              {entries.map((f) => {
                const Icon = f.type === "dir" ? Folder : fileIcon(f.name);
                return (
                  <tr key={f.path} className="group border-t border-border/50 hover:bg-accent/40" onDoubleClick={() => f.type === "dir" && setPath(f.path)}>
                    <td className="px-4 py-2">
                      <button className="inline-flex items-center gap-2.5 text-left" onClick={() => f.type === "dir" && setPath(f.path)} disabled={f.type === "file"}>
                        <Icon className={cn("size-4 shrink-0", f.type === "dir" ? "text-sky-400" : "text-muted-foreground")} />
                        <span className={cn(f.type === "dir" && "font-medium text-foreground")}>{f.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{f.type === "dir" ? "—" : fmtSize(f.size)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.modified}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {f.type === "file" && <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Download"><Download className="size-3.5" /></button>}
                        <button onClick={() => del(f)} className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive" title="Delete"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-primary/10 backdrop-blur-[1px]">
          <HardDriveUpload className="size-8 text-primary" />
          <p className="mt-2 text-sm font-medium text-primary">Drop to upload to {path}</p>
        </div>
      )}

      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Transfers run over the SFTP sidecar (port 2222 for game servers). Drag & drop or use Upload; double-click a folder to open.
      </p>
    </div>
  );
}
