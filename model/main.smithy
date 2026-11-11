$version: "2"

namespace ts.compile

use aws.protocols#restJson1
use smithy.framework#ValidationException

/// TypeScript を型検査して JavaScript にする。型が通らなければ 1 本も返さない。
@restJson1
@title("ts-compile-service")
service TsCompile {
    version: "2026-09-23"
    operations: [
        Compile
        GetHealth
    ]
    errors: [
        ValidationException
    ]
}

/// capture-ledger が送った TS を、BrowserHive が評価する JS にする。1 段に 1 回。
@http(method: "POST", uri: "/compile", code: 200)
operation Compile {
    input := {
        @required
        scripts: ScriptList

        /// このクロールに渡された変数の名前。値は送らない。必須の宣言と照らし、足りなければ 422（BH0001）。
        /// JS は source だけで決まるので、cache の鍵には入らない
        @required
        variableNames: ValueNameList
    }

    output := {
        /// 何で変換したか（typescript の版）
        @required
        typescript: String

        /// 何に向けて変換したか（写した受け皿の型の tag。GetHealth と同じ値）。
        /// 報告に載せるのに、クロールの段ごとに healthz を訊かせない
        @required
        hostTypes: String

        /// 入力と同じ形。source と sha256 だけ JS になる
        @required
        scripts: ScriptList

        /// 同じ TS の並びを前にも変換していたか
        @required
        cached: Boolean

        /// スクリプトごとの変数の宣言（defineParams）。入力と同じ並び
        @required
        declarations: DeclarationList
    }

    errors: [
        CompileFailed
        SourceHashMismatch
    ]
}

/// 起きているか。何で変換するか（typescript の版と、写した受け皿の型の tag）。
@readonly
@http(method: "GET", uri: "/healthz", code: 200)
operation GetHealth {
    output := {
        @required
        ok: Boolean

        @required
        typescript: String

        /// 写した capture-scripts の tag（capture-scripts.pin の中身）
        @required
        hostTypes: String
    }
}

/// 1 本でも型か決まりが通らなかった。1 本も返さない。
@error("client")
@httpError(422)
structure CompileFailed {
    @required
    message: String

    @required
    typescript: String

    @required
    diagnostics: DiagnosticList

    /// スクリプトごとの変数の宣言。型が通らなくても読める物は読む
    @required
    declarations: DeclarationList

    /// 必須の宣言のうち、variableNames に無かった名前
    @required
    missingVariables: ValueNameList
}

/// 送られた sha256 が source と合わない。運ぶ途中で入れ替わった物は変換しない。
@error("client")
@httpError(409)
structure SourceHashMismatch {
    @required
    message: String

    @required
    id: ScriptId
}

/// スクリプト 1 本。capture-ledger が送る形そのもの。
structure Script {
    @required
    id: ScriptId

    @required
    version: Integer

    @required
    phase: Phase

    @required
    source: String

    /// source のバイト列の sha256（hex）
    @required
    sha256: Sha256

    options: Document
}

/// 0 本も通す。capture-ledger は `scriptIds: []` を「何も走らせない」という意思として受理し、空でも段に載せる ——
/// それを断るのは model の見落とし。空なら何も変換せず、200 で `scripts: []` を返す（typescript と hostTypes は付く）
@length(min: 0, max: 100)
list ScriptList {
    member: Script
}

@length(min: 1, max: 64)
@pattern("^[a-z][a-z0-9-]*$")
string ScriptId

@pattern("^[0-9a-f]{64}$")
string Sha256

enum Phase {
    PRELOAD = "preload"
    BEHAVIOR = "behavior"
}

structure Diagnostic {
    file: String

    line: Integer

    col: Integer

    /// TypeScript の誤りは TS2322 のような code。この service の決まりは BH0001（必須の変数が渡されていない）・
    /// BH0002（defineParams の宣言を読めない）・BH0003（import の形）・BH0004（preload の import か defineParams）・
    /// BH0005（__bh.vars の直読み）・BH0006（classic script として読めない）
    @required
    code: String

    @required
    message: String
}

list DiagnosticList {
    member: Diagnostic
}

/// 変数の名前。capture-ledger の schema と BrowserHive の ValueName と同じ式
@length(min: 1, max: 64)
@pattern("^[a-z][a-z0-9_]*$")
string ValueName

/// capture-ledger の 1 クロールの値の上限と同じ
@length(min: 0, max: 32)
list ValueNameList {
    member: ValueName
}

/// 1 本のスクリプトの変数の宣言
structure Declaration {
    @required
    id: ScriptId

    @required
    params: DeclaredParamList

    /// 宣言を読めなかった（BH0002）。params は当てにならない
    @required
    unreadable: Boolean
}

list DeclarationList {
    member: Declaration
}

/// 宣言された変数 1 つ。値は文字列だけ
structure DeclaredParam {
    @required
    name: ValueName

    /// いつも variable。シークレットは defineParams で宣言しない
    @required
    kind: ParamKind

    @required
    required: Boolean

    /// .describe("…") の字
    summary: String

    @required
    schema: ParamSchema
}

list DeclaredParamList {
    member: DeclaredParam
}

enum ParamKind {
    VARIABLE = "variable"
}

/// 値の JSON Schema。鍵はこの 4 つだけ
structure ParamSchema {
    @required
    type: String

    minLength: Integer

    maxLength: Integer

    enum: ParamEnum
}

list ParamEnum {
    member: String
}
