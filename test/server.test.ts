import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BoundedCache } from "../src/cache.js";
import { compile, type Compiled } from "../src/compile.js";
import { sha256 } from "../src/hash.js";
import { createHttpServer } from "../src/server.js";
import { createService } from "../src/service.js";

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const script = (id: string, source: string) => ({
  id,
  version: 1,
  phase: "behavior",
  source,
  sha256: sha256(source),
  options: {},
});

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * 本物の port に起こして fetch で叩く。本体 (compile) は数えられる偽物で包み、
 * 「制約違反は本体に届く前に 400」を言えるようにする。
 */
describe("生成した server に本体を差す", () => {
  let base = "";
  let compileCalls = 0;
  const server = createHttpServer(
    createService({
      compile: (scripts): Compiled => {
        compileCalls++;
        return compile(scripts);
      },
      cache: new BoundedCache(8),
      typescript: "6.0.3",
      hostTypes: "v0.2.0",
    }),
  );

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    base = `http://127.0.0.1:${String(port)}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  const post = (body: unknown) =>
    fetch(`${base}/compile`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

  it("GET /healthz は何で変換するかを名乗る", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, typescript: "6.0.3", hostTypes: "v0.2.0" });
  });

  it("型が通る TS は 200 で、source と sha256 だけ JS になる。同じ並びの 2 回目は cache", async () => {
    const before = compileCalls;
    const first = await post({ scripts: [script("good", fixture("good.ts"))] });
    expect(first.status).toBe(200);
    const body = (await first.json()) as {
      typescript: string;
      hostTypes: string;
      cached: boolean;
      scripts: { id: string; version: number; phase: string; source: string; sha256: string }[];
    };
    expect(body.typescript).toBe("6.0.3");
    expect(body.hostTypes).toBe("v0.2.0");
    expect(body.cached).toBe(false);
    expect(body.scripts[0]).toMatchObject({ id: "good", version: 1, phase: "behavior" });
    expect(body.scripts[0]?.source).toContain("/** doc comment stays? */");
    expect(body.scripts[0]?.sha256).toBe(sha256(body.scripts[0]!.source));
    expect(compileCalls).toBe(before + 1);

    const second = await post({ scripts: [script("good", fixture("good.ts"))] });
    expect(((await second.json()) as { cached: boolean }).cached).toBe(true);
    expect(compileCalls).toBe(before + 1);
  });

  it("model の制約に外れた入力は、本体に届く前に 400 になる", async () => {
    const before = compileCalls;
    const res = await post({
      scripts: [{ id: "BAD_ID", version: 1, phase: "behavior", source: "x", sha256: "zz" }],
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("x-amzn-errortype")).toBe("ValidationException");
    const body = (await res.json()) as { fieldList: { path: string }[] };
    expect(body.fieldList.map((f) => f.path)).toEqual(["/scripts/0/id", "/scripts/0/sha256"]);
    expect(compileCalls).toBe(before);
  });

  it("空の scripts は 200 で何もしない —— 何で・何に向けて変換するかは付く。2 回目は cache", async () => {
    // 台帳が「何も走らせない」(scriptIds: []) と決めたクロールの段。変換する物は無いが、
    // 報告には typescript と hostTypes が要る。本体の経路は空をそのまま通す (特別扱いは無い)
    const before = compileCalls;
    const first = await post({ scripts: [] });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      typescript: "6.0.3",
      hostTypes: "v0.2.0",
      cached: false,
      scripts: [],
    });
    expect(compileCalls).toBe(before + 1);

    const second = await post({ scripts: [] });
    expect(((await second.json()) as { cached: boolean }).cached).toBe(true);
    expect(compileCalls).toBe(before + 1);
  });

  it("sha256 が source と合わなければ 409。変換しない", async () => {
    const before = compileCalls;
    const res = await post({
      scripts: [{ ...script("good", fixture("good.ts")), sha256: "0".repeat(64) }],
    });
    expect(res.status).toBe(409);
    expect(res.headers.get("x-amzn-errortype")).toBe("SourceHashMismatch");
    expect(await res.json()).toEqual({ id: "good", message: "good: sha256 が台帳の約束と違う" });
    expect(compileCalls).toBe(before);
  });

  it("型が通らなければ 422 と diagnostics。1 本も返さない", async () => {
    const res = await post({
      scripts: [script("good", fixture("good.ts")), script("bad", fixture("bad.ts"))],
    });
    expect(res.status).toBe(422);
    expect(res.headers.get("x-amzn-errortype")).toBe("CompileFailed");
    const body = (await res.json()) as {
      message: string;
      typescript: string;
      diagnostics: { code: string; file: string; line: number }[];
      scripts?: unknown;
    };
    expect(body.scripts).toBeUndefined();
    expect(body.typescript).toBe("6.0.3");
    expect(body.diagnostics.map((d) => `${d.code}@${d.file}:${String(d.line)}`)).toEqual([
      "TS2322@bad.ts:3",
      "TS2551@bad.ts:4",
    ]);
  });

  it("知らない経路と知らない method は 404", async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/compile`, { method: "DELETE" })).status).toBe(404);
  });
});
