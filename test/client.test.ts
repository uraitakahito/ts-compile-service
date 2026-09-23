import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CompileCommand,
  CompileFailed,
  GetHealthCommand,
  SourceHashMismatch,
  TsCompileClient,
  ValidationException,
} from "../generated/client/index.js";
import { BoundedCache } from "../src/cache.js";
import { compile } from "../src/compile.js";
import { sha256 } from "../src/hash.js";
import { createHttpServer } from "../src/server.js";
import { createService } from "../src/service.js";

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const script = (id: string, source: string) => ({
  id,
  version: 1,
  phase: "behavior" as const,
  source,
  sha256: sha256(source),
  options: {},
});

/** 投げた物を値として受ける。投げなければ undefined。 */
const thrown = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

/**
 * 同じ model から生成した client で、生成した server を叩く (契約試験)。
 *
 * server.test.ts が見るのは HTTP の生の形 (status・header・JSON)。ここで見るのは「client が model どおりに
 * 読めるか」—— 手で書いた service.ts が model から外れれば、client の型付きの答え (output の member、
 * エラーの instanceof) でずれる。設定は endpoint だけ: AWS の codegen だが、region も credentials も要らない。
 */
describe("生成した client と生成した server は、同じ model を話す", () => {
  const server = createHttpServer(
    createService({
      compile,
      cache: new BoundedCache(8),
      typescript: "6.0.3",
      hostTypes: "v0.2.0",
    }),
  );
  let client: TsCompileClient;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    client = new TsCompileClient({ endpoint: `http://127.0.0.1:${String(port)}` });
  });
  afterAll(async () => {
    client.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GetHealth は何で変換するかを型付きで返す", async () => {
    const out = await client.send(new GetHealthCommand({}));
    expect(out).toMatchObject({ ok: true, typescript: "6.0.3", hostTypes: "v0.2.0" });
  });

  it("空の目録は Compile が 200 で、scripts は空 (ValidationException にならない)", async () => {
    const out = await client.send(new CompileCommand({ scripts: [] }));
    expect(out).toMatchObject({ typescript: "6.0.3", hostTypes: "v0.2.0", scripts: [] });
  });

  it("Compile は source と sha256 だけ JS にして、何で・何に向けて変換したかを付けて返す", async () => {
    const source = fixture("good.ts");
    const out = await client.send(new CompileCommand({ scripts: [script("good", source)] }));
    expect(out.typescript).toBe("6.0.3");
    expect(out.hostTypes).toBe("v0.2.0");
    expect(out.cached).toBe(false);
    const js = out.scripts?.[0];
    expect(js).toMatchObject({ id: "good", version: 1, phase: "behavior" });
    expect(js?.source).toContain("/** doc comment stays? */");
    expect(js?.sha256).toBe(sha256(js!.source!));
    expect(js?.sha256).not.toBe(sha256(source));
  });

  it("型が通らなければ CompileFailed の instance で、diagnostics が型付きで読める", async () => {
    const err = await thrown(
      client.send(new CompileCommand({ scripts: [script("bad", fixture("bad.ts"))] })),
    );
    expect(err).toBeInstanceOf(CompileFailed);
    const failed = err as CompileFailed;
    expect(failed.$metadata.httpStatusCode).toBe(422);
    expect(failed.typescript).toBe("6.0.3");
    expect(failed.diagnostics?.map((d) => d.code)).toEqual(["TS2322", "TS2551"]);
  });

  it("sha256 が source と合わなければ SourceHashMismatch の instance", async () => {
    const err = await thrown(
      client.send(
        new CompileCommand({
          scripts: [{ ...script("good", fixture("good.ts")), sha256: "0".repeat(64) }],
        }),
      ),
    );
    expect(err).toBeInstanceOf(SourceHashMismatch);
    const mismatch = err as SourceHashMismatch;
    expect(mismatch.$metadata.httpStatusCode).toBe(409);
    expect(mismatch.id).toBe("good");
  });

  it("形の違反は ValidationException で、fieldList に path が並ぶ", async () => {
    const err = await thrown(
      client.send(
        new CompileCommand({
          scripts: [{ id: "BAD_ID", version: 1, phase: "behavior", source: "x", sha256: "zz" }],
        }),
      ),
    );
    expect(err).toBeInstanceOf(ValidationException);
    const invalid = err as ValidationException;
    expect(invalid.$metadata.httpStatusCode).toBe(400);
    expect(invalid.fieldList?.map((f) => f.path)).toEqual(["/scripts/0/id", "/scripts/0/sha256"]);
  });
});
