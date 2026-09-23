# ts-compile-service

TypeScript を型検査して JavaScript にする常駐サービス。[capture-scripts](https://github.com/uraitakahito/capture-scripts)
の TS を [capture-ledger](https://github.com/uraitakahito/capture-ledger) の目録が配り、
[capture-scheduler](https://github.com/uraitakahito/capture-scheduler) の Windmill の flow が
クロールの段ごとにここへ送って、[BrowserHive](https://github.com/uraitakahito/browserhive) が評価する
JS を受け取る。**型が通らなければ 1 本も返さず、段ごと落とす。**

interface の定義は Smithy（`model/main.smithy`）。server は model から生成し（`generated/ssdk`）、
手で書くのは 2 つの操作の中身（`src/service.ts`）と変換の本体（`src/compile.ts`）だけ。

## 使う

```sh
container run -d --name ts-compile.capture-scheduler --dns-domain capture-scheduler \
  ghcr.io/uraitakahito/ts-compile-service:v0.1.0
curl http://ts-compile.capture-scheduler:8080/healthz
# {"ok":true,"typescript":"6.0.3","hostTypes":"v0.2.0"}
```

| 口                                                                               | 答え                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /compile` `{ scripts: [{ id, version, phase, source, sha256, options }] }` | `200 { typescript, cached, scripts }`（source と sha256 だけ JS に）                  |
|                                                                                  | `400 ValidationException`（model の制約: id の綴り・sha256 の形・1〜100 本）          |
|                                                                                  | `409 SourceHashMismatch`（sha256 が source と合わない）                               |
|                                                                                  | `422 CompileFailed { typescript, diagnostics: [{ file, line, col, code, message }] }` |
| `GET /healthz`                                                                   | `200 { ok, typescript, hostTypes }`                                                   |

env は `PORT`（8080）・`HOST`（0.0.0.0）・`TS_COMPILE_CACHE_MAX`（256）。同じ TS の並びは 2 回目から cache で返る。

受け皿 `__bh` の型は capture-scripts の `types/host.d.ts` の写しで、どの tag の物かは
`capture-scripts.pin`。写しは CI（`host-types:check`）が tag の raw と突き合わせる。

## 直す

```sh
pnpm install
pnpm run smithy          # model → generated/ (Smithy CLI は JRE 同梱の zip を .smithy-cli/ に落とす。Java は要らない)
pnpm run check           # audit → smithy:check → host-types:check → typecheck → lint → format → test → build
pnpm run build && pnpm start
```

model を変えたら `pnpm run smithy` で生成物を作り直して commit する。CI の `smithy:check` は
再生成して `git diff --exit-code` を見る —— model と生成物がずれていれば赤。

## Related Projects

- [capture-scripts](https://github.com/uraitakahito/capture-scripts) — 変換される TS と、受け皿の型の出どころ
- [capture-scheduler](https://github.com/uraitakahito/capture-scheduler) — flow の `compile` の段がここを呼ぶ
- [capture-ledger](https://github.com/uraitakahito/capture-ledger) — TS の目録。sha256 は TS のバイト列に打つ
- [BrowserHive](https://github.com/uraitakahito/browserhive) — 返した JS を sha256 で照合して評価する

## License

MIT
