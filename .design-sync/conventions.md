# zeta-portal-web conventions

Dark-only console UI (Linear/Vercel-style minimalism). No provider or theme wrapper is needed — tokens are defined on `:root` in `styles.css` and everything renders dark by default. Give every page a root with `bg-background text-foreground min-h-screen`; without it you get a white page with invisible text.

## Styling idiom: Tailwind utilities with semantic tokens

Style with Tailwind utility classes, always through the semantic color names below — never raw palette colors (`bg-blue-500`, `text-gray-400` do not exist in this build). The stylesheet is a compiled Tailwind subset: the families below are guaranteed present; classes outside them may silently not exist, so prefer this vocabulary and use `style={{}}` for true one-offs.

| Family | Classes |
|---|---|
| Surfaces | `bg-background` (page), `bg-surface` (raised panel), `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`, `bg-secondary` |
| Text | `text-foreground`, `text-muted-foreground`, `text-primary`, `text-card-foreground`, `text-secondary-foreground`, `text-accent-foreground` |
| Intent | `bg-primary text-primary-foreground`, `text-destructive`, `text-success`, `text-warning` (+ `bg-destructive`, `bg-success`, `bg-warning`; soft fills via `/15`, e.g. `bg-primary/15 text-primary`) |
| Borders | `border border-border` (hairline default), `border-border-strong`, inputs use `border-input`; focus rings `ring-ring` |
| Radius | `rounded-lg` / `rounded-md` / `rounded-sm` (driven by `--radius`, 0.45rem); cards use `rounded-lg`, controls `rounded-md` |
| Motion | `animate-fade-in`, `animate-scale-in` (dialogs), `animate-slide-in-right` (sheets) |

Typography is Inter Variable (already loaded via `styles.css`; no font setup needed). Body text is `text-sm`; titles `font-semibold tracking-tight`; secondary text `text-sm text-muted-foreground`; code/logs `font-mono text-xs`.

## Components

Import from `window.ZetaPortalUI` (Badge, Button, Card + CardHeader/CardTitle/CardDescription/CardContent/CardFooter, Dialog + DialogHeader/DialogTitle/DialogDescription/DialogBody/DialogFooter, Input, Label, Textarea, Select, Sheet + SheetHeader/SheetTitle/SheetBody, Tabs + TabsList/TabsTrigger/TabsContent). Variant props carry the design language: `Button variant` = default | secondary | outline | ghost | link | success | destructive, `size` = sm | default | lg | icon; `Badge variant` = default | secondary | outline | success | warning | destructive. Dialog and Sheet are controlled overlays — render them with `open` + `onClose` (no trigger prop); compose their Header/Body/Footer children. Selects are native `<option>` children.

Before styling anything custom, read `styles.css` (tokens at the top) and the per-component `.prompt.md` docs.

## Idiomatic snippet

```tsx
<div className="min-h-screen bg-background p-6 text-foreground">
  <Card className="w-96">
    <CardHeader>
      <CardTitle>postgres-primary</CardTitle>
      <CardDescription>Stateful · namespace zeta-data</CardDescription>
    </CardHeader>
    <CardContent className="flex items-center gap-2 text-sm">
      <Badge variant="success">running</Badge>
      <span className="text-muted-foreground">last check 20s ago</span>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm" variant="outline" className="flex-1">Logs</Button>
      <Button size="sm" className="flex-1">Open console</Button>
    </CardFooter>
  </Card>
</div>
```
