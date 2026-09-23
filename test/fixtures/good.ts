/** doc comment stays? */
(async (): Promise<void> => {
  const opts = (globalThis.__bh.opts["autoscroll"] ?? {}) as { maxSteps?: unknown }; // trailing
  const maxSteps = Number(opts.maxSteps ?? 40);
  interface Report {
    reachedBottom: boolean;
  }
  // line comment
  const r: Report = { reachedBottom: maxSteps > 0 };
  globalThis.__bh.report("autoscroll", r satisfies Report);
})();
