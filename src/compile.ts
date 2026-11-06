import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { hostTypesPath, repoRoot } from "./paths.js";
import { assemble, importProblems, isZodEntry, usedNames, zodEntryOf } from "./zod-bundle.js";

/**
 * 1 件の誤り。`code` は TypeScript の物が "TS2322" の形、この service の決まりが "BH0003" の形
 * (BH0003 `import` の形・BH0004 preload の `import`・BH0006 classic で読めない)。`line` と `col` は 1 始まり。
 */
export interface Diagnostic {
  file?: string;
  line?: number;
  col?: number;
  code: string;
  message: string;
}

export type Compiled =
  /** 1 本でも赤ければ、JS は 1 本も返さない */
  | { diagnostics: Diagnostic[] }
  /** 全部通った。鍵は `/src/<id>.js` */
  | { outputs: Map<string, string> };

/**
 * 受け皿 `__bh` の型。capture-scripts の `types/host.d.ts` の写し (どの tag の物かは
 * `capture-scripts.pin`)。**ここを直さない** —— 直すのは capture-scripts の側で、
 * CI の `host-types:check` が写しの一致を見る。
 */
const hostDts = readFileSync(hostTypesPath(), "utf8");

/**
 * capture-scripts の tsconfig.json と同じ厳しさ。**ここと向こうで違うと、向こうの CI で通った TS が
 * ここで 422 になる** (逆も)。lib は名前でなく file 名で書く (`createProgram` の流儀)。
 */
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
  types: [],
  strict: true,
  erasableSyntaxOnly: true,
  skipLibCheck: true,
  removeComments: false,
  newLine: ts.NewLineKind.LineFeed,
};

const toDiagnostic = (d: ts.Diagnostic): Diagnostic => {
  const where =
    d.file !== undefined && d.start !== undefined
      ? d.file.getLineAndCharacterOfPosition(d.start)
      : undefined;
  return {
    ...(d.file === undefined ? {} : { file: d.file.fileName.replace(/^\/src\//, "") }),
    ...(where === undefined ? {} : { line: where.line + 1, col: where.character + 1 }),
    code: `TS${String(d.code)}`,
    message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  };
};

/**
 * `/src/` は置き場の無い仮の場所なので、スクリプトの `import` は repo の根から引く。**引くのは zod の入口だけ**で、
 * ほかは TS2307 にする (`node_modules` に在る物を読めると、型は通るのにページでは動かない)。
 * zod の d.ts どうしの相対の import はふつうに解決する。
 */
const resolveModule = (name: string, containingFile: string): ts.ResolvedModuleFull | undefined => {
  if (!containingFile.startsWith("/src/")) {
    return ts.resolveModuleName(name, containingFile, options, ts.sys).resolvedModule;
  }
  if (!isZodEntry(name)) return undefined;
  return ts.resolveModuleName(name, join(repoRoot(), "package.json"), options, ts.sys)
    .resolvedModule;
};

/** 受ける形の `import` を JS から消す。Zod は組み上げで前に置く */
const dropZodImport: ts.TransformerFactory<ts.SourceFile> = (context) => (source) => {
  const [first] = source.statements;
  if (first === undefined || zodEntryOf(source) === undefined) return source;
  return context.factory.updateSourceFile(source, [
    context.factory.createNotEmittedStatement(first),
    ...source.statements.slice(1),
  ]);
};

/**
 * ページで classic script として読めない JS は、ここで止める。`export` と、`import` のある
 * スクリプトの top-level の `await` は型検査を通るが、`page.evaluate` では構文エラーになって何も走らない。
 * `vm.Script` は読むだけで、走らせない。
 */
const classicProblem = (id: string, js: string): Diagnostic | undefined => {
  try {
    new vm.Script(js);
    return undefined;
  } catch (error) {
    return {
      file: `${id}.ts`,
      code: "BH0006",
      message: `classic script として読めない: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * ファイルを置かずに、{ id, source } の列を型検査して emit する。
 *
 * メモリ上の `{ /src/<id>.ts → source }` と受け皿の型を compiler host に見せ、lib だけ実物の
 * typescript から読む。全部を 1 つの program に入れるのは、スクリプト同士が global を共有する
 * (どれも module ではない) ことを型検査にも見せるため —— 同じ名前を 2 本が top-level に置けば赤くなる。
 *
 * `import { z } from "zod"` のあるスクリプトは module になり、global を共有しない。JS では block に入るので、
 * 実行のときにもぶつからない (`zod-bundle.ts`)。
 *
 * 1 本でも赤ければ diagnostics だけを返す。途中まで通った並びは「通った」と区別が付かない。
 */
export const compile = (scripts: readonly { id: string; source: string }[]): Compiled => {
  const files = new Map<string, string>(scripts.map((s) => [`/src/${s.id}.ts`, s.source]));
  files.set("/src/host.d.ts", hostDts);
  const outputs = new Map<string, string>();

  const host = ts.createCompilerHost(options, true);
  // method を切り出して持つので bind する (this を失うと createCompilerHost の中で落ちる)
  const real = {
    getSourceFile: host.getSourceFile.bind(host),
    fileExists: host.fileExists.bind(host),
    readFile: host.readFile.bind(host),
  };
  host.getSourceFile = (fileName, languageVersion, onError) => {
    const text = files.get(fileName);
    return text === undefined
      ? real.getSourceFile(fileName, languageVersion, onError)
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  host.fileExists = (fileName) => files.has(fileName) || real.fileExists(fileName);
  host.readFile = (fileName) => files.get(fileName) ?? real.readFile(fileName);
  host.writeFile = (fileName, text) => {
    outputs.set(fileName, text);
  };
  host.getCurrentDirectory = () => "/src";
  host.resolveModuleNameLiterals = (literals, containingFile) =>
    literals.map((literal) => ({ resolvedModule: resolveModule(literal.text, containingFile) }));

  const program = ts.createProgram([...files.keys()], options, host);
  const sources = scripts.flatMap((s) => {
    const source = program.getSourceFile(`/src/${s.id}.ts`);
    return source === undefined ? [] : [{ id: s.id, source }];
  });
  const diagnostics = [
    ...ts.getPreEmitDiagnostics(program).map(toDiagnostic),
    ...sources.flatMap(({ id, source }) => importProblems(id, source)),
  ];
  if (diagnostics.length > 0) return { diagnostics };

  program.emit(undefined, undefined, undefined, false, { before: [dropZodImport] });
  for (const { id, source } of sources) {
    const entry = zodEntryOf(source);
    const emitted = outputs.get(`/src/${id}.js`);
    if (emitted === undefined) continue;
    const js = entry === undefined ? emitted : assemble(emitted, entry, usedNames(source));
    outputs.set(`/src/${id}.js`, js);
    const problem = classicProblem(id, js);
    if (problem !== undefined) diagnostics.push(problem);
  }
  return diagnostics.length > 0 ? { diagnostics } : { outputs };
};
