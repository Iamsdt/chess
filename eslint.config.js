import config from "@10xscale/eslint-modern"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  // ---------------------------------------------------------------------------
  // 🚫 Ignore test files completely
  // ---------------------------------------------------------------------------
  {
    ignores: [
      "**/src/tests/**",
      "**/*.test.{js,jsx}",
      "**/*.spec.{js,jsx}",
      "**/src/services/mock/**",
      "**/.github/**",
      "**/public/**",
    ],
  },

  // ---------------------------------------------------------------------------
  // Base shared config
  // ---------------------------------------------------------------------------
  ...config,

  // ---------------------------------------------------------------------------
  // App config — overrides for this chess project
  // ---------------------------------------------------------------------------
  {
    languageOptions: {
      globals: {
        window: "readonly",
        navigator: "readonly",
        document: "readonly",
        FormData: "readonly",
        File: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        atob: "readonly",
        btoa: "readonly",
        URL: "readonly",
        AbortController: "readonly",
        performance: "readonly",
        PerformanceObserver: "readonly",
        module: "readonly",
        alert: "readonly",
        AbortSignal: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        process: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
      },
    },

    rules: {
      // ── React ────────────────────────────────────────────────────────────
      "react/jsx-handler-names": "off",
      // PropTypes not required for a JS project — use TypeScript for type safety
      "react/prop-types": "off",
      // Allow both arrow functions and named functions for components
      "react/function-component-definition": "off",
      // Allow array index in keys when there's no stable id available
      "react/no-array-index-key": "warn",

      // ── Complexity — chess logic is inherently complex ───────────────────
      // Allow higher complexity for game logic functions
      "complexity": ["warn", { max: 25 }],
      "sonarjs/cognitive-complexity": ["warn", 30],
      // Large functions are acceptable in game logic hooks
      "max-lines-per-function": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],

      // ── Naming conventions ───────────────────────────────────────────────
      // Allow common abbreviations used in chess code
      "unicorn/prevent-abbreviations": [
        "error",
        {
          replacements: {
            // Allow chess-specific abbreviations
            preFen: false,
            postFen: false,
            fen: false,
            san: false,
            uci: false,
            pgn: false,
            // Allow e for catch blocks - too common
            e: false,
          },
          allowList: {
            preFen: true,
            postFen: true,
            fen: true,
            san: true,
            uci: true,
            pgn: true,
            pv: true,
            adv: true,
            idx: true,
            osc: true,
            cls: true,
          },
        },
      ],

      // ── Promises ─────────────────────────────────────────────────────────
      // Relax promise rules — fire-and-forget patterns are common in UI code
      "promise/always-return": "warn",
      "promise/no-nesting": "warn",

      // ── Duplicates ───────────────────────────────────────────────────────
      // Increase threshold for duplicate literals (chess notation is repetitive)
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],

      // ── Misc ─────────────────────────────────────────────────────────────
      // Allow consistent returns in functions that sometimes return early
      "consistent-return": "warn",
      // Disable handler naming rule
      "react/jsx-handler-names": "off",
      // React compiler memoization preservation — warn instead of error
      "react-hooks/preserve-manual-memoization": "warn",
    },

    settings: {
      "import/resolver": {
        alias: {
          map: [
            ["@", path.resolve(__dirname, "./src")],
            ["@hooks", path.resolve(__dirname, "./src/hooks")],
            ["@lib", path.resolve(__dirname, "./src/lib")],
            ["@context", path.resolve(__dirname, "./src/lib/context")],
            ["@pages", path.resolve(__dirname, "./src/pages")],
            ["@constants", path.resolve(__dirname, "./src/lib/constants")],
            ["@api", path.resolve(__dirname, "./src/services/api")],
            ["@query", path.resolve(__dirname, "./src/services/query")],
            ["@store", path.resolve(__dirname, "./src/services/store")],
            ["@public", path.resolve(__dirname, "./public")],
          ],
          extensions: [".js", ".jsx"],
        },
        node: {
          extensions: [".js", ".jsx"],
        },
      },
    },
  },
]
