const nodeGlobals = {
  AbortController: "readonly",
  URL: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  fetch: "readonly",
  performance: "readonly",
  process: "readonly",
  setTimeout: "readonly",
};

function restrictLayers(files, patterns) {
  return {
    files,
    rules: {
      "no-restricted-imports": ["error", { patterns }],
    },
  };
}

export default [
  {
    ignores: ["node_modules/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: nodeGlobals,
      sourceType: "module",
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-useless-catch": "error",
      "prefer-const": "error",
    },
  },
  restrictLayers(
    ["src/platform/*.js"],
    ["../portfolio/*", "../chat/*", "../http/*", "../evaluation/*"],
  ),
  restrictLayers(
    ["src/portfolio/*.js"],
    ["../chat/*", "../http/*", "../evaluation/*"],
  ),
  restrictLayers(
    ["src/chat/*.js"],
    ["../http/*", "../evaluation/*"],
  ),
  restrictLayers(
    ["src/http/*.js"],
    ["../portfolio/*", "../evaluation/*"],
  ),
  restrictLayers(
    ["src/evaluation/*.js"],
    ["../http/*"],
  ),
];
