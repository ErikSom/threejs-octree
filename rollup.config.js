import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from "@rollup/plugin-terser";
import conditional from 'rollup-plugin-conditional';
import typescript from '@rollup/plugin-typescript';

const isProduction = process.env.NODE_ENV === 'production';

export default [
	{
		input: 'src/octree.ts',
		output: {
			file: 'dist/bundle.js',
			format: 'es'
		},
		plugins: [
			typescript({
				target: "es6",
			}),
			resolve(),
			commonjs(),

			conditional(isProduction, [
				terser(),
				]
			),
		]
	},
];
