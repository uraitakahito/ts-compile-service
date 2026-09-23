import { BoundedCache } from "./cache.js";
import { compile } from "./compile.js";
import { createHttpServer } from "./server.js";
import { createService } from "./service.js";
import { HOST_TYPES, TS_VERSION } from "./version.js";

/**
 * 起動。設定は env の 3 つだけ。
 *
 *   PORT                  待ち受け port (既定 8080)
 *   HOST                  待ち受けアドレス (既定 0.0.0.0。コンテナの中で呼ばれる物なので閉じない)
 *   TS_COMPILE_CACHE_MAX  同じ TS の並びを覚えておく件数 (既定 256)
 */
const integer = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} は 0 以上の整数: ${raw}`);
  return value;
};

const port = integer("PORT", 8080);
const host = process.env.HOST ?? "0.0.0.0";
const cacheMax = integer("TS_COMPILE_CACHE_MAX", 256);

const server = createHttpServer(
  createService({
    compile,
    cache: new BoundedCache(cacheMax),
    typescript: TS_VERSION,
    hostTypes: HOST_TYPES,
  }),
);

server.listen(port, host, () => {
  console.log(
    `ts-compile-service on ${host}:${String(port)} (typescript ${TS_VERSION}, host types ${HOST_TYPES}, cache ${String(cacheMax)})`,
  );
});

// コンテナは SIGTERM で止められる。受け付けを閉じ、進行中の応答を待ってから抜ける
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 5_000).unref();
  });
}
