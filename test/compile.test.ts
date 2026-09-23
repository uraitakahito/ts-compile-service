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

  it("同じ TS からは同じバイト列が出る (前の測定で固定した sha256)", () => {
    // typescript の版か compilerOptions を変えると、ここが最初に赤くなる。それが狙い ——
    // WACZ に残る JS の hash が黙って変わらないように
    expect(sha256(js("good.ts"))).toBe(
      "f9bf89ea9a05683a948b30141eb6327f45439a41d795ec86bd2b68e6496d1708",
    );
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
