#!/usr/bin/env node
/**
 * `types/host.d.ts` が、`capture-scripts.pin` の tag の `types/host.d.ts` と 1 バイトも違わないことを見る。
 *
 * 受け皿 `__bh` の型は capture-scripts が正で、ここに在るのは写し。写しがずれると、向こうの CI で通った TS が
 * ここで 422 になる (逆も)。submodule にしないのは、写す物が 1 ファイルだから —— raw を 1 回引けば足りる。
 *
 * network が要る。落ちたら、pin か写しのどちらかがずれている (どちらが正しいかは中身を見て決める)。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pin = readFileSync(join(root, "capture-scripts.pin"), "utf8").trim();
if (!/^v\d+\.\d+\.\d+$/.test(pin)) {
  process.stderr.write(`capture-scripts.pin は tag (vX.Y.Z) であること: ${JSON.stringify(pin)}\n`);
  process.exit(1);
}

const url = `https://raw.githubusercontent.com/uraitakahito/capture-scripts/${pin}/types/host.d.ts`;
const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
if (!res.ok) {
  process.stderr.write(
    `${url} → ${String(res.status)}。tag が無いか、その tag に types/host.d.ts が無い\n`,
  );
  process.exit(1);
}
const upstream = await res.text();
const copy = readFileSync(join(root, "types", "host.d.ts"), "utf8");
if (upstream !== copy) {
  process.stderr.write(
    `types/host.d.ts が capture-scripts ${pin} の物と違う。` +
      "capture-scripts が正 —— 写し直すか、pin を上げること\n",
  );
  process.exit(1);
}
process.stdout.write(`✓ types/host.d.ts は capture-scripts ${pin} と同じ\n`);
