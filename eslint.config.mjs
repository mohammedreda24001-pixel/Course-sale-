// Simple ESLint config for Next.js
export default [
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
];
