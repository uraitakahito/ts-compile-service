// smithy-typescript generated code
import type { MetadataBearer as __MetadataBearer } from "@smithy/types";

import { _ep0, _mw0, command } from "../commandBuilder";
import type { GetHealthOutput } from "../models/models_0";
import { GetHealth$ } from "../schemas/schemas_0";

/**
 * @public
 */
export type { __MetadataBearer };
/**
 * @public
 *
 * The input for {@link GetHealthCommand}.
 */
export interface GetHealthCommandInput {}
/**
 * @public
 *
 * The output of {@link GetHealthCommand}.
 */
export interface GetHealthCommandOutput extends GetHealthOutput, __MetadataBearer {}

/**
 * 起きているか。何で変換するか（typescript の版と、写した受け皿の型の tag）。
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { TsCompileClient, GetHealthCommand } from "@uraitakahito/ts-compile-client"; // ES Modules import
 * // const { TsCompileClient, GetHealthCommand } = require("@uraitakahito/ts-compile-client"); // CommonJS import
 * // import type { TsCompileClientConfig } from "@uraitakahito/ts-compile-client";
 * const config = {}; // type is TsCompileClientConfig
 * const client = new TsCompileClient(config);
 * const input = {};
 * const command = new GetHealthCommand(input);
 * const response = await client.send(command);
 * // { // GetHealthOutput
 * //   ok: true || false, // required
 * //   typescript: "STRING_VALUE", // required
 * //   hostTypes: "STRING_VALUE", // required
 * // };
 *
 * ```
 *
 * @param GetHealthCommandInput - {@link GetHealthCommandInput}
 * @returns {@link GetHealthCommandOutput}
 * @see {@link GetHealthCommandInput} for command's `input` shape.
 * @see {@link GetHealthCommandOutput} for command's `response` shape.
 * @see {@link TsCompileClientResolvedConfig | config} for TsCompileClient's `config` shape.
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
export class GetHealthCommand extends command<GetHealthCommandInput, GetHealthCommandOutput>(
  _ep0,
  _mw0,
  "GetHealth",
  GetHealth$
) {
  /** @internal type navigation helper, not in runtime. */
  protected declare static __types: {
    api: {
      input: {};
      output: GetHealthOutput;
    };
    sdk: {
      input: GetHealthCommandInput;
      output: GetHealthCommandOutput;
    };
  };
}
