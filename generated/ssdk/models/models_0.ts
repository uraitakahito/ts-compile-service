// smithy-typescript generated code
import {
  CompositeCollectionValidator as __CompositeCollectionValidator,
  CompositeStructureValidator as __CompositeStructureValidator,
  CompositeValidator as __CompositeValidator,
  EnumValidator as __EnumValidator,
  LengthValidator as __LengthValidator,
  MultiConstraintValidator as __MultiConstraintValidator,
  NoOpValidator as __NoOpValidator,
  PatternValidator as __PatternValidator,
  RequiredValidator as __RequiredValidator,
  ValidationFailure as __ValidationFailure,
} from "@smithy/server-common";
import { DocumentType as __DocumentType } from "@smithy/types";

import { ParamKind, Phase } from "./enums";

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

export namespace ValidationExceptionField {
  const memberValidators : {
    path?: __MultiConstraintValidator<string>,
    message?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: ValidationExceptionField, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "path": {
            memberValidators["path"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "message": {
            memberValidators["message"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("path").validate(obj.path, `${path}/path`),
      ...getMemberValidator("message").validate(obj.message, `${path}/message`),
    ];
  }
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

export namespace ParamSchema {
  const memberValidators : {
    type?: __MultiConstraintValidator<string>,
    minLength?: __MultiConstraintValidator<number>,
    maxLength?: __MultiConstraintValidator<number>,
    enum?: __MultiConstraintValidator<Iterable<string>>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: ParamSchema, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "type": {
            memberValidators["type"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "minLength": {
            memberValidators["minLength"] = new __NoOpValidator();
            break;
          }
          case "maxLength": {
            memberValidators["maxLength"] = new __NoOpValidator();
            break;
          }
          case "enum": {
            memberValidators["enum"] = new __CompositeCollectionValidator<string>(
              new __NoOpValidator(),
              new __NoOpValidator()
            );
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("type").validate(obj.type, `${path}/type`),
      ...getMemberValidator("minLength").validate(obj.minLength, `${path}/minLength`),
      ...getMemberValidator("maxLength").validate(obj.maxLength, `${path}/maxLength`),
      ...getMemberValidator("enum").validate(obj.enum, `${path}/enum`),
    ];
  }
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

export namespace DeclaredParam {
  const memberValidators : {
    name?: __MultiConstraintValidator<string>,
    kind?: __MultiConstraintValidator<string>,
    required?: __MultiConstraintValidator<boolean>,
    summary?: __MultiConstraintValidator<string>,
    schema?: __MultiConstraintValidator<ParamSchema>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: DeclaredParam, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "name": {
            memberValidators["name"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
              new __LengthValidator(1, 64),
              new __PatternValidator("^[a-z][a-z0-9_]*$"),
            ]);
            break;
          }
          case "kind": {
            memberValidators["kind"] = new __CompositeValidator<string>([
              new __EnumValidator([
                "variable",
                ], [
                "variable",
              ]),
              new __RequiredValidator(),
            ]);
            break;
          }
          case "required": {
            memberValidators["required"] = new __CompositeValidator<boolean>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "summary": {
            memberValidators["summary"] = new __NoOpValidator();
            break;
          }
          case "schema": {
            memberValidators["schema"] = new __CompositeStructureValidator<ParamSchema>(
              new __CompositeValidator<ParamSchema>([
                new __RequiredValidator(),
              ]),
              ParamSchema.validate
            );
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("name").validate(obj.name, `${path}/name`),
      ...getMemberValidator("kind").validate(obj.kind, `${path}/kind`),
      ...getMemberValidator("required").validate(obj.required, `${path}/required`),
      ...getMemberValidator("summary").validate(obj.summary, `${path}/summary`),
      ...getMemberValidator("schema").validate(obj.schema, `${path}/schema`),
    ];
  }
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

export namespace Declaration {
  const memberValidators : {
    id?: __MultiConstraintValidator<string>,
    params?: __MultiConstraintValidator<Iterable<DeclaredParam>>,
    unreadable?: __MultiConstraintValidator<boolean>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: Declaration, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "id": {
            memberValidators["id"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
              new __LengthValidator(1, 64),
              new __PatternValidator("^[a-z][a-z0-9-]*$"),
            ]);
            break;
          }
          case "params": {
            memberValidators["params"] = new __CompositeCollectionValidator<DeclaredParam>(
              new __CompositeValidator<DeclaredParam[]>([
                new __RequiredValidator(),
              ]),
              new __CompositeStructureValidator<DeclaredParam>(
                new __NoOpValidator(),
                DeclaredParam.validate
              )
            );
            break;
          }
          case "unreadable": {
            memberValidators["unreadable"] = new __CompositeValidator<boolean>([
              new __RequiredValidator(),
            ]);
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("id").validate(obj.id, `${path}/id`),
      ...getMemberValidator("params").validate(obj.params, `${path}/params`),
      ...getMemberValidator("unreadable").validate(obj.unreadable, `${path}/unreadable`),
    ];
  }
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

export namespace Diagnostic {
  const memberValidators : {
    file?: __MultiConstraintValidator<string>,
    line?: __MultiConstraintValidator<number>,
    col?: __MultiConstraintValidator<number>,
    code?: __MultiConstraintValidator<string>,
    message?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: Diagnostic, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "file": {
            memberValidators["file"] = new __NoOpValidator();
            break;
          }
          case "line": {
            memberValidators["line"] = new __NoOpValidator();
            break;
          }
          case "col": {
            memberValidators["col"] = new __NoOpValidator();
            break;
          }
          case "code": {
            memberValidators["code"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "message": {
            memberValidators["message"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("file").validate(obj.file, `${path}/file`),
      ...getMemberValidator("line").validate(obj.line, `${path}/line`),
      ...getMemberValidator("col").validate(obj.col, `${path}/col`),
      ...getMemberValidator("code").validate(obj.code, `${path}/code`),
      ...getMemberValidator("message").validate(obj.message, `${path}/message`),
    ];
  }
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

export namespace Script {
  const memberValidators : {
    id?: __MultiConstraintValidator<string>,
    version?: __MultiConstraintValidator<number>,
    phase?: __MultiConstraintValidator<string>,
    source?: __MultiConstraintValidator<string>,
    sha256?: __MultiConstraintValidator<string>,
    options?: __MultiConstraintValidator<__DocumentType>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: Script, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "id": {
            memberValidators["id"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
              new __LengthValidator(1, 64),
              new __PatternValidator("^[a-z][a-z0-9-]*$"),
            ]);
            break;
          }
          case "version": {
            memberValidators["version"] = new __CompositeValidator<number>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "phase": {
            memberValidators["phase"] = new __CompositeValidator<string>([
              new __EnumValidator([
                "preload",
                "behavior",
                ], [
                "preload",
                "behavior",
              ]),
              new __RequiredValidator(),
            ]);
            break;
          }
          case "source": {
            memberValidators["source"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "sha256": {
            memberValidators["sha256"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
              new __PatternValidator("^[0-9a-f]{64}$"),
            ]);
            break;
          }
          case "options": {
            memberValidators["options"] = new __NoOpValidator();
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("id").validate(obj.id, `${path}/id`),
      ...getMemberValidator("version").validate(obj.version, `${path}/version`),
      ...getMemberValidator("phase").validate(obj.phase, `${path}/phase`),
      ...getMemberValidator("source").validate(obj.source, `${path}/source`),
      ...getMemberValidator("sha256").validate(obj.sha256, `${path}/sha256`),
      ...getMemberValidator("options").validate(obj.options, `${path}/options`),
    ];
  }
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

export namespace CompileInput {
  const memberValidators : {
    scripts?: __MultiConstraintValidator<Iterable<Script>>,
    variableNames?: __MultiConstraintValidator<Iterable<string>>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: CompileInput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "scripts": {
            memberValidators["scripts"] = new __CompositeCollectionValidator<Script>(
              new __CompositeValidator<Script[]>([
                new __RequiredValidator(),
                new __LengthValidator(0, 100),
              ]),
              new __CompositeStructureValidator<Script>(
                new __NoOpValidator(),
                Script.validate
              )
            );
            break;
          }
          case "variableNames": {
            memberValidators["variableNames"] = new __CompositeCollectionValidator<string>(
              new __CompositeValidator<string[]>([
                new __RequiredValidator(),
                new __LengthValidator(0, 32),
              ]),
              new __CompositeValidator<string>([
                new __LengthValidator(1, 64),
                new __PatternValidator("^[a-z][a-z0-9_]*$"),
              ])
            );
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("scripts").validate(obj.scripts, `${path}/scripts`),
      ...getMemberValidator("variableNames").validate(obj.variableNames, `${path}/variableNames`),
    ];
  }
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

export namespace CompileOutput {
  const memberValidators : {
    typescript?: __MultiConstraintValidator<string>,
    hostTypes?: __MultiConstraintValidator<string>,
    scripts?: __MultiConstraintValidator<Iterable<Script>>,
    cached?: __MultiConstraintValidator<boolean>,
    declarations?: __MultiConstraintValidator<Iterable<Declaration>>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: CompileOutput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "typescript": {
            memberValidators["typescript"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "hostTypes": {
            memberValidators["hostTypes"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "scripts": {
            memberValidators["scripts"] = new __CompositeCollectionValidator<Script>(
              new __CompositeValidator<Script[]>([
                new __RequiredValidator(),
                new __LengthValidator(0, 100),
              ]),
              new __CompositeStructureValidator<Script>(
                new __NoOpValidator(),
                Script.validate
              )
            );
            break;
          }
          case "cached": {
            memberValidators["cached"] = new __CompositeValidator<boolean>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "declarations": {
            memberValidators["declarations"] = new __CompositeCollectionValidator<Declaration>(
              new __CompositeValidator<Declaration[]>([
                new __RequiredValidator(),
              ]),
              new __CompositeStructureValidator<Declaration>(
                new __NoOpValidator(),
                Declaration.validate
              )
            );
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("typescript").validate(obj.typescript, `${path}/typescript`),
      ...getMemberValidator("hostTypes").validate(obj.hostTypes, `${path}/hostTypes`),
      ...getMemberValidator("scripts").validate(obj.scripts, `${path}/scripts`),
      ...getMemberValidator("cached").validate(obj.cached, `${path}/cached`),
      ...getMemberValidator("declarations").validate(obj.declarations, `${path}/declarations`),
    ];
  }
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

export namespace GetHealthOutput {
  const memberValidators : {
    ok?: __MultiConstraintValidator<boolean>,
    typescript?: __MultiConstraintValidator<string>,
    hostTypes?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: GetHealthOutput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "ok": {
            memberValidators["ok"] = new __CompositeValidator<boolean>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "typescript": {
            memberValidators["typescript"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
          case "hostTypes": {
            memberValidators["hostTypes"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("ok").validate(obj.ok, `${path}/ok`),
      ...getMemberValidator("typescript").validate(obj.typescript, `${path}/typescript`),
      ...getMemberValidator("hostTypes").validate(obj.hostTypes, `${path}/hostTypes`),
    ];
  }
}
