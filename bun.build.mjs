await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "browser", // default
  format: "esm",
  minify: false,
  external: [],
});
