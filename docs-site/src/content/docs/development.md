---
title: Development
description: Regenerating the server from the model, running the checks, building the image, and keeping the docs honest
---

## Commands

```sh
pnpm install
pnpm run smithy      # model/ → generated/ (downloads the Smithy CLI once; no Java needed)
pnpm run check       # audit → smithy:check → host-types:check → typecheck → lint → format:check → test → build
pnpm run build && pnpm start
```

`pnpm run check` is exactly what CI runs, in the same order, one step per line so the failing
step is readable in the GitHub UI.

## The model comes first

`model/main.smithy` defines the service. From it, `pnpm run smithy` produces:

- `generated/ssdk/`, the TypeScript server SDK: routing, validation, serialisation, error
  mapping.
- `generated/openapi.json`, the same interface as OpenAPI 3.1, for readers and for the docs
  check.
- `generated/client/`, a TypeScript client generated from the same model (the `client`
  projection in `smithy-build.json`). It is not published and not in the image. Its one consumer
  is the contract test below.

All three are **committed**. Nobody needs a JVM to read the code, the runtime image never sees the code
generator, and CI runs `smithy:check`, which regenerates and then runs
`git diff --exit-code -- generated`, so a model edit without its regenerated output is red.

The Smithy CLI is downloaded by `scripts/smithy.sh` as the zip for your OS, with its own JRE,
into `.smithy-cli/`. This is not a Maven or Gradle project.

### Changing the model

1. Edit `model/main.smithy`. `pnpm run smithy:format` normalises it; the build refuses an
   unformatted model.
2. `pnpm run smithy`. The generated types change.
3. `pnpm run typecheck`. Whatever the hand-written `src/service.ts` now fails to provide is your
   to-do list.
4. Commit `generated/` together with the model.

A required member in the model is still `T | undefined` in the generated types. The generated
server has validated it before the operation runs, and `src/service.ts` asserts presence once at
the top.

## The host types

Scripts are compiled against `__bh`, the object BrowserHive injects into the page. Its type is a
**copy** of capture-scripts' `types/host.d.ts`, and `capture-scripts.pin` names the tag the copy
came from. CI's `host-types:check` fetches that tag's file from GitHub and fails if the copy
differs by a byte.

To move to a newer capture-scripts, follow these steps. Never edit the copy. The source of truth is
the other repository.

1. Point `capture-scripts.pin` at the new tag and copy that tag's `types/host.d.ts` and
   `tools/read-params.ts` (to `src/vendor/read-params.ts`) byte for byte. `pnpm run host-types:check`
   compares them with the tag's raw files.
2. Run `pnpm test`. If the types changed, bring the TypeScript in `test/fixtures/` and the
   expectations in `test/compile.test.ts` (the pinned sha256, the exact list of diagnostics) up to
   the new types, and add a fixture and a test that use them. Make the test one that goes red on the
   old copy, so that it also says which version the copy is.
3. If the way scripts call the host changed, also fix the script that the image job in
   `.github/workflows/ci.yaml` sends.
4. Bring the examples in the docs to the version you are releasing: the `hostTypes` value (on
   [API](/api/) and [Quickstart](/quickstart/)), the image tag (the `container run` and compose
   examples on Quickstart; the tag you are about to cut), and the examples that call the host (the
   `src=` lines on Quickstart).

## Zod and esbuild

`src/zod-bundle.ts` bundles a script's `import` ([API](/api/#reading-zod) has the shape). Both are
runtime dependencies at pinned versions. Moving either changes the JavaScript of the scripts that
read Zod, so there are steps:

1. Move Zod in capture-scripts first, tag it, and point `capture-scripts.pin` at that tag.
   `host-types:check` compares the version with that repository's dev dependency.
2. Run `pnpm test`. The pinned sha256 in `test/zod.test.ts` goes red. That is the point: you find out
   the JavaScript changed before you update the value.
3. See that the size window and the test counting `new Function` through `node:vm` stay green. A
   change in how Zod reaches its JIT shows up here.

`allowBuilds` keeps esbuild's build script from running (`pnpm-workspace.yaml`). The binary is read
from `@esbuild/<platform>` at run time.

## Tests

`pnpm test` runs vitest. `test/compile.test.ts` exercises the compiler wrapper on fixtures (a
good script, one with a type error, one with an `enum`). `test/server.test.ts` starts the
generated server on port 0 and speaks HTTP to it, with the compiler replaced by a counting stub
so it can assert that constraint violations never reach it. `test/service.test.ts` calls the
operation directly with a cache of its own, to pin down what a cache hit answers: the JavaScript
is reused, the names, versions, `phase` and `options` are the request's.

`test/params.test.ts` covers `defineParams` and the check against the names given. The order test does
the most: it asks the same TypeScript with, without and with the name, and looks at 200, 422, 200 and `cached`.

`test/zod.test.ts` runs the assembled JavaScript in `node:vm`, to see how it behaves with no
browser: it replaces `Function` with a Proxy that counts the calls, and looks at the completion value
and at strict mode. The check with a real Chromium and a real CSP is in capture-scheduler's e2e.

`test/client.test.ts` is the contract test: it drives the same server through the generated
client, configured with nothing but an `endpoint`. If the hand-written service drifts from the
model, the typed answers go red, as a missing member of the output or an error that is no longer
a `CompileFailed` instance.

## The image

```sh
container build -t ts-compile-service:dev -f Containerfile .
container run --rm -p 127.0.0.1:8080:8080 ts-compile-service:dev
```

Three stages: production dependencies (hoisted, since the runtime has no pnpm store), a builder
that runs `tsc`, and a `node:alpine` runtime with `node_modules`, `dist`, the host-type copy and
the pin. Neither the Smithy CLI nor a JVM is in any stage.

CI builds the image on every pull request, starts it, and sends it a script with a type error,
expecting a 422 that mentions `TS2322` and not `TS7017`, which is what a missing host-type copy
would produce. It also sends a script that reads Zod and expects a 200, which fails if zod or esbuild
fell out of the `--prod` dependencies.

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yaml`, which builds `linux/arm64` on an
ARM runner and pushes `ghcr.io/uraitakahito/ts-compile-service:vX.Y.Z`. The `version` in
`package.json` is not the version. The tag is.

## Documentation

```sh
pnpm run site:dev     # local preview
pnpm run site:check   # build + scripts/check-doc-refs.mjs
```

`site:check` runs on every pull request. The build alone is not a guard: on `.md` pages
Starlight's loader swallows rendering errors and exits 0. So `scripts/check-doc-refs.mjs` does
the checking:

- every English page has a Japanese twin under `ja/` with the same file name, and the other way
  round;
- every `[link](/page/)` in prose points at a page that exists in that locale;
- every repository path written in a code span exists;
- the endpoint table on the [API](/api/) page lists exactly the paths, methods and status codes
  that `generated/openapi.json` does.

Pages live in `docs-site/src/content/docs/` (English) and `docs-site/src/content/docs/ja/`
(Japanese). Update both together. A missing translation is a red check, not a silent fallback.
