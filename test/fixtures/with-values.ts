import { z } from "zod";

/** 変数を defineParams で、シークレットを受け皿で読む (capture-scripts v0.11.0 から)。 */
(async (): Promise<void> => {
  const { query } = defineParams(z.object({ query: z.string() }));
  const token = globalThis.__bh.secrets.api_token;
  globalThis.__bh.report({ query, hasToken: token !== undefined });
})();
