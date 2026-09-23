# ts-compile-service の段取り（計画: https://claude.ai/artifact/A2eFLj9EsMtHfDscH5vKj8）

- [ ] 段 1 capture-scripts を TS に（PR → develop → release v0.2.0）
- [ ] 段 2 足場: model・smithy-build.json・smithy.sh・generated・smithy:check
- [ ] 段 3 本体: compile・cache・hash・types/host.d.ts の写し・capture-scripts.pin・host-types:check
- [ ] 段 4 server: service・server・main・HTTP の試験
- [ ] 段 5 image と CI: Containerfile・ci.yml・release.yml・tag v0.1.0（ghcr.io）
- [ ] 段 6 capture-scheduler: compose・変数・doctor・compile_scripts・flow.yaml（develop に PR）
- [ ] 段 7 capture-ledger: submodule v0.2.0。scheduler と同じ回で release。dev:up → e2e
- [ ] 段 8 docs

## 反証の記録

（段ごとに、何を壊して何が赤くなったかを書く）
