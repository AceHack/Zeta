import { Boxes, Database, Gamepad2, Globe, Server, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Health } from "@/lib/api";

export const categoryMeta: Record<string, { icon: LucideIcon; label: string }> = {
  game: { icon: Gamepad2, label: "Game servers" },
  web: { icon: Globe, label: "Web apps" },
  database: { icon: Database, label: "Databases" },
  app: { icon: Boxes, label: "Apps & workers" },
  other: { icon: Server, label: "Other" },
};
export const catIcon = (c: string): LucideIcon => (categoryMeta[c] ?? categoryMeta.other).icon;

const healthColor: Record<Health, string> = {
  ready: "bg-success",
  progressing: "bg-warning",
  error: "bg-destructive",
  unknown: "bg-muted-foreground",
};
const healthText: Record<Health, string> = {
  ready: "text-success",
  progressing: "text-warning",
  error: "text-destructive",
  unknown: "text-muted-foreground",
};

export function HealthDot({ health, label, className }: { health: Health; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium", healthText[health], className)}>
      <span className="relative flex size-2">
        {health === "progressing" && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", healthColor[health])} />}
        <span className={cn("relative inline-flex size-2 rounded-full", healthColor[health])} />
      </span>
      {label}
    </span>
  );
}

const palette = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
const hash = (s: string) => [...s].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);

export function PersonaAvatar({ id, kind = "persona", size = "sm" }: { id: string; kind?: "human" | "persona"; size?: "sm" | "md" }) {
  const color = kind === "human" ? "bg-foreground/80 text-background" : `${palette[hash(id) % palette.length]} text-white`;
  const dim = size === "md" ? "size-7 text-xs" : "size-5 text-[10px]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex items-center justify-center rounded-full font-semibold", dim, color)}>{id[0]?.toUpperCase() ?? "?"}</span>
      <span className="text-sm">{id}</span>
    </span>
  );
}
