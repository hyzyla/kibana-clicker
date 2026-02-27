import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".plasmo/**", "build/**", "dist/**", "node_modules/**"]
  },
  tseslint.configs.recommended
);
