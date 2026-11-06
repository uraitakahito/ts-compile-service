import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { BoundedCache } from "../src/cache.js";
import { compile, type Diagnostic } from "../src/compile.js";
import { sha256 } from "../src/hash.js";
import { createService } from "../src/service.js";

/**
 * `defineParams` の宣言と、渡した名前の照合 (CAPTURE-20)。`query` を渡さなければ compile が止める。
 *
 * 宣言は構文木から読むので、ここで見るのは「読める形を読み、読めない形を断り、走らせない」こと。必須の判定は
 * cache の外なので、順を変えて頼む試験がいちばん効く —— 判定が cache の中に入ると、前のクロールが名前つきで
 * 通した TS に、名前の無いクロールが素通りする。
 */
const fresh = () =>
  createService({ compile, cache: new BoundedCache(8), typescript: "6.0.3", hostTypes: "v0" });

type Service = ReturnType<typeof fresh>;

const script = (id: string, source: string, phase: "behavior" | "preload" = "behavior") => ({
  id,
  version: 1,
  phase,
  source,
  sha256: sha256(source),
  options: {},
});

const ask = (
  service: Service,
  source: string,
  variableNames: string[] = [],
  phase: "behavior" | "preload" = "behavior",
) => service.Compile({ variableNames, scripts: [script("s", source, phase)] }, {});

interface Failed {
  diagnostics: Diagnostic[];
  declarations: { id: string; params: { name: string }[]; unreadable: boolean }[];
  missingVariables: string[];
}

const failure = async (p: Promise<unknown>): Promise<Failed> => {
  try {
    await p;
  } catch (error) {
    return error as Failed;
  }
  throw new Error("通ってしまった");
};

const codesOf = (source: string): string[] => {
  const r = compile([{ id: "s", source }]);
  if (!("diagnostics" in r)) throw new Error("通ってしまった");
  return r.diagnostics.map((d) => d.code);
};

const jsOf = (source: string): string => {
  const r = compile([{ id: "s", source }]);
  if (!("outputs" in r)) throw new Error(JSON.stringify(r.diagnostics));
  return r.outputs.get("/src/s.js") ?? "";
};

const Z = 'import { z } from "zod";\n';
const REQUIRED = `${Z}
(async () => {
  const { query } = defineParams(
    z.object({
      query: z.string().min(1).describe("検索語"),
    }),
  );
  globalThis.__bh.report({ query });
})();
`;

describe("必須の変数が渡されているか", () => {
  it("渡さなければ 422 で、誤りは宣言のその行を指す", async () => {
    const got = await failure(ask(fresh(), REQUIRED));
    expect(got.diagnostics).toEqual([
      {
        file: "s.ts",
        line: 6,
        col: 7,
        code: "BH0001",
        message: "必須の変数 query が渡されていない",
      },
    ]);
    expect(got.missingVariables).toEqual(["query"]);
  });

  it("渡せば 200 で、宣言が答えに載る", async () => {
    const got = await ask(fresh(), REQUIRED, ["query"]);
    expect(got.declarations).toEqual([
      {
        id: "s",
        unreadable: false,
        params: [
          {
            name: "query",
            kind: "variable",
            required: true,
            summary: "検索語",
            schema: { type: "string", minLength: 1 },
          },
        ],
      },
    ]);
  });

  it("渡す → 渡さない → 渡す の順で 200・422・200 —— JS は使い回すが、足りるかは要求ごと", async () => {
    const service = fresh();
    expect((await ask(service, REQUIRED, ["query"])).cached).toBe(false);
    const missing = await failure(ask(service, REQUIRED, []));
    expect(missing.missingVariables).toEqual(["query"]);
    // 対照: 3 回目が cache に当たる。上の 422 が JS を作り直した結果ではないと言えるのはこのため
    expect((await ask(service, REQUIRED, ["query"])).cached).toBe(true);
  });

  it("渡さない → 渡す → 渡さない の順でも 422・200・422", async () => {
    const service = fresh();
    expect((await failure(ask(service, REQUIRED, []))).missingVariables).toEqual(["query"]);
    expect((await ask(service, REQUIRED, ["query"])).cached).toBe(true);
    expect((await failure(ask(service, REQUIRED, []))).missingVariables).toEqual(["query"]);
  });

  it("任意の変数は渡さなくても 200", async () => {
    const got = await ask(
      fresh(),
      `${Z}const { limit } = defineParams(z.object({ limit: z.string().optional() }));\nvoid limit;\n`,
    );
    expect(got.declarations?.[0]?.params?.[0]?.required).toBe(false);
  });

  it("@ts-nocheck でも、必須の変数を渡さなければ止まる", async () => {
    const got = await failure(ask(fresh(), `// @ts-nocheck\n${REQUIRED}`));
    expect(got.diagnostics.map((d) => d.code)).toEqual(["BH0001"]);
  });

  it("型の誤りと一緒でも、足りない名前を言う —— 台帳は行を立てる前に断れる", async () => {
    const got = await failure(
      ask(
        fresh(),
        `${Z}const { query } = defineParams(z.object({ query: z.string() }));\nconst n: number = query;\nvoid n;\n`,
      ),
    );
    expect(got.diagnostics.map((d) => d.code).sort()).toEqual(["BH0001", "TS2322"]);
    expect(got.missingVariables).toEqual(["query"]);
  });

  it("2 本が同じ名前を別の形で宣言していても、ここでは断らない (断るのは台帳)", async () => {
    const got = await fresh().Compile(
      {
        variableNames: ["q"],
        scripts: [
          script("a", `${Z}const { q } = defineParams(z.object({ q: z.string() }));\nvoid q;\n`),
          script(
            "b",
            `${Z}const { q } = defineParams(z.object({ q: z.string().min(1) }));\nvoid q;\n`,
          ),
        ],
      },
      {},
    );
    expect(got.declarations?.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("cache に当たっても、宣言の id はいまの要求の物", async () => {
    const service = fresh();
    await service.Compile({ variableNames: ["query"], scripts: [script("a", REQUIRED)] }, {});
    const again = await service.Compile(
      { variableNames: ["query"], scripts: [script("b", REQUIRED)] },
      {},
    );
    expect(again.cached).toBe(true);
    expect(again.declarations?.[0]?.id).toBe("b");
  });
});

describe("宣言を読めないとき", () => {
  it.each([
    [".refine", 'z.string().refine((v) => v !== "x")'],
    [".default", 'z.string().default("x")'],
    [".regex", "z.string().regex(/x/)"],
    ["z.number", "z.number()"],
    ["入れ子", "z.object({ b: z.string() })"],
  ])("%s は BH0002", (_name, value) => {
    expect(codesOf(`${Z}const v = defineParams(z.object({ a: ${value} }));\nvoid v;\n`)).toContain(
      "BH0002",
    );
  });

  it("変数で渡すと BH0002", () => {
    expect(
      codesOf(`${Z}const S = z.object({ a: z.string() });\nconst v = defineParams(S);\nvoid v;\n`),
    ).toEqual(["BH0002"]);
  });

  it("2 回呼ぶと BH0002", () => {
    expect(
      codesOf(
        `${Z}const a = defineParams(z.object({ a: z.string() }));\nconst b = defineParams(z.object({ b: z.string() }));\nvoid a;\nvoid b;\n`,
      ),
    ).toEqual(["BH0002"]);
  });

  it("大文字の名前は BH0002", () => {
    expect(
      codesOf(
        `${Z}const { Query } = defineParams(z.object({ Query: z.string() }));\nvoid Query;\n`,
      ),
    ).toEqual(["BH0002"]);
  });

  it("引数の式は走らせない —— process.exit を呼ぶ形が BH0002 で返り、service は生きている", async () => {
    const service = fresh();
    const got = await failure(
      ask(
        service,
        `// @ts-nocheck\n${Z}const v = defineParams(z.object({ q: z.string().min((() => { process.exit(1); return 1; })()) }));\nvoid v;\n`,
      ),
    );
    expect(got.diagnostics.map((d) => d.code)).toEqual(["BH0002"]);
    expect(got.declarations).toEqual([{ id: "s", params: [], unreadable: true }]);
    expect((await ask(service, REQUIRED, ["query"])).cached).toBe(false);
  });
});

describe("__bh.vars の直読み", () => {
  it.each([
    ["__bh.vars", "const q = __bh.vars.query;\nvoid q;\n"],
    ["globalThis.__bh.vars", "const q = globalThis.__bh.vars.query;\nvoid q;\n"],
    ["分割代入", "const { vars } = globalThis.__bh;\nvoid vars;\n"],
    ["[] で読む", 'const q = globalThis.__bh["vars"].query;\nvoid q;\n'],
  ])("%s は @ts-nocheck でも BH0005", (_name, source) => {
    expect(codesOf(`// @ts-nocheck\n${source}`)).toEqual(["BH0005"]);
  });

  it("__bh.secrets と、関係の無い vars は断らない", () => {
    expect(
      jsOf(
        "const other = { vars: 1 };\nglobalThis.__bh.report({ a: other.vars, b: globalThis.__bh.secrets.x });\n",
      ),
    ).toContain("__bh.secrets.x");
  });
});

describe("型は本物の Zod から付く", () => {
  it("読む名前の綴り違いは TS2339", () => {
    expect(
      codesOf(
        `${Z}const { qurey } = defineParams(z.object({ query: z.string() }));\nvoid qurey;\n`,
      ),
    ).toEqual(["TS2339"]);
  });

  it("任意の値をそのまま使うと TS18048", () => {
    expect(
      codesOf(
        `${Z}const { limit } = defineParams(z.object({ limit: z.string().optional() }));\nvoid limit.length;\n`,
      ),
    ).toEqual(["TS18048"]);
  });

  it(".min の引数の型は TS2345", () => {
    expect(codesOf(`${Z}defineParams(z.object({ q: z.string().min("x") }));\n`)).toContain(
      "TS2345",
    );
  });

  it("enum は字の和になる", () => {
    expect(
      jsOf(
        `${Z}const { mode } = defineParams(z.object({ mode: z.enum(["a", "b"]) }));\nconst m: "a" | "b" = mode;\nvoid m;\n`,
      ),
    ).toContain("globalThis.__bh.vars");
  });

  it("zod/mini の schema は渡せない (TS2345)", () => {
    expect(
      codesOf(`import * as z from "zod/mini";\ndefineParams(z.object({ q: z.string() }));\n`),
    ).toContain("TS2345");
  });
});

describe("出る JS", () => {
  it("z を宣言の中でしか読まなければ Zod は入らず、defineParams は受け皿を読む形になる", () => {
    const js = jsOf(REQUIRED);
    expect(js).not.toContain("__bhZod");
    expect(js).not.toContain("defineParams");
    expect(js).toContain("const { query } = globalThis.__bh.vars;");
    expect(Buffer.byteLength(js)).toBeLessThan(400);
  });

  it("ページの中でも読めば、使う名前だけが入る。宣言の分は数えない", () => {
    const js = jsOf(`${Z}
(async () => {
  const { query } = defineParams(z.object({ query: z.enum(["a"]) }));
  globalThis.__bh.report(z.object({ q: z.string() }).parse({ q: query }));
})();
`);
    expect(js).toContain("__bhZod");
    const bytes = Buffer.byteLength(js);
    expect(bytes).toBeGreaterThan(60_000);
    expect(bytes).toBeLessThan(120_000);
  });

  it("ページの中で、渡した値を読める", async () => {
    const reports: unknown[] = [];
    const context = vm.createContext({
      __bh: { vars: { query: "個人情報" }, report: (data: unknown) => reports.push(data) },
    });
    await vm.runInContext(jsOf(REQUIRED), context);
    expect(reports).toEqual([{ query: "個人情報" }]);
  });
});

describe("preload の defineParams", () => {
  it("同じ TS を behavior → preload の順で頼むと 200 → 422 (BH0004)", async () => {
    const service = fresh();
    await ask(service, REQUIRED, ["query"]);
    const got = await failure(ask(service, REQUIRED, ["query"], "preload"));
    expect(got.diagnostics.map((d) => d.code)).toEqual(["BH0004", "BH0004"]);
    expect(got.diagnostics[1]?.message).toContain("defineParams");
  });
});
