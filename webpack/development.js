const baseConfig = require('./base');
const webpack = require('webpack');
const path = require('path');
const pkg = require(path.resolve(process.cwd(), './package.json'));
const notifier = require('node-notifier');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const warnImage = path.resolve(__dirname, '../assets/warn.png');
const errorImage = path.resolve(__dirname, '../assets/error.png');

module.exports = options => {
  const { port, title } = options || {};
  const config = baseConfig(options);
  config.plugins.push(
    new FriendlyErrorsWebpackPlugin({
      onErrors: (severity, errors) => {
        if (severity === 'error') {
          const error = errors[0]
          notifier.notify({
            title: 'My Project Generator',
            message: `${severity} : ${error.name}`,
            subtitle: error.file || '',
            contentImage: errorImage,
            sound: 'Glass'
          })
        }
      }
    })
  );
  config.plugins.push(
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, '../assets/template.ejs'),
      inject: 'body',
      chunks: ['index'],
      templateParameters: {
        title: title ? title : `${pkg.name}@${pkg.version}`,
        development: true,
      }
    }),
  );
  
  config.plugins.push(
    new webpack.HotModuleReplacementPlugin()
  );

  return config
}
