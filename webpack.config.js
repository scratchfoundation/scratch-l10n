const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'l10n.js',
    path: path.resolve(__dirname, 'dist')
  }
};