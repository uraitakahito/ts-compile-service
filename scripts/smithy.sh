#!/usr/bin/env bash
#
# Smithy CLI を OS ごとの zip で落として直接走らせる。**JVM を入れる必要は無い** —— zip に JRE が
# 同梱されている。手元 (darwin-aarch64) でも CI (linux-x86_64) でも同じ script で、コンテナも
# brew も要らない。
#
#   bash scripts/smithy.sh          # format --check → build → generated/ に写す (pnpm run smithy)
#   bash scripts/smithy.sh format   # model/ を整形する (list は 1 行 1 要素になる)
#   bash scripts/smithy.sh lock     # Maven の依存を smithy-lock.json に固定する
#
# 生成物 (generated/ssdk・generated/client・generated/openapi.json) は commit する。読む人が JVM 無しで
# 読めるため、そして runtime の image に codegen を持ち込まないため。CI は同じ script を走らせて
# `git diff --exit-code -- generated` を見る (pnpm run smithy:check) —— model と生成物がずれていれば赤。
#
# server は source の projection (smithy-build.json の plugins)、client は projections.client。同じ model
# から出るので、client で server を叩く契約試験 (test/client.test.ts) が「手で書いた service.ts が model
# どおりか」を言える。client は npm には出さず image にも入れない —— 消費者は当面その試験だけ。
#
# `generated/ssdk` と `generated/client` は毎回消して作り直す。model から消えた operation の生成物が
# 残らないように。`generated/package.json` (type: commonjs と、生成 client が読む version) は外に在るので残る。
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=1.73.0

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) DIST=darwin-aarch64 ;;
  Darwin-x86_64) DIST=darwin-x86_64 ;;
  Linux-x86_64) DIST=linux-x86_64 ;;
  Linux-aarch64) DIST=linux-aarch64 ;;
  *)
    echo "知らない OS/arch: $(uname -s)-$(uname -m)" >&2
    exit 1
    ;;
esac

CLI="$ROOT/.smithy-cli/$VERSION/smithy-cli-$DIST/bin/smithy"
if [ ! -x "$CLI" ]; then
  echo "Smithy CLI $VERSION ($DIST) を落とす → .smithy-cli/" >&2
  mkdir -p "$ROOT/.smithy-cli/$VERSION"
  zip=$(mktemp -t smithy-cli.XXXXXX.zip)
  curl -sSL -o "$zip" "https://github.com/smithy-lang/smithy/releases/download/$VERSION/smithy-cli-$DIST.zip"
  unzip -q "$zip" -d "$ROOT/.smithy-cli/$VERSION"
  rm -f "$zip"
fi

cd "$ROOT"
case "${1:-build}" in
  format)
    "$CLI" format model/
    ;;
  lock)
    "$CLI" lock
    ;;
  build)
    "$CLI" format --check model/
    "$CLI" build --quiet
    rm -rf generated/ssdk generated/client
    mkdir -p generated/ssdk generated/client
    cp -R build/smithy/source/typescript-codegen/src/. generated/ssdk/
    cp -R build/smithy/client/typescript-codegen/src/. generated/client/
    cp build/smithy/source/openapi/TsCompile.openapi.json generated/openapi.json
    echo "generated/ssdk と generated/client と generated/openapi.json を書き直した" >&2
    ;;
  *)
    echo "usage: scripts/smithy.sh [build|format|lock]" >&2
    exit 1
    ;;
esac
