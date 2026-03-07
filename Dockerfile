# Stage 1: Install all dependencies (needed for CSS build)
FROM oven/bun:1 AS deps
WORKDIR /app
RUN bun add -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build CSS
FROM deps AS build
COPY src/ src/
RUN bunx @tailwindcss/cli -i src/styles.css -o public/styles.css --minify

# Stage 3: Production runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app

RUN bun add -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && \
    rm -rf /root/.local/share/pnpm/store

COPY src/ src/
COPY public/favicon.ico public/favicon.ico
COPY --from=build /app/public/styles.css public/styles.css
COPY tsconfig.json ./

RUN mkdir -p /data && \
    groupadd --system --gid 1001 snag && \
    useradd --system --uid 1001 --gid snag --no-create-home snag && \
    chown snag:snag /data

USER snag

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/snag.db
ENV PORT=3000

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
