import { defineConfig } from "tsup";

export default defineConfig({
  external: [],
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  injectStyle: false,
  splitting: false,
  sourcemap: false,
  treeshake: true,
  minify: true,
  clean: true,
  dts: true,
  outExtension: ({ format }) => ({
    js: `.${format === "esm" ? "mjs" : "cjs"}`,
  }),
});
