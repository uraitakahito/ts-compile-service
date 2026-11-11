import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { BoundedCache } from "../src/cache.js";
import { compile, type Diagnostic } from "../src/compile.js";
import { sha256 } from "../src/hash.js";
import { createService } from "../src/service.js";

/**
 * `import { z } from "zod"` のあるスクリプトの JS を、ブラウザなしで確かめる。
 *
 * `node:vm` の context に、BrowserHive が見せる物の代役を置いて JS を走らせる。`Function` は Proxy に替えて
 * 呼ばれた数を数える —— Zod の JIT は `new Function` を呼ぶので、厳しい CSP のページで投げるかどうかが、
 * ブラウザが無くても数で分かる。本物の Chromium と CSP での確かめは capture-scheduler の e2e に在る。
 */
interface Page {
  run: (js: string) => unknown;
  reports: unknown[];
  logged: unknown[];
  functionCalls: () => number;
}

const page = (): Page => {
  const reports: unknown[] = [];
  const logged: unknown[] = [];
  const sandbox = {
    functionCalls: 0,
    document: { title: "題" },
    __bh: {
      report: (data: unknown) => reports.push(data),
      log: { error: (message: string, data: unknown) => logged.push([message, data]) },
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(
    `globalThis.Function = new Proxy(Function, {
       construct(target, args, next) { functionCalls++; return Reflect.construct(target, args, next); },
       apply(target, self, args) { functionCalls++; return Reflect.apply(target, self, args); },
     });`,
    context,
  );
  return {
    run: (js) => vm.runInContext(js, context) as unknown,
    reports,
    logged,
    functionCalls: () => sandbox.functionCalls,
  };
};

const jsOf = (source: string, id = "s"): string => {
  const r = compile([{ id, source }]);
  if (!("outputs" in r)) throw new Error(JSON.stringify(r.diagnostics));
  const js = r.outputs.get(`/src/${id}.js`);
  if (js === undefined) throw new Error(`${id} の JS が無い`);
  return js;
};

const problemsOf = (source: string): Diagnostic[] => {
  const r = compile([{ id: "s", source }]);
  if (!("diagnostics" in r)) throw new Error("通ってしまった");
  return r.diagnostics;
};

const codesOf = (source: string): string[] => problemsOf(source).map((d) => d.code);

const bytesOf = (text: string): number => Buffer.byteLength(text, "utf8");

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const Z = 'import { z } from "zod";\n';
const PARSES = `${Z}(async () => {
  const S = z.object({ q: z.string() });
  await Promise.resolve();
  globalThis.__bh.report(S.parse({ q: "x" }));
})();
`;

describe("組み上げた JS がページの中でどう動くか", () => {
  it("new Function を呼ばずに parse が通る —— 厳しい CSP のページで投げず、相手のサイトへ報告も飛ばない", async () => {
    const p = page();
    await p.run(jsOf(PARSES));
    expect(p.reports).toEqual([{ q: "x" }]);
    expect(p.functionCalls()).toBe(0);
  });

  it("完了値が Promise のまま —— BrowserHive がスクリプトの終わりを待てる", () => {
    const value = page().run(jsOf(PARSES));
    expect(Object.prototype.toString.call(value)).toBe("[object Promise]");
  });

  it("strict で走る —— 未宣言への代入が投げる", () => {
    const js = jsOf(`// @ts-nocheck\n${Z}undeclared = z.string();\n`);
    expect(js.startsWith('"use strict";\n')).toBe(true);
    expect(() => page().run(js)).toThrow(/undeclared is not defined/);
  });

  it("記録に Zod の版が残り、import も export も残らない", () => {
    const js = jsOf(PARSES);
    expect(js).toContain("// zod 4.6.7 (MIT)\n");
    expect(js).not.toMatch(/^import /m);
    expect(js).not.toMatch(/^export /m);
  });

  it("safeParse の失敗は投げず、項目の名前がログに残る", async () => {
    const p = page();
    await p.run(
      jsOf(`${Z}(async () => {
  const parsed = z.object({ hits: z.number() }).safeParse({ hits: "x" });
  if (!parsed.success) globalThis.__bh.log.error("形が違う", z.treeifyError(parsed.error));
})();
`),
    );
    expect(JSON.stringify(p.logged)).toContain('"hits"');
  });

  it("2 本が同じ名前を top-level に置いても、順に走らせてぶつからない", async () => {
    const source = `${Z}const shared = z.string();\n(async () => { globalThis.__bh.report({ ok: shared.parse("x") }); })();\n`;
    const r = compile([
      { id: "a", source },
      { id: "b", source },
    ]);
    if (!("outputs" in r)) throw new Error(JSON.stringify(r.diagnostics));
    const p = page();
    await p.run(r.outputs.get("/src/a.js")!);
    await p.run(r.outputs.get("/src/b.js")!);
    expect(p.reports).toEqual([{ ok: "x" }, { ok: "x" }]);
  });

  it("zod/mini も同じ形で動く", async () => {
    const p = page();
    await p.run(
      jsOf(`import * as z from "zod/mini";
(async () => { globalThis.__bh.report(z.object({ q: z.string() }).parse({ q: "x" })); })();
`),
    );
    expect(p.reports).toEqual([{ q: "x" }]);
    expect(p.functionCalls()).toBe(0);
  });
});

describe("JS の大きさとバイト列", () => {
  it("使う名前だけが入る", () => {
    // 全部入りは 385 KB。名前を集める処理が壊れると、ここが最初に赤くなる
    const bytes = bytesOf(jsOf(PARSES));
    expect(bytes).toBeGreaterThan(60_000);
    expect(bytes).toBeLessThan(120_000);
  });

  it("zod/mini は小さい", () => {
    const js = jsOf(`import * as z from "zod/mini";\nz.object({ q: z.string() });\n`);
    expect(bytesOf(js)).toBeLessThan(30_000);
  });

  it("型の位置だけで読む z.infer は、JS の大きさを変えない", () => {
    const withType = `${Z}const S = z.object({ q: z.string() });\ntype T = z.infer<typeof S>;\nconst t: T = { q: "x" };\nS.parse(t);\n`;
    const without = `${Z}const S = z.object({ q: z.string() });\nconst t = { q: "x" };\nS.parse(t);\n`;
    expect(bytesOf(jsOf(withType))).toBe(bytesOf(jsOf(without)));
  });

  it("型の位置でしか読まなければ、Zod は入らない", () => {
    const js = jsOf(`${Z}type T = z.ZodString;\nconst t: T | undefined = undefined;\nvoid t;\n`);
    expect(js).not.toContain("__bhZod");
    expect(js.startsWith('"use strict";\n{\n')).toBe(true);
  });

  it("名前を読めない使い方は全部を束ね、ページの中で動く", async () => {
    const js = jsOf(`${Z}const name = "string" as const;
(async () => { globalThis.__bh.report({ q: z[name]().parse("x") }); })();
`);
    expect(bytesOf(js)).toBeGreaterThan(300_000);
    const p = page();
    await p.run(js);
    expect(p.reports).toEqual([{ q: "x" }]);
  });

  it("同じ TS からは同じバイト列が出る (前の測定で固定した sha256)", () => {
    // capture-ledger は段ごとの JS が同じかを sha256 で見る (mergeCompiled)。Zod か esbuild の版を上げると
    // ここが赤くなる。それが狙いで、JS が変わったことを知ってから値を直す
    expect(sha256(jsOf(fixture("with-zod.ts"), "with-zod"))).toBe(
      "50d63075911c37d55133d082ed030b4a90f3e444cc3a3e8554d218093639562b",
    );
  });

  it("import の無いスクリプトは、Zod の 1 本と並べても JS が変わらない", () => {
    const plain = "(async () => { globalThis.__bh.report({ a: 1 }); })();\n";
    const r = compile([
      { id: "plain", source: plain },
      { id: "zoded", source: PARSES },
    ]);
    if (!("outputs" in r)) throw new Error(JSON.stringify(r.diagnostics));
    expect(r.outputs.get("/src/plain.js")).toBe(jsOf(plain, "plain"));
  });
});

describe("import の形", () => {
  it.each([
    ["別名", 'import { z as zod } from "zod";\nzod.string();\n'],
    ["既定の import", 'import z from "zod";\nz.string();\n'],
    ["zod を名前空間で", 'import * as z from "zod";\nz.string();\n'],
    ["zod/mini を名前で", 'import { z } from "zod/mini";\nz.string();\n'],
    ["ほかの名前も一緒に", 'import { z, ZodError } from "zod";\nz.string();\nvoid ZodError;\n'],
    [
      "型だけ",
      'import type { ZodType } from "zod";\nconst t: ZodType | undefined = undefined;\nvoid t;\n',
    ],
    ["値を読まない", 'import "zod";\n'],
    ["2 行目の 2 つ目", `${Z}import * as m from "zod/mini";\nz.string();\nm.string();\n`],
    ["先頭の文でない", `const a = 1;\n${Z}z.string();\nvoid a;\n`],
    ["import()", '(async () => { await import("zod"); })();\n'],
  ])("%s は BH0003", (_name, source) => {
    expect(codesOf(source)).toContain("BH0003");
  });

  it("BH0003 は import の行を指す", () => {
    const [problem] = problemsOf('\n\nimport { z as zod } from "zod";\nzod.string();\n');
    expect(problem).toMatchObject({ file: "s.ts", line: 3, col: 1, code: "BH0003" });
  });

  it.each([
    ["型の外の package", 'import _ from "lodash";\nvoid _;\n'],
    ["zod の別の入口", 'import { ja } from "zod/locales";\nvoid ja;\n'],
    ["ほかのスクリプト", 'import { a } from "./other";\nvoid a;\n'],
  ])("%s は TS2307", (_name, source) => {
    expect(codesOf(source)).toEqual(["TS2307"]);
  });

  it("@ts-nocheck の次の行の import は通り、前のコメントは JS に残らない", () => {
    const js = jsOf(`// @ts-nocheck\n${Z}z.string();\n`);
    expect(js).not.toContain("@ts-nocheck");
    expect(js).toContain("__bhZod");
  });

  it("@ts-nocheck でも import の形の決まりは効く", () => {
    expect(codesOf(`// @ts-nocheck\nimport { z as zod } from "zod";\nzod.string();\n`)).toEqual([
      "BH0003",
    ]);
  });

  it("@ts-nocheck で読めない package は、JS に残るので BH0006 で止まる", () => {
    expect(codesOf('// @ts-nocheck\nimport _ from "lodash";\nvoid _;\n')).toEqual(["BH0006"]);
  });

  it("型は本物の Zod から付く", () => {
    const [problem] = problemsOf(`${Z}const n: number = z.string().parse("x");\nvoid n;\n`);
    expect(problem?.code).toBe("TS2322");
    expect(codesOf(`${Z}z.string().min("x");\n`)).toEqual(["TS2345"]);
  });
});

describe("classic script として読めるか", () => {
  it("export は BH0006 —— 型検査は通るが、ページでは構文エラーで何も走らない", () => {
    expect(codesOf("export const a = 1;\n")).toEqual(["BH0006"]);
  });

  it("import のあるスクリプトの top-level の await は BH0006", () => {
    const [problem] = problemsOf(`${Z}const s = await Promise.resolve(z.string());\nvoid s;\n`);
    expect(problem).toMatchObject({ file: "s.ts", code: "BH0006" });
    expect(problem?.message).toContain("classic script として読めない");
  });
});

describe("preload の import", () => {
  const fresh = () =>
    createService({ compile, cache: new BoundedCache(8), typescript: "6.0.3", hostTypes: "v0" });
  const request = (phase: "behavior" | "preload", source: string) => ({
    variableNames: [],
    scripts: [{ id: "s", version: 1, phase, source, sha256: sha256(source), options: {} }],
  });

  it("同じ TS を behavior → preload の順で頼むと 200 → 422 —— cache に当たっても断る", async () => {
    const service = fresh();
    const first = await service.Compile(request("behavior", PARSES), {});
    expect(first.cached).toBe(false);
    await expect(service.Compile(request("preload", PARSES), {})).rejects.toMatchObject({
      diagnostics: [{ file: "s.ts", line: 1, col: 1, code: "BH0004" }],
    });
    // 対照: 同じ TS の behavior は cache に当たる。上の 422 が cache の外からだと言えるのはこのため
    const again = await service.Compile(request("behavior", PARSES), {});
    expect(again.cached).toBe(true);
  });

  it("preload → behavior の順でも、preload だけを断る", async () => {
    const service = fresh();
    await expect(service.Compile(request("preload", PARSES), {})).rejects.toMatchObject({
      diagnostics: [{ code: "BH0004" }],
    });
    const after = await service.Compile(request("behavior", PARSES), {});
    expect(after.scripts?.[0]?.source).toContain("__bhZod");
  });

  it("import の無い preload は今までどおり通る", async () => {
    const source = "document.title;\n";
    const answer = await fresh().Compile(request("preload", source), {});
    expect(answer.scripts?.[0]?.phase).toBe("preload");
  });
});
