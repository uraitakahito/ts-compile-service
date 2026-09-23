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

/// 台帳が送った TS を、BrowserHive が評価する JS にする。1 段に 1 回。
@http(method: "POST", uri: "/compile", code: 200)
operation Compile {
    input := {
        @required
        scripts: ScriptList
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

/// 1 本でも型が通らなかった。1 本も返さない。
@error("client")
@httpError(422)
structure CompileFailed {
    @required
    message: String

    @required
    typescript: String

    @required
    diagnostics: DiagnosticList
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

/// 目録の 1 本。台帳が送る形そのもの。
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

@length(min: 1, max: 100)
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

    /// TS2322 のような code
    @required
    code: String

    @required
    message: String
}

list DiagnosticList {
    member: Diagnostic
}
