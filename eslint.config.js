import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

export default tseslint.config(
  // ── Ignore generated / config files ─────────────────────────────
  {
    ignores: ["dist/**", "node_modules/**", "*.config.*"],
  },

  // ── Base JS rules ────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript rules ─────────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── Vue rules ────────────────────────────────────────────────────
  ...pluginVue.configs["flat/recommended"],

  // ── Language options (browser globals + TS parser for .vue) ──────
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // ── Project-wide rules ───────────────────────────────────────────
  {
    rules: {
      // --- Brackets & braces ---------------------------------------
      // Always require { } for if / else / for / while bodies
      curly: ["error", "all"],
      // Disallow single-line blocks: if (x) { stmt; } must be multiline
      // (Prettier auto-fixes these when you run `npm run format`)
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
      // Require a blank line before and after if / for / while / do / switch / try
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "for", "while", "do", "switch", "try"],
        },
        {
          blankLine: "always",
          prev: ["if", "for", "while", "do", "switch", "try"],
          next: "*",
        },
      ],

      // --- Whitespace around keywords & conditions -----------------
      // Space after keywords: if (...), for (...), while (...)
      "keyword-spacing": ["error", { before: true, after: true }],
      // Space before opening brace:  if (x) {
      "space-before-blocks": "error",
      // Space around operators:  a === b, x += 1
      "space-infix-ops": "error",
      // No space inside parentheses:  if (x)  not  if ( x )
      "space-in-parens": ["error", "never"],

      // --- Code quality --------------------------------------------
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // --- TypeScript ----------------------------------------------
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // --- Vue: code quality ---------------------------------------
      "vue/component-name-in-template-casing": ["error", "PascalCase"],
      "vue/no-unused-vars": "error",
      // Allow single-word component names (e.g. <Badge>, <Card>)
      "vue/multi-word-component-names": "off",
      // Enforce self-closing on components with no content
      "vue/html-self-closing": [
        "error",
        {
          html: { void: "always", normal: "always", component: "always" },
          svg: "always",
          math: "always",
        },
      ],

      // --- Vue: formatting (handled by Prettier — silence here) ----
      "vue/max-attributes-per-line": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/attributes-order": "off",
      // withDefaults() satisfies defaults without ? on every prop
      "vue/no-required-prop-with-default": "off",
      // Optional props on UI primitives don't need defaults (e.g. Avatar src, Tooltip text)
      "vue/require-default-prop": "off",
    },
  },
);
