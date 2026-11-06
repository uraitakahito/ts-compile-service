---
title: API
description: The two operations, every status code they can answer with, and the shapes of request and response, read off the Smithy model
---

The interface is defined once, in `model/main.smithy`, and everything on this page is a reading
of it. The generated OpenAPI document (`generated/openapi.json`) is the machine-readable form.
The endpoint table below is checked against it in CI, so a status code that appears in one and
not the other fails the pull request.

## Endpoints

| Endpoint        | Status codes          | What it does                                                          |
| --------------- | --------------------- | --------------------------------------------------------------------- |
| `POST /compile` | 200 · 400 · 409 · 422 | Type-check a level's scripts as one program and return the JavaScript |
| `GET /healthz`  | 200 · 400             | Is it up, and with which compiler and host types                      |

Every error carries its type in the `x-amzn-errortype` response header (`ValidationException`,
`SourceHashMismatch`, `CompileFailed`) as well as in a JSON body. `400` is listed for `/healthz`
because the model attaches `ValidationException` to the whole service; a `GET` with no input
never actually triggers it.

## `POST /compile`

### Request

```json
{
  "variableNames": ["query"],
  "scripts": [
    {
      "id": "autoscroll",
      "version": 3,
      "phase": "behavior",
      "source": "…TypeScript…",
      "sha256": "…64 hex characters…",
      "options": {}
    }
  ]
}
```

| Field           | Constraint                              | Notes                                                                                                                                                 |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variableNames` | list of `^[a-z][a-z0-9_]*$`, at most 32 | The names of the variables given to this crawl. The values are not sent. Checked against the required declarations; a missing one is a 422 (`BH0001`) |
| `scripts`       | 0 to 100 items                          | All the level's scripts, in one request. Empty is valid: nothing is compiled and `scripts` comes back empty                                           |
| `id`            | `^[a-z][a-z0-9-]*$`, 1 to 64 chars      | Becomes the file name inside the program (`/src/<id>.ts`)                                                                                             |
| `version`       | integer                                 | Passed through untouched                                                                                                                              |
| `phase`         | `preload` or `behavior`                 | Passed through untouched                                                                                                                              |
| `source`        | string                                  | The TypeScript                                                                                                                                        |
| `sha256`        | `^[0-9a-f]{64}$`                        | sha256 of the UTF-8 bytes of `source`, as the ledger stamped it                                                                                       |
| `options`       | any JSON document, optional             | Passed through untouched                                                                                                                              |

All scripts are compiled **as one program**. They share the global scope in the page (none of
them is a module), so two scripts declaring the same top-level name is a type error here, exactly
as it would be a clash at runtime there. A script that [reads Zod](#reading-zod) is the exception:
it is a module to the compiler and sits inside a block in the page, so it clashes with nothing.

### 200

The same list, in the same order, with `source` replaced by the emitted JavaScript and `sha256`
by the hash of that JavaScript. `id`, `version`, `phase` and `options` come back untouched, also
when the answer comes from memory: they are always the request's own.

```json
{
  "typescript": "6.0.3",
  "hostTypes": "v0.10.0",
  "cached": false,
  "scripts": ["…"],
  "declarations": [
    {
      "id": "egov-law-search",
      "unreadable": false,
      "params": [
        {
          "name": "query",
          "kind": "variable",
          "required": true,
          "summary": "法令名の検索語",
          "schema": { "type": "string", "minLength": 1 }
        }
      ]
    }
  ]
}
```

`typescript` is the compiler version that produced the output. `hostTypes` is the capture-scripts
tag whose host types it was compiled against, the same value `/healthz` reports, so a report can
record both without asking the service again. `cached` is `true` when the same sequence of source
hashes was compiled recently and the JavaScript came from memory. Only the JavaScript is reused:
the same source sent under another name, another `phase` or another `options` gets those back.

An empty list answers the same way, with `scripts: []`. Nothing is compiled, but
`typescript` and `hostTypes` are still there, so a level that runs nothing can report what would
have compiled it.

`declarations` holds each script's variable declarations, in the order of `scripts` ([Declaring variables](#declaring-variables)).

### 400 ValidationException

The request broke a modelled constraint: an id with a capital letter, a hash that is not 64 hex
characters, more than 100 scripts. The body lists every violation with a JSON pointer to the field.

```json
{
  "message": "…",
  "fieldList": [{ "path": "/scripts/0/id", "message": "…" }]
}
```

This answer comes from the generated server, before any hand-written code runs.

### 409 SourceHashMismatch

`sha256` does not match `source`. The service does not convert what it cannot vouch for. A script
altered between the ledger and here is refused rather than emitted under a fresh hash. Why the
check exists at all, when TCP already protects the bytes: see
[Why verify at every hop](/#why-verify-at-every-hop).

```json
{ "message": "autoscroll: sha256 が台帳の約束と違う", "id": "autoscroll" }
```

### 422 CompileFailed

At least one script did not type-check or broke a rule. **No JavaScript comes back for any
script**, including the ones that were fine. A partially converted list would be indistinguishable
from a complete one to the consumer.

```json
{
  "message": "2 件の誤り",
  "typescript": "6.0.3",
  "diagnostics": [{ "file": "bad.ts", "line": 3, "col": 7, "code": "TS2322", "message": "…" }],
  "declarations": [{ "id": "bad", "params": [], "unreadable": false }],
  "missingVariables": []
}
```

`file`, `line` and `col` are absent for a diagnostic that has no position. `declarations` reads what
it can even when the types do not check, and `missingVariables` lists the required names that
`variableNames` did not have. With these two the ledger can refuse before it creates a crawl row.

A `code` starting with `TS` comes from TypeScript. One starting with `BH` is a rule of this service.

| `code`   | Meaning                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BH0001` | A required variable is not in `variableNames`. It points at that line of the declaration                                                                        |
| `BH0002` | A `defineParams` declaration cannot be read ([the forms it accepts](#declaring-variables)). `unreadable` in `declarations` is `true`                            |
| `BH0003` | Zod is read in a form [other than the two accepted](#reading-zod), not in the first statement, or with `import("zod")`. `// @ts-nocheck` does not turn this off |
| `BH0004` | A script whose `phase` is `preload` has an `import` or a `defineParams`. It runs in every frame on every navigation, with no host                               |
| `BH0005` | The script reads `__bh.vars` directly. `// @ts-nocheck` does not turn this off                                                                                  |
| `BH0006` | Not readable as a classic script: `export`, or a top-level `await` in a script with an `import`. In the page it would be a syntax error and nothing would run   |

## `GET /healthz`

```json
{ "ok": true, "typescript": "6.0.3", "hostTypes": "v0.10.0" }
```

`hostTypes` is the capture-scripts tag whose `types/host.d.ts` the service compiles against (the
content of `capture-scripts.pin`). A script that type-checks in capture-scripts' own CI at that
tag type-checks here.

## Reading Zod

A script can begin with one of these. Only these two forms are accepted. Any other package, and
`zod/locales`, is `TS2307`.

```ts
import { z } from "zod";
import * as z from "zod/mini";
```

The types come from the real Zod, the same version as capture-scripts (`host-types:check` looks).
The JavaScript cannot contain an `import`, because BrowserHive evaluates it as a classic script, so
it is assembled into this shape after emit:

```js
"use strict";
{
  // zod 4.6.7 (MIT)
  const { z } = (() => {
    /* Zod, bundled with only the names in use */
  })();
  // the script
}
```

- **Only the names in use are bundled.** `z.<name>` is collected, leaving out type positions. Expect
  85 KB (15 KB for `zod/mini`). A use whose name cannot be read, such as `z[key]`, bundles all of it
  (385 KB)
- **It is bundled `jitless`.** Otherwise Zod tries to build its fast validators with `new Function`.
  On a page whose `script-src` forbids eval, that throws, and a violation report goes to the site
- **It is wrapped in a block.** Wrapping it in a function would take the script's last expression
  out of the completion value, and BrowserHive could not wait for the script to finish
- **A script with no `import` keeps the same bytes as before.** Moving to another version of Zod or
  esbuild changes the JavaScript of the scripts that read Zod

Comments above the `import` do not survive into the JavaScript.

## Declaring variables

A script reads a crawl's variables with `defineParams`.

```ts
const { query } = defineParams(z.object({ query: z.string().min(1).describe("法令名の検索語") }));
```

- **The declaration is read without running it** (`src/vendor/read-params.ts`, a copy whose source of truth
  is capture-scripts). It accepts `z.object({ name: value })`, where a value is `z.string()` or `z.enum([…])`,
  followed only by `.min`, `.max`, `.length`, `.optional` and `.describe`, with literal arguments. Once per
  script. Anything else is `BH0002`.
- **A name without `.optional()` is required.** Missing from `variableNames`, it is `BH0001`.
- **Declarations are not cached.** The JavaScript depends only on the source, so the cache key does not change,
  and reading the declaration and checking the names happen on every request. The same TypeScript asked with,
  then without, then with the name answers 200, 422, 200.
- **In the JavaScript it becomes `globalThis.__bh.vars`.** If `z` is read only inside the declaration, Zod is
  not bundled.

## How the compiler is configured

The options are the same as capture-scripts' `tsconfig.json`, on purpose. A script that is green
in that repository's CI must be green here, and the other way round.

| Option               | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `target` / `module`  | ES2023 / ESNext                                                                                       |
| `moduleResolution`   | Bundler. From a script, only `zod` and `zod/mini` resolve                                             |
| `skipLibCheck`       | on: Zod's d.ts is not checked (three scripts take 117 ms instead of 556 ms)                           |
| `lib`                | ES2023 and DOM                                                                                        |
| `strict`             | on                                                                                                    |
| `erasableSyntaxOnly` | on: no enums, namespaces or parameter properties, so the JavaScript is the TypeScript minus its types |
| `removeComments`     | off: comments survive into the archive                                                                |

The emitted JavaScript begins with `"use strict";`, which the compiler adds to every non-module
file and the assembly adds to a script that [reads Zod](#reading-zod).

## Source of truth

- `model/main.smithy` is the model. Its doc comments are what the generated OpenAPI carries.
- `generated/openapi.json` is generated from the model by `pnpm run smithy`, committed, and
  diffed in CI.
