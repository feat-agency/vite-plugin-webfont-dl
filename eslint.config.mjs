import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['**/dist/', '**/node_modules/', 'eslint.config.mjs'],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			globals: {
				...globals.node,
			},

			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				project: true,
			},
		},

		rules: {
			// function calls and parameters are not checked (same as before the flat config migration)
			'comma-dangle': ['error', {
				arrays: 'always-multiline',
				objects: 'always-multiline',
				imports: 'always-multiline',
				exports: 'always-multiline',
				functions: 'ignore',
			}],
			'comma-style': ['error', 'last'],
			quotes: ['warn', 'single'],
			semi: ['error', 'always'],

			'semi-spacing': ['error', {
				before: false,
				after: true,
			}],

			'@typescript-eslint/no-empty-interface': 0,
			'@typescript-eslint/prefer-nullish-coalescing': 0,
		},
	},
);
