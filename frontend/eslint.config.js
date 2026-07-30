import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    // Build output, dependencies and tool scratch dirs are never linted.
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "reports/**",
      ".stryker-tmp/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // A leading underscore marks an intentionally unused binding.
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
    // Browser-targeted application source.
    files: ["src/ts/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
    },
  },

  {
    // Vitest suites run in jsdom but import their own globals explicitly.
    files: ["tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Test doubles legitimately need `any` when standing in for DOM/API shapes.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    // Vite/Vitest/Stryker config files execute in Node.
    files: ["*.config.ts", "*.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
);
