const express = require("express"); //引入express模块
const path = require("path"); //引入磁盘路径模块
const app = express();
var https = require('https');
const port = 3000; //端口
const host = "127.0.0.1"; //主机

const webSocket = require("ws"); //引入ws服务器模块

const ws = new webSocket.Server({port: 8000}); //创建Websocket服务器,端口为8000
let clientList = [];
let clientNum = 0;

// 使用https，因为网络摄像头需要https才能正常访问
var httpsServer = https.createServer(app);
app.use(express.static(path.resolve(__dirname, "./client"))); //设置要开启服务的路径

function send(client, msg) {
    client.send(msg)
    console.log('send client:' + client.userName + ', msg:' + msg)
}

//广播方法
function broadcast(msg) {
    for (const key in clientList) {
        send(clientList[key], msg)
    }
}

function getOnlineUser() {
    const onlineList = []
    for (const key in clientList) {
        onlineList.push({
            userName: clientList[key].userName
        })
    }

    return onlineList
}

// 客户端主动链接服务的，链接TCP信息
ws.on("connection", (client, req) => {

    //给客户端编号,也就是参与聊天的用户
    client.userName = ++clientNum;
    // 将客户端存起来
    clientList[client.userName] = client;

    // 前端需要知道自己的id序号
    const loginMsg = JSON.stringify({type: 'login', data: client.userName})
    send(client, loginMsg)

    // 广播给大家
    const broadcastMsg = JSON.stringify({type: 'online', data: getOnlineUser()})
    broadcast(broadcastMsg)

    // 接收用户发来的信息并处理
    client.on("message", (msg) => {
        const jsonObj = JSON.parse(msg);
        switch (jsonObj.type) {
            case 'offer':
            case 'answer':
            case 'candidate':
                // 不能直接使用msg来send，可能会变为二进制
                send(clientList[jsonObj.data.to], JSON.stringify(jsonObj))
                break;
            default:
                break;
        }
    });
    //报错信息
    client.on("error", (err) => {
        if (err) {
            console.log(err);
        }
    });
    // 下线
    client.on("close", () => {
        delete clientList[client.userName];
        console.log("client" + client.userName + "down~~");
    });
});

httpsServer.listen(3000);
