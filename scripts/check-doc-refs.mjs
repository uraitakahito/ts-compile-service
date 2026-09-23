/**
 * docs-site と repo の中身がずれていないかを見る。`pnpm run site:check` (build ＋ これ) で走る。
 *
 * `astro build` は守りにならない —— .md のページは Starlight の docs loader が描画の例外を握り潰して
 * exit 0 で終わる (crawler の他の repo で実測)。だから機械の守りはここに置く。見るのは 4 つ:
 *
 *   1. en と ja の対: docs/*.md と docs/ja/*.md が同じ file 名で揃っている (見出しの構造は見ない ——
 *      同じ見出しを強制すると日本語が悪くなる)
 *   2. 本文の [x](/page/) が、同じ locale に在るページを指す
 *   3. 本文が code span で名指しする repo の path (`src/…` `model/…` `generated/…` …) が実在する
 *   4. api.md の「口の表」が generated/openapi.json と一致する: path・method・status の集合を
 *      **両方向**で比べる (docs に在って model に無い口も、model に在って docs に無い status も赤)
 *
 * 4 が要るのは、表が手で写した物だから。model を変えて `pnpm run smithy` すると openapi.json は変わるが、
 * 表は誰かが直すまで古いまま —— それをこの検査が PR で止める。表の行の形は
 * `| \`POST /compile\` | 200 · 400 · 409 · 422 | …` (prettier が cell を空白で揃えても読める)。
 *
 * 効いているのを見るには: api.md の status を 1 つ消す → 赤。model に無い口の行を足す → 赤。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCS = resolve(ROOT, "docs-site/src/content/docs");
const problems = [];

const pages = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort();
const en = pages(DOCS);
const ja = pages(join(DOCS, "ja"));

// ─── 1. en と ja の対 ─────────────────────────────────────────────────────
for (const f of en) if (!ja.includes(f)) problems.push(`docs/ja/${f} が無い (en には在る)`);
for (const f of ja) if (!en.includes(f)) problems.push(`docs/${f} が無い (ja には在る)`);

for (const [locale, f] of [...en.map((f) => ["", f]), ...ja.map((f) => ["ja/", f])]) {
  const rel = `docs/${locale}${f}`;
  const text = readFileSync(join(DOCS, locale, f), "utf8");

  // ─── 2. 内部リンク → 同じ locale のページ ────────────────────────────────
  // code (fence と span) の中はリンクではない。`[link](/page/)` と書いた説明文を実リンクと読まないように
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  for (const [, slug] of prose.matchAll(/\]\(\/([a-z0-9-]+)\/(?:#[^)]*)?\)/g)) {
    if (!existsSync(join(DOCS, locale, `${slug}.md`))) {
      problems.push(`${rel}: リンク /${slug}/ の先のページが無い`);
    }
  }

  // ─── 3. 名指しした path の実在 ─────────────────────────────────────────
  for (const [, path] of text.matchAll(
    /`((?:src|test|scripts|model|generated|types|docs-site|\.github)\/[A-Za-z0-9_./-]+)`/g,
  )) {
    if (!existsSync(resolve(ROOT, path)))
      problems.push(`${rel}: \`${path}\` が無い (移した? 消した?)`);
  }
}

// ─── 4. api.md の口の表 ⇔ generated/openapi.json ──────────────────────────
const openapi = JSON.parse(readFileSync(resolve(ROOT, "generated/openapi.json"), "utf8"));
const modeled = new Map(); // "POST /compile" → "200 400 409 422"
for (const [path, ops] of Object.entries(openapi.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    modeled.set(`${method.toUpperCase()} ${path}`, Object.keys(op.responses).sort().join(" "));
  }
}
for (const locale of ["", "ja/"]) {
  const rel = `docs/${locale}api.md`;
  const file = join(DOCS, locale, "api.md");
  if (!existsSync(file)) {
    problems.push(`${rel} が無い`);
    continue;
  }
  const documented = new Map();
  for (const [, method, path, codes] of readFileSync(file, "utf8").matchAll(
    /^\|\s*`(GET|POST|PUT|DELETE|PATCH) (\/[^`\s]*)`\s*\|\s*([0-9][0-9 ·]*?)\s*\|/gm,
  )) {
    documented.set(
      `${method} ${path}`,
      codes
        .split("·")
        .map((c) => c.trim())
        .filter(Boolean)
        .sort()
        .join(" "),
    );
  }
  if (documented.size === 0) {
    problems.push(`${rel}: 口の表が見つからない (| \`POST /path\` | 200 · 400 | の形の行)`);
  }
  for (const [key, codes] of modeled) {
    const got = documented.get(key);
    if (got === undefined) problems.push(`${rel}: model に在る口 ${key} の行が無い`);
    else if (got !== codes) {
      problems.push(`${rel}: ${key} の status が違う —— docs [${got}] / model [${codes}]`);
    }
  }
  for (const key of documented.keys()) {
    if (!modeled.has(key)) problems.push(`${rel}: model に無い口 ${key} が表に在る`);
  }
}

// ─── 報告 ─────────────────────────────────────────────────────────────────
if (problems.length > 0) {
  console.error(`✗ docs と repo がずれている (${problems.length} 件):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\ndocs が指す物が無いか、表が model と違う。docs を直すか、消した物を戻すこと。");
  process.exit(1);
}
console.log(
  `✓ docs と repo は揃っている (${en.length} ページ × 2 locale、口 ${modeled.size}、status は model どおり)`,
);
