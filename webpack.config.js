const path = require('path')

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'cheap-module-source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, 'src'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              '@babel/plugin-proposal-object-rest-spread',
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-transform-async-to-generator',
            ],
          },
        },
      },
    ],
  },
  entry: {
    l10n: './src/index.mjs',
    supportedLocales: './src/supported-locales.mjs',
    localeData: './src/locale-data.mjs',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
}
