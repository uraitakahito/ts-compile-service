// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { CompileInput, CompileOutput } from "../models/models_0";
import { Compile$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link CompileCommand}.
 */
export interface CompileCommandInput extends CompileInput {}
/**
 * @public
 *
 * The output of {@link CompileCommand}.
 */
export interface CompileCommandOutput extends CompileOutput, __MetadataBearer {}

/**
 * 台帳が送った TS を、BrowserHive が評価する JS にする。1 段に 1 回。
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { TsCompileClient, CompileCommand } from "@uraitakahito/ts-compile-client"; // ES Modules import
 * // const { TsCompileClient, CompileCommand } = require("@uraitakahito/ts-compile-client"); // CommonJS import
 * // import type { TsCompileClientConfig } from "@uraitakahito/ts-compile-client";
 * const config = {}; // type is TsCompileClientConfig
 * const client = new TsCompileClient(config);
 * const input = { // CompileInput
 *   scripts: [ // ScriptList // required
 *     { // Script
 *       id: "STRING_VALUE", // required
 *       version: Number("int"), // required
 *       phase: "preload" || "behavior", // required
 *       source: "STRING_VALUE", // required
 *       sha256: "STRING_VALUE", // required
 *       options: "DOCUMENT_VALUE",
 *     },
 *   ],
 * };
 * const command = new CompileCommand(input);
 * const response = await client.send(command);
 * // { // CompileOutput
 * //   typescript: "STRING_VALUE", // required
 * //   hostTypes: "STRING_VALUE", // required
 * //   scripts: [ // ScriptList // required
 * //     { // Script
 * //       id: "STRING_VALUE", // required
 * //       version: Number("int"), // required
 * //       phase: "preload" || "behavior", // required
 * //       source: "STRING_VALUE", // required
 * //       sha256: "STRING_VALUE", // required
 * //       options: "DOCUMENT_VALUE",
 * //     },
 * //   ],
 * //   cached: true || false, // required
 * // };
 *
 * ```
 *
 * @param CompileCommandInput - {@link CompileCommandInput}
 * @returns {@link CompileCommandOutput}
 * @see {@link CompileCommandInput} for command's `input` shape.
 * @see {@link CompileCommandOutput} for command's `response` shape.
 * @see {@link TsCompileClientResolvedConfig | config} for TsCompileClient's `config` shape.
 *
 * @throws {@link CompileFailed} (client fault)
 *  1 本でも型が通らなかった。1 本も返さない。
 *
 * @throws {@link SourceHashMismatch} (client fault)
 *  送られた sha256 が source と合わない。運ぶ途中で入れ替わった物は変換しない。
 *
 * @throws {@link ValidationException} (client fault)
 *  A standard error for input validation failures.
 * This should be thrown by services when a member of the input structure
 * falls outside of the modeled or documented constraints.
 *
 * @throws {@link TsCompileServiceException}
 * <p>Base exception class for all service exceptions from TsCompile service.</p>
 *
 *
 * @public
 */
export class CompileCommand extends command<CompileCommandInput, CompileCommandOutput>(
  _ep0,
  _mw0,
  "Compile",
  Compile$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: CompileInput;
      output: CompileOutput;
    };
    sdk: {
      input: CompileCommandInput;
      output: CompileCommandOutput;
    };
  };
}
