# Zeta portal — Bun server (BFF + static Fluent UI). Non-root, no build step.
FROM oven/bun:1.3.14-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production
COPY src ./src
USER bun
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["bun", "run", "src/server.ts"]
