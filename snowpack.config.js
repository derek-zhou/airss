/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
      "src": "/"
  },
  plugins: [
      /* ... */
      "@snowpack/plugin-svelte",
      "@snowpack/plugin-postcss"
  ],
  routes: [
    /* Enable an SPA Fallback in development: */
    // {"match": "routes", "src": ".*", "dest": "/index.html"},
  ],
  optimize: {
    /* Example: Bundle your final build: */
    // "bundle": true,
  },
  packageOptions: {
    /* ... */
  },
  devOptions: {
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
};
