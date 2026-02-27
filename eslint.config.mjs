import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".wxt/**", ".output/**", "node_modules/**"]
  },
  tseslint.configs.recommended
);
