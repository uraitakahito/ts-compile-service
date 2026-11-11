// smithy-typescript generated code
import type { DocumentType as __DocumentType } from "@smithy/types";

import type { ParamKind, Phase } from "./enums";

/**
 * Describes one specific validation failure for an input member.
 * @public
 */
export interface ValidationExceptionField {
  /**
   * A JSONPointer expression to the structure member whose value failed to satisfy the modeled constraints.
   * @public
   */
  path: string | undefined;

  /**
   * A detailed description of the validation failure.
   * @public
   */
  message: string | undefined;
}

/**
 * 値の JSON Schema。鍵はこの 4 つだけ
 * @public
 */
export interface ParamSchema {
  type: string | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  enum?: string[] | undefined;
}

/**
 * 宣言された変数 1 つ。値は文字列だけ
 * @public
 */
export interface DeclaredParam {
  /**
   * 変数の名前。capture-ledger の schema と BrowserHive の ValueName と同じ式
   * @public
   */
  name: string | undefined;

  /**
   * いつも variable。シークレットは defineParams で宣言しない
   * @public
   */
  kind: ParamKind | undefined;

  required: boolean | undefined;
  /**
   * .describe("…") の字
   * @public
   */
  summary?: string | undefined;

  /**
   * 値の JSON Schema。鍵はこの 4 つだけ
   * @public
   */
  schema: ParamSchema | undefined;
}

/**
 * 1 本のスクリプトの変数の宣言
 * @public
 */
export interface Declaration {
  id: string | undefined;
  params: DeclaredParam[] | undefined;
  /**
   * 宣言を読めなかった（BH0002）。params は当てにならない
   * @public
   */
  unreadable: boolean | undefined;
}

/**
 * @public
 */
export interface Diagnostic {
  file?: string | undefined;
  line?: number | undefined;
  col?: number | undefined;
  /**
   * TypeScript の誤りは TS2322 のような code。この service の決まりは BH0001（必須の変数が渡されていない）・
   * BH0002（defineParams の宣言を読めない）・BH0003（import の形）・BH0004（preload の import か defineParams）・
   * BH0005（__bh.vars の直読み）・BH0006（classic script として読めない）
   * @public
   */
  code: string | undefined;

  message: string | undefined;
}

/**
 * スクリプト 1 本。capture-ledger が送る形そのもの。
 * @public
 */
export interface Script {
  id: string | undefined;
  version: number | undefined;
  phase: Phase | undefined;
  source: string | undefined;
  /**
   * source のバイト列の sha256（hex）
   * @public
   */
  sha256: string | undefined;

  options?: __DocumentType | undefined;
}

/**
 * @public
 */
export interface CompileInput {
  /**
   * 0 本も通す。capture-ledger は `scriptIds: []` を「何も走らせない」という意思として受理し、空でも段に載せる ——
   * それを断るのは model の見落とし。空なら何も変換せず、200 で `scripts: []` を返す（typescript と hostTypes は付く）
   * @public
   */
  scripts: Script[] | undefined;

  /**
   * このクロールに渡された変数の名前。値は送らない。必須の宣言と照らし、足りなければ 422（BH0001）。
   * JS は source だけで決まるので、cache の鍵には入らない
   * @public
   */
  variableNames: string[] | undefined;
}

/**
 * @public
 */
export interface CompileOutput {
  /**
   * 何で変換したか（typescript の版）
   * @public
   */
  typescript: string | undefined;

  /**
   * 何に向けて変換したか（写した受け皿の型の tag。GetHealth と同じ値）。
   * 報告に載せるのに、クロールの段ごとに healthz を訊かせない
   * @public
   */
  hostTypes: string | undefined;

  /**
   * 入力と同じ形。source と sha256 だけ JS になる
   * @public
   */
  scripts: Script[] | undefined;

  /**
   * 同じ TS の並びを前にも変換していたか
   * @public
   */
  cached: boolean | undefined;

  /**
   * スクリプトごとの変数の宣言（defineParams）。入力と同じ並び
   * @public
   */
  declarations: Declaration[] | undefined;
}

/**
 * @public
 */
export interface GetHealthOutput {
  ok: boolean | undefined;
  typescript: string | undefined;
  /**
   * 写した capture-scripts の tag（capture-scripts.pin の中身）
   * @public
   */
  hostTypes: string | undefined;
}
