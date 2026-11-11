import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compile, type Diagnostic } from "../src/compile.js";
import { sha256 } from "../src/hash.js";

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const js = (name: string): string => {
  const id = name.replace(/\.ts$/, "");
  const r = compile([{ id, source: fixture(name) }]);
  if (!("outputs" in r)) throw new Error(JSON.stringify(r.diagnostics));
  return r.outputs.get(`/src/${id}.js`)!;
};

const diagnosticsOf = (scripts: { id: string; source: string }[]): Diagnostic[] => {
  const r = compile(scripts);
  if (!("diagnostics" in r)) throw new Error("型が通ってしまった");
  return r.diagnostics;
};

describe("compile", () => {
  it("型が通る TS は、型だけ消えてコメントの残った JS になる", () => {
    const out = js("good.ts");
    expect(out).toContain("/** doc comment stays? */");
    expect(out).toContain("// line comment");
    expect(out).toContain("// trailing");
    expect(out).not.toContain("satisfies");
    expect(out).not.toContain("interface Report");
    // module ではない script なので export {} は付かない (付くと page.evaluate で構文エラー)
    expect(out).not.toContain("export");
  });

  it("0 本なら診断も出力も無い (受け皿の型だけの program)", () => {
    // capture-ledger の `scriptIds: []`。空を「通った」と言う —— 診断ではなく、空の outputs
    const r = compile([]);
    expect("outputs" in r ? r.outputs.size : r.diagnostics).toBe(0);
  });

  it("同じ TS からは同じバイト列が出る (前の測定で固定した sha256)", () => {
    // typescript の版か compilerOptions を変えると、ここが最初に赤くなる。それが狙い ——
    // WACZ に残る JS の hash が黙って変わらないように
    expect(sha256(js("good.ts"))).toBe(
      "2d6bcc4cc113656e2cd977b758c0fc60c64844f5af24111bd88173c0998cd5a1",
    );
  });

  it("defineParams と受け皿の secrets を読む TS が通り、undefined を見ない読み方と __bh.vars は型で捕まる", () => {
    // capture-scripts v0.11.0 の host.d.ts から。古い写しだと defineParams が無い (TS2304) ので、
    // この試験は写しがどの版かも言う
    const out = js("with-values.ts");
    expect(out).toContain("globalThis.__bh.vars");
    expect(out).not.toContain("defineParams(");
    expect(out).toContain("__bh.secrets.api_token");
    const [unguarded] = diagnosticsOf([
      { id: "unguarded", source: "const n: number = globalThis.__bh.secrets.a.length;\n" },
    ]);
    expect(unguarded?.code).toBe("TS18048");
    const direct = diagnosticsOf([
      { id: "direct", source: "const q = globalThis.__bh.vars.query;\nvoid q;\n" },
    ]).map((d) => d.code);
    expect(direct).toContain("TS2339");
  });

  it("受け皿の log を使う TS が通り、id を渡す古い report は型で捕まる", () => {
    // capture-scripts v0.7.0 の host.d.ts から。古い写し (report(id, data) で log が無い) だと
    // log が TS2339 になり、2 引数の report が通るので、この試験は写しがどの版かも言う
    const out = js("with-log.ts");
    for (const level of ["debug", "info", "warn", "error"]) {
      expect(out).toContain(`globalThis.__bh.log.${level}(`);
    }
    const codesOf = (source: string): string[] =>
      diagnosticsOf([{ id: "old", source }]).map((d) => d.code);
    // 引数が 1 つ多い
    expect(codesOf('globalThis.__bh.report("old", { n: 1 });\n')).toEqual(["TS2554"]);
    // id だけの取り残し。data が unknown なら通ってしまう (object にした理由)
    expect(codesOf('globalThis.__bh.report("old");\n')).toEqual(["TS2345"]);
  });

  it("型が通らなければ 1 本も返さず、行と列つきの diagnostics になる", () => {
    const diagnostics = diagnosticsOf([
      { id: "good", source: fixture("good.ts") },
      { id: "bad", source: fixture("bad.ts") },
    ]);
    expect(diagnostics.map((d) => `${d.code}@${d.file ?? "?"}:${String(d.line)}`)).toEqual([
      "TS2322@bad.ts:3",
      "TS2551@bad.ts:4",
    ]);
    expect(diagnostics[0]?.col).toBe(9);
  });

  it("受け皿の綴り違いは型で捕まる (remaining → remainingMs)", () => {
    const [, missing] = diagnosticsOf([{ id: "bad", source: fixture("bad.ts") }]);
    expect(missing?.message).toContain("Did you mean 'remainingMs'?");
  });

  it("enum は erasableSyntaxOnly で拒む —— 剥がして消えない構文は通さない", () => {
    expect(
      diagnosticsOf([{ id: "with-enum", source: fixture("with-enum.ts") }]).map((d) => d.code),
    ).toEqual(["TS1294"]);
  });

  it("2 本が同じ名前を top-level に置けば赤くなる (script は global を共有する)", () => {
    const codes = diagnosticsOf([
      { id: "a", source: "const shared = 1;\n" },
      { id: "b", source: "const shared = 2;\n" },
    ]).map((d) => d.code);
    expect(codes).toContain("TS2451");
  });
});
