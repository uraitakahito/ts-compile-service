/** 受け皿の vars と secrets (capture-scripts v0.6.0 から) を読む。値は string | undefined なので ?? で受ける */
(async (): Promise<void> => {
  const query = String(globalThis.__bh.vars.query ?? "既定の語");
  const token = globalThis.__bh.secrets.api_token;
  globalThis.__bh.report("with-values", { query, hasToken: token !== undefined });
})();
