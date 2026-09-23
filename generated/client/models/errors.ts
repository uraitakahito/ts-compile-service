// smithy-typescript generated code
import type { ExceptionOptionType as __ExceptionOptionType } from "@smithy/core/client";

import type { Diagnostic, ValidationExceptionField } from "./models_0";
import { TsCompileServiceException as __BaseException } from "./TsCompileServiceException";

/**
 * A standard error for input validation failures.
 * This should be thrown by services when a member of the input structure
 * falls outside of the modeled or documented constraints.
 * @public
 */
export class ValidationException extends __BaseException {
  readonly name = "ValidationException" as const;
  readonly $fault = "client" as const;
  /**
   * A list of specific failures encountered while validating the input.
   * A member can appear in this list more than once if it failed to satisfy multiple constraints.
   * @public
   */
  fieldList?: ValidationExceptionField[] | undefined;

  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<ValidationException, __BaseException>) {
    super({
      name: "ValidationException",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, ValidationException.prototype);
    this.fieldList = opts.fieldList;
  }
}

/**
 * 1 本でも型が通らなかった。1 本も返さない。
 * @public
 */
export class CompileFailed extends __BaseException {
  readonly name = "CompileFailed" as const;
  readonly $fault = "client" as const;
  typescript: string | undefined;
  diagnostics: Diagnostic[] | undefined;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<CompileFailed, __BaseException>) {
    super({
      name: "CompileFailed",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, CompileFailed.prototype);
    this.typescript = opts.typescript;
    this.diagnostics = opts.diagnostics;
  }
}

/**
 * 送られた sha256 が source と合わない。運ぶ途中で入れ替わった物は変換しない。
 * @public
 */
export class SourceHashMismatch extends __BaseException {
  readonly name = "SourceHashMismatch" as const;
  readonly $fault = "client" as const;
  id: string | undefined;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<SourceHashMismatch, __BaseException>) {
    super({
      name: "SourceHashMismatch",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, SourceHashMismatch.prototype);
    this.id = opts.id;
  }
}
