// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      // Allow explicit any in legacy scripts
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow non-null assertions (we use them intentionally for DOM)
      "@typescript-eslint/no-non-null-assertion": "off",
      // Allow _-prefixed variables/params to be unused (intentional pattern)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/", ".astro/", "src/env.d.ts"],
  }
);
