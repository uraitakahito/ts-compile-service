# 後回しの棚の段取り（計画: https://claude.ai/artifact/2CfGqX9peGkNmuBzA7n8Q5）

- [x] 段 1 docs-site: Astro + Starlight（en が根 / ja は /ja/）、4 ページ、check-doc-refs（en/ja の対・内部リンク・path の実在・API の表 ⇔ openapi.json）、docs.yaml / site.yaml、README を 4 節に（#4。Pages は main の docs.yaml が作った。en/ja とも 200）
- [x] 段 2 client 生成: projections.client → generated/client、Compile の output に hostTypes、契約試験 5 本、tsconfig の 2 つ（TS4111・TS2339）、tag v0.2.0
- [ ] 段 3 report に jsSha256: ledger（schema・mergeCompiled・GET）v0.55.0 ＋ scheduler（compose v0.2.0・Compiled.hostTypes・flow・report_level・e2e）v0.22.0、dev:up → e2e 4 本

下ろした物（再提案しない）: amd64 の image（要る環境が無い）、npm への公開（その段階ではない。scheduler は fetch のまま）。

## 反証の記録（後回しの棚）

- 段 1: api.md の 422 を消す → check-doc-refs 赤（status が違う）。model に無い `DELETE /compile` の行 → 赤。`ja/api.md` を消す → 赤（対 ＋ ja の 3 ページのリンク先）。無いページへのリンク → 赤。建てた HTML のリンクは全部 base 付き（ja は `/ja` も）
- 段 2: service.ts の 422 の throw を `SourceHashMismatch` に差し替える → client の試験（instanceof CompileFailed）と server の試験（errortype の header）が赤。`generated/package.json` の `version` を消す → typecheck が TS2339 ×2（生成 client の runtimeConfig）。`smithy:check` は working tree の生成物を index と比べるので、model を変えた直後は stage してから走らせる
- 段 2 で分かったこと: `noPropertyAccessFromIndexSignature` を外すと eslint の `dot-notation` が `process.env["HOST"]` を `process.env.HOST` に直させる（src が失う規則はこの 1 つ）

---

# ts-compile-service の段取り（計画: https://claude.ai/artifact/A2eFLj9EsMtHfDscH5vKj8）

- [x] 段 1 capture-scripts を TS に（#1 → develop → release #2 → v0.2.0）
- [x] 段 2 足場: model・smithy-build.json・smithy.sh・generated・smithy:check（#1 の 1 つ目の commit）
- [x] 段 3 本体: compile・cache・hash・types/host.d.ts の写し・capture-scripts.pin・host-types:check（#1 の 2 つ目）
- [x] 段 4 server: service・server・main・HTTP の試験（#1 の 3 つ目）
- [x] 段 5 image と CI: Containerfile・ci.yaml の image job・release.yaml・tag v0.1.0（#2）。ghcr.io の package は public で出た
- [x] 段 6 capture-scheduler: compose・変数・doctor・compile_scripts・flow.yaml（#74 → release #75 → v0.21.0）
- [x] 段 7 capture-ledger: submodule v0.2.0（#372 → release #373 → v0.54.0）。scheduler と同じ回で release
- [x] 段 7 の閉じ: dev:down → dev:up → e2e 3 本（走る・受け口・型が通らない目録は落ちる）。archive の behaviors/custom.jsonl に "use strict" 付きの JS（コメントごと）が残っているのを dashboard の窓で見た
- [x] 段 8 docs: scheduler crawl.md（en/ja）と quickstart（#74 に同梱）、capture-scripts README（#1）、この repo の README

## 計画から変えたこと

- 段 2〜4 は 1 本の PR（#1）に 3 つの commit で入れた。段 2 だけでは typecheck も test も対象が無く、CI を緑にできない
- 生成物と src を 1 つの program で型検査する（project reference をやめた）。reference は生成物の d.ts を
  dist から解くので、CJS の印（generated/package.json）が dist に無く `export * from "./operations"` が解けなかった
- 受け皿の型と pin は cwd から読む。`import.meta.url` は src と dist で深さが違う

## 反証の記録

- 段 1: `const n: number = "x"` / `enum` / `remaining` の綴り違い → tsc が TS2322・TS1294・TS2551 で赤
- 段 2: `@httpError(422)` → 418 で `smithy:check` が赤（Aws_restJson1.ts と openapi.json に diff）
- 段 4: service の `errors: [ValidationException]` を外すと `smithy build` の projection が失敗して生成が止まる
  （計画の「400 の試験が赤」ではなく、その手前で止まる。model を書き換える反証は `smithy format` を通してから
  build すること —— 通さないと format --check で止まり、生成物が変わらないまま試験が緑に見える）
- 段 5: image を建てて起こし、/healthz・422（TS2322、TS7017 ではない）・200 を curl。CI の image job も同じ 3 本
- 段 6: 偽の変換サービスが 422 を返すと段が診断ごと投げる。サービスが居なければ投げる（単体）
- 段 7: 壊れた TS を台帳の CLI で目録に入れたクロールは Windmill で `compile:Failure`（`compile 422 CompileFailed: [TS2322 …]`）、
  fail_crawl が締めて台帳の `error` に理由が残る（e2e）。通る目録は plan → compile → hosts → report → index が全部 Success
