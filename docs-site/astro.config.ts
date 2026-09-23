import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { satteri } from "@astrojs/markdown-satteri";
import hastRebaseLinks from "./src/plugins/hast-rebase-links";

const BASE = "/ts-compile-service";

export default defineConfig({
  // user page の origin ＋ repo 名の base。actions/configure-pages は使わない (注入する物が無い)
  site: "https://uraitakahito.github.io",
  base: BASE,
  integrations: [
    starlight({
      title: "ts-compile-service Docs",
      // API の表の中の code (口と status の並び) を折り返さない
      customCss: ["./src/styles/tables.css"],
      // 英語が根 (接頭辞無し)、日本語は /ja/ の下。crawler の他の repo と同じ形
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語", lang: "ja" },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/uraitakahito/ts-compile-service",
        },
      ],
      // Starlight はページを訳すがナビは訳さない。translations が無いと
      // 英語の目次に日本語のページがぶら下がる
      sidebar: [
        { label: "Overview", translations: { ja: "概要" }, slug: "index" },
        { label: "Quickstart", translations: { ja: "クイックスタート" }, slug: "quickstart" },
        { label: "API", translations: { ja: "API" }, slug: "api" },
        { label: "Development", translations: { ja: "開発" }, slug: "development" },
      ],
    }),
  ],
  markdown: {
    // 本文の [x](/page/) に base と /ja を付ける。Starlight が書き換えるのはナビだけ
    processor: satteri({ hastPlugins: [hastRebaseLinks] }),
  },
});
