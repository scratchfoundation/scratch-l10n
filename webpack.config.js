const defaultsDeep = require('lodash.defaultsdeep');
const path = require('path');
const webpack = require('webpack');


const base = {
    devtool: 'cheap-module-source-map',
    module: {
        rules: [{
            test: /\.jsx?$/,
            loader: 'babel-loader',
            include: path.resolve(__dirname, 'src')
        }]
    },
    plugins: []
        .concat(process.env.NODE_ENV === 'production' ? [
            new webpack.optimize.UglifyJsPlugin({
                include: /\.min\.js$/,
                minimize: true
            })
        ] : [])
};

module.exports = [
    // For use as a library
    defaultsDeep({}, base, {
        externals: {
            'react': 'react',
            'react-dom': 'react-dom'
        },
        entry: {
            l10n: './src/index.js'
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].js',
            libraryTarget: 'commonjs2'
        }
    })
];
