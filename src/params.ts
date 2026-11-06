import ts from "typescript";
import type { Diagnostic } from "./compile.js";
import { readParams, type ReadResult } from "./vendor/read-params.js";

/**
 * クロールごとの変数の宣言 (`defineParams`) についての決まり。宣言を読む本体は `vendor/read-params.ts`
 * (capture-scripts が正の写し) で、ここは誤りの形に直す係。
 */

/** 宣言を読めない (BH0002)。`__bh.vars` を直に読んでいる (BH0005)。どちらも `@ts-nocheck` でも効く。 */
export const paramProblems = (id: string, text: string, source: ts.SourceFile): Diagnostic[] => {
  const unreadable = readParams(text).problems.map((problem): Diagnostic => ({
    file: `${id}.ts`,
    line: problem.line,
    col: problem.col,
    code: "BH0002",
    message: problem.message,
  }));
  return [...unreadable, ...directReads(id, source)];
};

/** `__bh`・`globalThis.__bh` か。括弧と `!` と空白は見ない。 */
const isHost = (node: ts.Expression, source: ts.SourceFile): boolean => {
  const text = node.getText(source).replace(/[()!\s]/g, "");
  return text === "__bh" || text === "globalThis.__bh";
};

/**
 * `__bh.vars` を直に読む形。型に `vars` は無いので `tsc` は止めるが、`@ts-nocheck` は通る。通すと、宣言の無い
 * 値を読むスクリプトが残り、必須の判定が届かない。
 */
const directReads = (id: string, source: ts.SourceFile): Diagnostic[] => {
  const found: Diagnostic[] = [];
  const report = (node: ts.Node): void => {
    const where = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({
      file: `${id}.ts`,
      line: where.line + 1,
      col: where.character + 1,
      code: "BH0005",
      message: "__bh.vars は直に読めない。defineParams で読む",
    });
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "vars" &&
      isHost(node.expression, source)
    ) {
      report(node);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "vars" &&
      isHost(node.expression, source)
    ) {
      report(node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer !== undefined &&
      isHost(node.initializer, source)
    ) {
      for (const element of node.name.elements) {
        if ((element.propertyName ?? element.name).getText(source) === "vars") report(element);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/** 必須の宣言のうち、渡されていない物。誤りは宣言のその行を指す (BH0001)。 */
export const missingOf = (
  scripts: readonly { id: string; read: ReadResult }[],
  variableNames: readonly string[],
): { diagnostics: Diagnostic[]; names: string[] } => {
  const given = new Set(variableNames);
  const diagnostics: Diagnostic[] = [];
  const names = new Set<string>();
  for (const { id, read } of scripts) {
    for (const param of read.params) {
      if (!param.required || given.has(param.name)) continue;
      names.add(param.name);
      diagnostics.push({
        file: `${id}.ts`,
        ...read.positions.get(param.name),
        code: "BH0001",
        message: `必須の変数 ${param.name} が渡されていない`,
      });
    }
  }
  return { diagnostics, names: [...names] };
};
