const webpack = require("webpack");
const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
  },
  node: {
    fs: "empty",
  },
  resolve: {
    // 프로젝트의 루트디렉토리를 설정
    modules: [path.resolve(__dirname, "dist"), "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        loader: "url-loader",
        options: {
          limit: 10000,
          fallback: "file-loader",
          name: "[name].[ext]?[hash]",
          outputPath: "img",
          publicPath: "../img",
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      DEPLOYED_ADDRESS: JSON.stringify(fs.readFileSync("deployedAddress", "utf8").replace(/\n|\r/g, "")),
      DEPLOYED_ABI: fs.existsSync("deployedABI") && fs.readFileSync("deployedABI", "utf8"),
    }),
    new CopyWebpackPlugin([
      { from: "./src/index.html", to: "index.html" },
      { from: "./src/style.css", to: "style.css" },
    ]),
  ],
  devServer: { contentBase: path.join(__dirname, "dist"), compress: true },
};
