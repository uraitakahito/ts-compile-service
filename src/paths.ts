import { join } from "node:path";

/**
 * repo の根。**cwd を根とみなす。**
 *
 * `import.meta.url` から辿ると、source (`src/`) と emit (`dist/src/`) で深さが違う —— 実際に踏んだ。
 * この service は 2 つの起こし方しか無い: `pnpm` の script (根で走る) と、コンテナの `WORKDIR /app`
 * (`node dist/src/main.js`)。どちらも cwd が根。
 */
export const repoRoot = (): string => process.cwd();

/** 受け皿の型 (capture-scripts の写し)。 */
export const hostTypesPath = (): string => join(repoRoot(), "types", "host.d.ts");

/** 写した capture-scripts の tag。 */
export const pinPath = (): string => join(repoRoot(), "capture-scripts.pin");
