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
      "**/.github/**"
    ],
  },

  // ---------------------------------------------------------------------------
  // Base shared config
  // ---------------------------------------------------------------------------
  ...config,

  // ---------------------------------------------------------------------------
  // App config
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
      },
    },

    rules: {
      // disable handler naming rule for our project conventions
      'react/jsx-handler-names': 'off',
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
