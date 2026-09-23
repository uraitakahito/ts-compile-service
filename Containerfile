# syntax=docker/dockerfile:1.7
#
# ts-compile-service の runtime image。
#
# Build:  container build -t ts-compile-service:dev -f Containerfile .
# Run:    container run --rm -p 127.0.0.1:8080:8080 ts-compile-service:dev
#         curl http://127.0.0.1:8080/healthz
#
# runtime に入るのは prod の依存と dist と、受け皿の型の写しだけ。**JVM も Smithy CLI も入らない** ——
# 生成物 (generated/) は commit されていて、build 段が tsc で JS にする。
#
# 3 段 (capture-ledger と同じ形):
#   deps     prod の依存だけを hoisted で入れる (runtime には pnpm の store が無いので、symlink では届かない)
#   builder  全部の依存を入れて tsc
#   runtime  node:alpine に node_modules と dist を写す

ARG NODE_VERSION=24.15.0

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
RUN corepack enable && corepack prepare --activate \
  && pnpm install --prod --frozen-lockfile --node-linker=hoisted

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json tsconfig.json tsconfig.build.json ./
RUN corepack enable && corepack prepare --activate && pnpm install --frozen-lockfile
COPY src/ ./src/
COPY generated/ ./generated/
RUN pnpm run build

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# 本体が cwd から読む 2 つ (src/paths.ts)。受け皿の型の写しと、それがどの capture-scripts の tag かの印
COPY types/host.d.ts ./types/host.d.ts
COPY capture-scripts.pin package.json ./
EXPOSE 8080
USER node
CMD ["node", "dist/src/main.js"]
