import { z } from "zod";

/** ページの値の形を確かめる見本。JS の sha256 を test/zod.test.ts が固定する。 */
const Page = z.object({ title: z.string().min(1), hits: z.number().int() });

(async () => {
  const parsed = Page.safeParse({ title: document.title, hits: 1 });
  globalThis.__bh.report(parsed.success ? parsed.data : z.treeifyError(parsed.error));
})();
