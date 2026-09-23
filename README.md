# ts-compile-service

TypeScript を型検査して JavaScript にする常駐サービス。[capture-scripts](https://github.com/uraitakahito/capture-scripts)
の TS を [capture-ledger](https://github.com/uraitakahito/capture-ledger) の目録が配り、
[capture-scheduler](https://github.com/uraitakahito/capture-scheduler) の Windmill の flow が
クロールの段ごとにここへ送って、[BrowserHive](https://github.com/uraitakahito/browserhive) が評価する
JS を受け取る。**型が通らなければ 1 本も返さず、段ごと落とす。** interface は Smithy（`model/main.smithy`）で
定義し、server は model から生成する。

## Documentation

使い方（image の起こし方・`curl` で 1 本変換・env）、API（2 つの口と全 status、request と response の形）、
直し方（model → 生成 → check、image、docs）は docs サイトに:

- **English** — <https://uraitakahito.github.io/ts-compile-service/>
- **日本語** — <https://uraitakahito.github.io/ts-compile-service/ja/>

## Related Projects

- [capture-scripts](https://github.com/uraitakahito/capture-scripts) — 変換される TS と、受け皿の型の出どころ
- [capture-scheduler](https://github.com/uraitakahito/capture-scheduler) — flow の `compile` の段がここを呼ぶ
- [capture-ledger](https://github.com/uraitakahito/capture-ledger) — TS の目録。sha256 は TS のバイト列に打つ
- [BrowserHive](https://github.com/uraitakahito/browserhive) — 返した JS を sha256 で照合して評価する

## License

MIT
