const path = require('path')
// 引入html-webpack-plugin插件
const HtmlWebpackPlugin = require('html-webpack-plugin')
// 引入clean-webpack-plugin插件
const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const toml = require('toml')
const yaml = require('yamljs')
const json5 = require('json5')

// package.json中scripts:
// webpack --watch可监听文件变化，并及时编译，缺陷是需要浏览器手动刷新
// webpack dev server 自动触发浏览器更新
module.exports = {
	mode: 'development', // 开发模式，用于调试问题
	// 第一种拆分：entry手动拆分缺陷
	// 如果入口 chunk 之间包含一些重复的模块，那些重复模块都会被引入到各个 bundle 中。例如print.js中也有lodash，也会集成到print.bundle.js
	// 这种方法不够灵活，并且不能动态地将核心应用程序逻辑中的代码拆分出来。
	//entry: {
	//	index: './src/index.js',
	//	print: './src/print.js' // 分模块js
	//},
	// 第二种拆分：手动拆分共享的shared，其他使用dependOn依赖，从而将lodash抽离到shared.bundle.js中
	//entry: {
	//	index: {
	//		import: './src/index.js',
	//		dependOn: 'shared'
	//	},
	//	print: {
	//		import: './src/print.js',
	//		dependOn: 'shared'
	//	},
	//	shared: 'lodash'
	//},
	// 第三种，使用智能拆分，智能抽取公共模块到shared.bundle.js
	// 使用SplitChunksPlugin
	// 第四种，是动态导入，import使用promise
	entry: {
		index: './src/index.js',
		print: './src/print.js'
	},
	// 第三种：智能抽取公共shared
	// optimization: {
	// 	splitChunks: {
	// 		chunks: 'all',
	// 	}
	// },
	plugins: [
		// build之前会自动清除dist目录
		new CleanWebpackPlugin(),
		// 自动生成index.html
		new HtmlWebpackPlugin({
			title: 'Output Management'
		})
	],
	devtool: 'inline-source-map', // 表示有错时，可以定位到源代码，而不是集成的bundle，便于排查问题
	//  live reloading(实时重新加载)
	devServer: {
		static: './dist' // 将dist目录serve到localhost:8080，产生dist目录的都会在内存中，实际dist目录暂时不会有文件信息
	},
	output: {
		// contenthash是根据内容进行散列，避免bundle名称
		filename: '[name].[contenthash].js', // 动态根据entry的key产生name，并生成相应的bundle js
		path: path.resolve(__dirname, 'dist'),
		clean: true, // 是否及时清理
		publicPath: '/'
	},
	module: {
		rules: [
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'] // 处理css样式的解析工具，顺序不可变
			},
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/i,
				type: 'asset/resource' // 作为静态资源
			},
			{
				test: /\.(woff|woff2|eot|ttf|otf)$/i,
				type: 'asset/resource' // 作为静态资源
			},
			{
				test: /\.(csv|tsv)$/i,
				use: ['csv-loader'] // csv处理器
			},
			{
				test: /\.xml$/i,
				use: ['xml-loader'] // xml处理器
			},
			{
				test: /\.toml$/i,
				type: 'json', // 作为json导入
				parser: {
					parse: toml.parse // 自定义toml解析器
				}
			},
			{
				test: /\.yaml$/i,
				type: 'json', // 作为json导入
				parser: {
					parse: yaml.parse // 自定义yaml解析器
				}
			},
			{
				test: /\.json5$/i,
				type: 'json', // 作为json导入
				parser: {
					parse: json5.parse // 自定义json5解析器
				}
			}
		]
	}
}