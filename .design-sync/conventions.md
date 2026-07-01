# Zeta Portal UI — build conventions

Dark-only, Linear/Vercel-style console UI. React + Tailwind utilities backed by HSL tokens. No provider is required — tokens live on `:root` in `styles.css`.

**Surface rule (the one thing that silently breaks):** the app normally sets the page surface on `<body>`. Give every screen you build a root wrapper: `<div className="min-h-screen bg-background text-foreground">…</div>`. Without it, content sits on white and looks broken. Type is Inter Variable (ships with the bundle); don't set font families beyond `font-sans` / `font-mono`.

## Styling idiom — Tailwind utilities with these token names

| Family               | Classes                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page/panel surfaces  | `bg-background`, `bg-surface` (raised panel), `bg-card`, `bg-popover`                                                                                 |
| Text                 | `text-foreground`, `text-muted-foreground`, `text-primary`, `text-success`, `text-warning`, `text-destructive`                                        |
| Borders              | `border` (defaults to hairline `border-border`), `border-border-strong`, `border-input`                                                               |
| Actions/status fills | `bg-primary text-primary-foreground`, `bg-secondary text-secondary-foreground`, `bg-muted`, `bg-accent`, `bg-destructive`, `bg-success`, `bg-warning` |
| Focus                | `focus-visible:ring-2 ring-ring`                                                                                                                      |
| Radius               | `rounded-sm` / `rounded-md` / `rounded-lg` (token `--radius`), `rounded-xl` for modal panels                                                          |
| Motion               | `animate-fade-in`, `animate-slide-in-right`, `animate-scale-in`                                                                                       |

The stylesheet is compiled with a safelist of standard spacing/size/type/layout scales plus every token color above. Arbitrary values (`w-[37px]`) and ad-hoc opacity modifiers (`bg-primary/40`) are NOT generated — stay on the scales; for something exotic use `style={{ background: "hsl(var(--surface))" }}` with any `--token` from `styles.css`.

## Component API cheatsheet

- `Button` — `variant`: default | secondary | outline | ghost | link | success | destructive; `size`: default | sm | lg | icon.
- `Badge` — `variant`: default | secondary | outline | success | warning | destructive.
- `Dialog` / `Sheet` — controlled: `open` + `onClose`; compose `DialogHeader/DialogTitle/DialogDescription/DialogBody/DialogFooter` (Sheet: `SheetHeader/SheetTitle/SheetBody`). Sheet is a right-side drawer.
- `Tabs` — `defaultValue` (or `value` + `onValueChange`) wrapping `TabsList > TabsTrigger` and `TabsContent value=…`.
- `Input`, `Textarea`, `Select` (native props) pair with `Label htmlFor`.
- `HealthDot` — `health`: ready | progressing | error | unknown, optional `label`.
- `PersonaAvatar` — `id`; `kind`: human (filled) | persona (outlined); `size`: sm | md.
- `MetricChart` — `data: number[]`, `max`, `label`, `value`, optional `sub`, `color` (a `text-*` class drives the stroke), `height`.

## Where the truth lives

Read `styles.css` (tokens + `@import "./_ds_bundle.css"`) before inventing a color; each component ships `<Name>.d.ts` (exact props) and `<Name>.prompt.md` (usage).

## Idiomatic snippet

```tsx
<div className="min-h-screen bg-background p-6 text-foreground">
  <Card className="w-96">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>zeta-api</CardTitle>
        <Badge variant="success">Ready</Badge>
      </div>
      <CardDescription>Production · us-east-1 · 3 replicas</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">Last deploy rolled out 12 minutes ago.</p>
    </CardContent>
    <CardFooter className="justify-end gap-2">
      <Button variant="ghost" size="sm">
        View logs
      </Button>
      <Button size="sm">Open console</Button>
    </CardFooter>
  </Card>
</div>
```
