// (Assuming you're not using CRA's default behavior)
// eslint-disable-next-line no-undef
const devServer = new webpackDevServer(webpackConfig, {
    // ... other options
    allowedHosts: ['localhost'] // Set allowed host explicitly
  });
  