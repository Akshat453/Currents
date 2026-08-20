import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["**/dist/**", "**/coverage/**", "**/generated/**", "**/uploads/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser }
    },
    plugins: { react, "react-hooks": hooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...hooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },
  prettier
];
