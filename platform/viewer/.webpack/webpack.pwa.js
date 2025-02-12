// ~~ WebPack
const path = require('path');
const merge = require('webpack-merge');
const webpack = require('webpack');
const webpackBase = require('./../../../.webpack/webpack.base.js');
// ~~ Plugins
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractCssChunksPlugin = require('extract-css-chunks-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
// ~~ Rules
const extractStyleChunksRule = require('./rules/extractStyleChunks.js');
// ~~ Directories
const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');
const PUBLIC_DIR = path.join(__dirname, '../public');
// ~~ Env Vars
const HTML_TEMPLATE = process.env.HTML_TEMPLATE || 'index.html';
const PUBLIC_URL = process.env.PUBLIC_URL || '/';
const APP_CONFIG = process.env.APP_CONFIG || 'config/default.js';
const PROXY_TARGET = process.env.PROXY_TARGET;
const PROXY_DOMAIN = process.env.PROXY_DOMAIN;
const SKIP_MINIMIZE = process.env.SKIP_MINIMIZE;

module.exports = (env, argv) => {
  const baseConfig = webpackBase(env, argv, { SRC_DIR, DIST_DIR });
  const isProdBuild = process.env.NODE_ENV === 'production';
  const hasProxy = PROXY_TARGET && PROXY_DOMAIN;
  const skipMinimize = SKIP_MINIMIZE === 'true';

  const mergedConfig = merge(baseConfig, {
    devtool: isProdBuild ? 'source-map' : 'cheap-module-eval-source-map',
    output: {
      path: DIST_DIR,
      filename: isProdBuild ? '[name].bundle.[chunkhash].js' : '[name].js',
      publicPath: PUBLIC_URL, // Used by HtmlWebPackPlugin for asset prefix
    },
    stats: {
      colors: true,
      hash: true,
      timings: true,
      assets: true,
      chunks: false,
      chunkModules: false,
      modules: false,
      children: false,
      warnings: true,
    },
    optimization: {
      minimize: isProdBuild && !skipMinimize,
      sideEffects: true,
    },
    module: {
      rules: [...extractStyleChunksRule(isProdBuild)],
    },
    plugins: [
      // Uncomment to generate bundle analyzer
      // new BundleAnalyzerPlugin(),
      // Clean output.path
      new CleanWebpackPlugin(),
      // Copy "Public" Folder to Dist
      new CopyWebpackPlugin([
        {
          from: PUBLIC_DIR,
          to: DIST_DIR,
          toType: 'dir',
          // Ignore our HtmlWebpackPlugin template file
          // Ignore our configuration files
          ignore: ['config/*', 'html-templates/*', '.DS_Store'],
        },
        // Short term solution to make sure GCloud config is available in output
        // for our docker implementation
        {
          from: `${PUBLIC_DIR}/config/google.js`,
          to: `${DIST_DIR}/google.js`,
        },
        // Copy over and rename our target app config file
        {
          from: `${PUBLIC_DIR}/${APP_CONFIG}`,
          to: `${DIST_DIR}/app-config.js`,
        },
      ]),
      // https://github.com/faceyspacey/extract-css-chunks-webpack-plugin#webpack-4-standalone-installation
      new ExtractCssChunksPlugin({
        filename: isProdBuild ? '[name].[hash].css' : '[name].css',
        chunkFilename: isProdBuild ? '[id].[hash].css' : '[id].css',
        ignoreOrder: false, // Enable to remove warnings about conflicting order
      }),
      // Generate "index.html" w/ correct includes/imports
      new HtmlWebpackPlugin({
        template: `${PUBLIC_DIR}/html-templates/${HTML_TEMPLATE}`,
        filename: 'index.html',
        templateParameters: {
          PUBLIC_URL: PUBLIC_URL,
        },
        // favicon: `${PUBLIC_DIR}/favicon.ico`,
      }),
      new WorkboxPlugin.GenerateSW({
        swDest: 'sw.js',
        clientsClaim: true,
        skipWaiting: true,
      }),
    ],
    // https://webpack.js.org/configuration/dev-server/
    devServer: {
      // gzip compression of everything served
      // Causes Cypress: `wait-on` issue in CI
      // compress: true,
      // http2: true,
      // https: true,
      hot: true,
      open: true,
      port: 3000,
      host: '0.0.0.0',
      public: 'http://localhost:' + 3000,
      historyApiFallback: {
        disableDotRule: true,
      },
    },
  });

  if (hasProxy) {
    mergedConfig.devServer.proxy = {};
    mergedConfig.devServer.proxy[PROXY_TARGET] = PROXY_DOMAIN;
  }

  if (!isProdBuild) {
    mergedConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
  } else {
    mergedConfig.optimization.minimizer = [
      new TerserJSPlugin({
        sourceMap: true,
        parallel: true,
      }),
      // No bueno
      // new OptimizeCSSAssetsPlugin({}),
    ];
  }

  return mergedConfig;
};
