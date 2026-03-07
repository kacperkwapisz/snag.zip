# Stage 1: Install deps + build CSS
FROM oven/bun:1-slim AS build
WORKDIR /app
RUN bun add -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY src/ src/
RUN bunx @tailwindcss/cli -i src/styles.css -o public/styles.css --minify
RUN pnpm prune --prod

# Stage 2: Production runtime
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=build /app/node_modules node_modules/
COPY --from=build /app/public/styles.css public/styles.css
COPY package.json tsconfig.json ./
COPY src/ src/
COPY public/favicon.ico public/favicon.ico

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
