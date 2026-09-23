import { readFileSync } from "node:fs";
import ts from "typescript";
import { hostTypesPath } from "./paths.js";

/** 1 件の型エラー。`code` は "TS2322" の形、`line` と `col` は 1 始まり。 */
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
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
  types: [],
  strict: true,
  erasableSyntaxOnly: true,
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
 * ファイルを置かずに、{ id, source } の列を型検査して emit する。
 *
 * メモリ上の `{ /src/<id>.ts → source }` と受け皿の型を compiler host に見せ、lib だけ実物の
 * typescript から読む。全部を 1 つの program に入れるのは、スクリプト同士が global を共有する
 * (どれも module ではない) ことを型検査にも見せるため —— 同じ名前を 2 本が top-level に置けば赤くなる。
 *
 * 1 本でも赤ければ diagnostics だけを返す。途中まで通った目録は「通った」と区別が付かない。
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

  const program = ts.createProgram([...files.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(toDiagnostic);
  if (diagnostics.length > 0) return { diagnostics };
  program.emit();
  return { outputs };
};
