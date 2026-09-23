// smithy-typescript generated code
import { createAggregatedClient } from "@smithy/core/client";
import type { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";

import { type CompileCommandInput, type CompileCommandOutput, CompileCommand } from "./commands/CompileCommand";
import { type GetHealthCommandInput, type GetHealthCommandOutput, GetHealthCommand } from "./commands/GetHealthCommand";
import { TsCompileClient } from "./TsCompileClient";

const commands = {
  CompileCommand,
  GetHealthCommand,
};

export interface TsCompile {
  /**
   * @see {@link CompileCommand}
   */
  compile(
    args: CompileCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<CompileCommandOutput>;
  compile(
    args: CompileCommandInput,
    cb: (err: any, data?: CompileCommandOutput) => void
  ): void;
  compile(
    args: CompileCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: CompileCommandOutput) => void
  ): void;

  /**
   * @see {@link GetHealthCommand}
   */
  getHealth(): Promise<GetHealthCommandOutput>;
  getHealth(
    args: GetHealthCommandInput,
    options?: __HttpHandlerOptions
  ): Promise<GetHealthCommandOutput>;
  getHealth(
    args: GetHealthCommandInput,
    cb: (err: any, data?: GetHealthCommandOutput) => void
  ): void;
  getHealth(
    args: GetHealthCommandInput,
    options: __HttpHandlerOptions,
    cb: (err: any, data?: GetHealthCommandOutput) => void
  ): void;
}

/**
 * TypeScript を型検査して JavaScript にする。型が通らなければ 1 本も返さない。
 * @public
 */
export class TsCompile extends TsCompileClient implements TsCompile {}
createAggregatedClient(commands, TsCompile);
