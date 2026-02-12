import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
});

export default [{
	ignores: ["**/dist/", "**/node_modules/", "eslint.config.mjs"],
}, ...compat.extends(
	"eslint:recommended",
	"plugin:@typescript-eslint/recommended-type-checked",
	"plugin:@typescript-eslint/stylistic-type-checked",
), {
	plugins: {
		"@typescript-eslint": typescriptEslint,
	},

	languageOptions: {
		globals: {
			...globals.node,
		},

		parser: tsParser,
		ecmaVersion: 5,
		sourceType: "commonjs",

		parserOptions: {
			tsconfigRootDir: __dirname,
			project: true,
		},
	},

	rules: {
		"comma-dangle": ["error", "always-multiline"],
		"comma-style": ["error", "last"],
		quotes: ["warn", "single"],
		semi: ["error", "always"],

		"semi-spacing": ["error", {
			before: false,
			after: true,
		}],

		"@typescript-eslint/no-empty-interface": 0,
		"@typescript-eslint/prefer-nullish-coalescing": 0,
	},
}];
