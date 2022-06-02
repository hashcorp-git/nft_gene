const webpack = require("webpack");
const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",
  entry: ["@babel/polyfill", path.resolve(__dirname, "src/index.js")],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  resolve: {
    // 프로젝트의 루트디렉토리를 설정
    modules: ["node_modules", path.resolve(__dirname, "src")],
    extensions: [".js"],
  },
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    contentBase: path.resolve(__dirname, "dist"),
    host: "0.0.0.0",
    port: 8888,
    compress: true,
    historyApiFallback: true,
    hot: true,
    inline: true,
    open: true,
    disableHostCheck: true,
  },
  node: {
    fs: "empty",
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "dev",
      template: path.resolve(__dirname, "src/index.html"),
      inject: true,
      origin: `http://localhost:8888/`,
    }),
    new CopyWebpackPlugin([{ from: "./src/style.css", to: "style.css" }]),
    new webpack.DefinePlugin({
      DEPLOYED_ADDRESS: JSON.stringify(fs.readFileSync("deployedAddress", "utf8").replace(/\n|\r/g, "")),
      DEPLOYED_ABI: fs.existsSync("deployedABI") && fs.readFileSync("deployedABI", "utf8"),
    }),
  ],
};
