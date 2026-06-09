# Zeta portal — Bun server (BFF + room-service) serving the built React SPA.
# Stage 1 builds the web app (Vite → /app/dist); the runtime serves it static.
FROM oven/bun:1.3.14-alpine AS web
WORKDIR /app/web
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY web/ ./
RUN bun run build   # outputs to /app/dist

FROM oven/bun:1.3.14-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install --production
COPY src ./src
COPY --from=web /app/dist ./dist
USER bun
ENV PORT=8080
ENV ZETA_ROOMS_DIR=/var/lib/zeta-rooms
EXPOSE 8080
ENTRYPOINT ["bun", "run", "src/server.ts"]
