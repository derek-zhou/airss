/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
    exclude: [
	'**/node_modules/**/*',
	'#*',
	'*~'
    ],
    mount: {
	"src": "/dist",
	"public": "/"
    },
    plugins: [
	'@snowpack/plugin-babel',
	"@snowpack/plugin-postcss"
    ],
    routes: [
	/* Enable an SPA Fallback in development: */
	// {"match": "routes", "src": ".*", "dest": "/index.html"},
    ],
    packageOptions: {
	/* ... */
    },
    devOptions: {
	tailwindConfig: './tailwind.config.js'
	/* ... */
    },
    buildOptions: {
	/* ... */
    },
    optimize: {
	bundle: true,
	minify: false,
	sourcemap: false,
	target: 'es2017',
    },
};
