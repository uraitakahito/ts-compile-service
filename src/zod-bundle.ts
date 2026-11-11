import { buildSync } from "esbuild";
import ts from "typescript";
import { BoundedCache } from "./cache.js";
import type { Diagnostic } from "./compile.js";
import { repoRoot } from "./paths.js";
import { readParams } from "./vendor/read-params.js";
import { ZOD_VERSION } from "./version.js";

/**
 * スクリプトの `import` の決まりと、Zod の束ね方。
 *
 * BrowserHive は JS を classic script として `page.evaluate` に渡すので、JS に `import` は書けない。
 * `import` を消し、Zod の部分だけを esbuild で束ねて、スクリプトの前に置く。受ける形を絞るのは、組み上げを
 * 単純に保つためと、書いたものが黙って別の意味にならないため。
 */

/** スクリプトが読める入口。ほかの名前は型検査の解決で TS2307 になる (`compile.ts`) */
const ZOD_ENTRIES = new Set(["zod", "zod/mini"]);
export const isZodEntry = (name: string): boolean => ZOD_ENTRIES.has(name);

/** 束の名前の組ごとに覚える件数。1 件は 15〜390 KB で、組は何百も無い */
const BUNDLE_CACHE_MAX = 32;

const positionOf = (source: ts.SourceFile, node: ts.Node): { line: number; col: number } => {
  const where = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: where.line + 1, col: where.character + 1 };
};

const isImport = (node: ts.Node): node is ts.ImportDeclaration | ts.ImportEqualsDeclaration =>
  ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node);

const moduleNameOf = (node: ts.ImportDeclaration): string | undefined =>
  ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;

/** 束ねられる 2 形か: `import { z } from "zod"` と `import * as z from "zod/mini"` */
const isAcceptedImport = (node: ts.Node): node is ts.ImportDeclaration => {
  if (!ts.isImportDeclaration(node) || node.attributes !== undefined) return false;
  const clause = node.importClause;
  if (clause === undefined || clause.phaseModifier !== undefined || clause.name !== undefined) {
    return false;
  }
  const bindings = clause.namedBindings;
  if (bindings === undefined) return false;
  const name = moduleNameOf(node);
  if (ts.isNamespaceImport(bindings)) return name === "zod/mini" && bindings.name.text === "z";
  const [only, ...rest] = bindings.elements;
  return (
    name === "zod" &&
    rest.length === 0 &&
    only !== undefined &&
    !only.isTypeOnly &&
    only.propertyName === undefined &&
    only.name.text === "z"
  );
};

/** スクリプトの Zod の読み方。先頭の文が受ける形のときだけ入口を返す */
export const zodEntryOf = (source: ts.SourceFile): string | undefined => {
  const first = source.statements[0];
  return first !== undefined && isAcceptedImport(first) ? moduleNameOf(first) : undefined;
};

/**
 * `import` の形の誤り (BH0003)。`@ts-nocheck` でも効く —— 型の検査ではなく、組み上げられるかの決まり。
 *
 * 見るのは zod の入口を読む物だけ。ほかの名前は型検査の解決が TS2307 で言い、`@ts-nocheck` なら JS に
 * `import` が残って BH0006 になる。同じ行に 2 つの誤りを並べない。
 */
export const importProblems = (id: string, source: ts.SourceFile): Diagnostic[] => {
  const problems: Diagnostic[] = [];
  const problem = (node: ts.Node, message: string): void => {
    problems.push({ file: `${id}.ts`, ...positionOf(source, node), code: "BH0003", message });
  };
  source.statements.forEach((statement, index) => {
    if (!ts.isImportDeclaration(statement)) return;
    const name = moduleNameOf(statement);
    if (name === undefined || !isZodEntry(name)) return;
    if (!isAcceptedImport(statement)) {
      problem(
        statement,
        'zod の読み方は import { z } from "zod" か import * as z from "zod/mini" だけ',
      );
    } else if (index !== 0) {
      problem(statement, "import は先頭の文に 1 つだけ");
    }
  });
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [target] = node.arguments;
      if (target !== undefined && ts.isStringLiteralLike(target) && isZodEntry(target.text)) {
        problem(node, 'import() はページの中で解決できない。import { z } from "zod" を先頭に書く');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return problems;
};

/**
 * `preload` の `import` と `defineParams` の誤り (BH0004)。**cache の外で毎回呼ぶ。** cache の鍵に phase は無く、
 * 同じ TS を `preload` で頼み直すと当たるので、cache の中で見ると通ってしまう。preload は全部のフレームで遷移の
 * たびに走り、受け皿も無いので、Zod の失敗を書く先も、変数を読む先も無い。
 */
export const preloadProblems = (
  scripts: readonly { id: string; phase?: string | undefined; source: string }[],
): Diagnostic[] =>
  scripts
    .filter((s) => s.phase === "preload")
    .flatMap((s) => {
      const source = ts.createSourceFile(`/src/${s.id}.ts`, s.source, ts.ScriptTarget.ES2023, true);
      const imports = source.statements.filter(isImport).map((statement): Diagnostic => ({
        file: `${s.id}.ts`,
        ...positionOf(source, statement),
        code: "BH0004",
        message: "preload では import を使えない (全部のフレームで遷移のたびに走る)",
      }));
      const { declares, at } = readParams(s.source);
      return declares
        ? [
            ...imports,
            {
              file: `${s.id}.ts`,
              ...at,
              code: "BH0004",
              message: "preload では defineParams を使えない (受け皿が無い)",
            },
          ]
        : imports;
    });

const isImportBinding = (node: ts.Node): boolean =>
  ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node);

/** `defineParams(…)` の呼び出しか。JS では `globalThis.__bh.vars` に置き換わるので、中の `z` は JS に残らない。 */
export const isDefineParamsCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "defineParams";

/**
 * 型の位置と `defineParams` の中を除いて `z.<名前>` を集める。名前を読めない使い方 (`z[key]`・`const { object } = z`) があれば
 * undefined で、そのときは全部を束ねる。`z` は全部入りの入れ物なので、そのまま束ねると locale ごと残る
 * (385 KB。使う名前だけなら 85 KB)。
 */
export const usedNames = (source: ts.SourceFile): readonly string[] | undefined => {
  const names = new Set<string>();
  let readable = true;
  const visit = (node: ts.Node): void => {
    if (isDefineParamsCall(node)) return;
    if (ts.isIdentifier(node) && node.text === "z") {
      const parent = node.parent;
      const isDeclaration = isImportBinding(parent);
      const isType = ts.isQualifiedName(parent) || ts.isTypeQueryNode(parent);
      if (ts.isPropertyAccessExpression(parent)) {
        if (parent.expression === node) names.add(parent.name.text);
      } else if (!isDeclaration && !isType) {
        readable = false;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return readable ? [...names].sort() : undefined;
};

const bundles = new BoundedCache<string>(BUNDLE_CACHE_MAX);

/**
 * Zod の部分だけの束。`jitless` は入口で立てる —— 立てないと Zod は速い検査を `new Function` で作ろうとし、
 * `script-src` が eval を禁じるページでは投げるうえ、相手のサイトへ違反の報告が飛ぶ。
 *
 * 同じ入力は同じバイト列 (名前は並べ替えてある)。capture-ledger は段ごとの JS が同じかを sha256 で見るので、変わると困る。
 */
const bundleZod = (entry: string, names: readonly string[] | undefined): string => {
  const key = `${entry}|${names?.join(",") ?? "*"}`;
  const hit = bundles.get(key);
  if (hit !== undefined) return hit;
  const contents =
    `import * as ns from ${JSON.stringify(entry)}; ns.config({ jitless: true }); ` +
    (names === undefined
      ? "export { ns as z };"
      : `export const z = { ${names.map((n) => `${n}: ns.${n}`).join(", ")} };`);
  const built = buildSync({
    stdin: { contents, resolveDir: repoRoot(), loader: "js" },
    bundle: true,
    format: "iife",
    globalName: "__bhZod",
    target: "es2023",
    minify: true,
    write: false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "silent",
  });
  const text = built.outputFiles[0]?.text;
  if (text === undefined) throw new Error("esbuild の出力が無い");
  bundles.set(key, text);
  return text;
};

/**
 * emit した JS を classic script に組み上げる。
 *
 * - **block で包む。** 関数で包むと、スクリプトの最後の式 (async IIFE の Promise) が完了値でなくなり、
 *   `page.evaluate` が終わりを待てない。block なら完了値はそのままで、`const z` が他のスクリプトとぶつからない
 * - **`"use strict"` を足す。** TS は module に `"use strict"` を付けないが、classic として走らせるので要る
 * - **末尾の `export {};` を消す。** `import` を消した module に TS が付ける印で、classic では構文エラー
 */
export const assemble = (
  js: string,
  entry: string,
  names: readonly string[] | undefined,
): string => {
  const inner = js.replace(/(^|\n)export \{\};\n?$/, "$1");
  const zod =
    names?.length === 0
      ? ""
      : `// zod ${ZOD_VERSION} (MIT)\nconst { z } = (() => { ${bundleZod(entry, names)}; return __bhZod; })();\n`;
  return `"use strict";\n{\n${zod}${inner}}\n`;
};
