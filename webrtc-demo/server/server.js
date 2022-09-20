const express = require('express') //引入express模块
const path = require('path') //引入磁盘路径模块
const https = require('https') // https模块
const webSocket = require('./websocket') //引入ws服务器模块
const fs = require('fs') // 读取文件信息

const port = 3000 //常量端口
const app = express() // 创建express应用
app.use(express.static(path.resolve(__dirname, "../client"))) //设置要开启服务的路径

const options = {
    key: fs.readFileSync('./keys/server.key'),
    cert: fs.readFileSync('./keys/server.crt'),
    requestCert: true,
    rejectUnauthorized: false,
}

// 使用https，因为除本地访问外，网络摄像头需要https才能正常访问
const httpsServer = https.createServer(options, app)
webSocket.createWebSocket({server: httpsServer}) //创建Websocket服务器
httpsServer.listen(port, ()=> {
    console.log('https服务启动成功，端口：', port)
})
