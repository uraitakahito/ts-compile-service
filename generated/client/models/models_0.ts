// smithy-typescript generated code
import type { DocumentType as __DocumentType } from "@smithy/types";

import type { Phase } from "./enums";

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
 * @public
 */
export interface Diagnostic {
  file?: string | undefined;
  line?: number | undefined;
  col?: number | undefined;
  /**
   * TS2322 のような code
   * @public
   */
  code: string | undefined;

  message: string | undefined;
}

/**
 * 目録の 1 本。台帳が送る形そのもの。
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
   * 0 本も通す。台帳は `scriptIds: []` を「何も走らせない」という意思として受理し、空でも段に載せる ——
   * それを断るのは model の見落とし。空なら何も変換せず、200 で `scripts: []` を返す（typescript と hostTypes は付く）
   * @public
   */
  scripts: Script[] | undefined;
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
