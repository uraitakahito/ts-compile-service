import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      // Smithy が生成した物。自分の lint を当てても直せない
      "generated/**",
      // node が直に走らせる道具。TS の project の外
      "scripts/**",
      // 変換される側の TS と、受け皿の型の写し。この project の source ではない (tsconfig も除外)
      "test/fixtures/**",
      "types/**",
      ".smithy-cli/**",
      "build/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  prettier,
);
