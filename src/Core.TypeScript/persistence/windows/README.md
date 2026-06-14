# Windows background-service loop

**Superseded** by the unified service system at `src/Core.TypeScript/service/`.

Use the unified CLI:

```bash
bun src/Core.TypeScript/service/service-manager-cli.ts install --persona otto
bun src/Core.TypeScript/service/service-manager-cli.ts status --persona otto
bun src/Core.TypeScript/service/service-manager-cli.ts uninstall --persona otto
```

The Task Scheduler adapter lives at `service/adapters/task-scheduler.ts`.
The XML template lives at `service/templates/task-scheduler.xml`.
