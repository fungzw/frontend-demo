const express = require("express"); //引入express模块
const path = require("path"); //引入磁盘路径模块
const app = express();
const port = 3000; //端口
const host = "127.0.0.1"; //主机

const webSocket = require("ws"); //引入ws服务器模块


const ws = new webSocket.Server({ port: 8000 }); //创建Websocket服务器,端口为8000
let clients = {};
let clientNum = 0;

app.use(express.static(path.resolve(__dirname, "./"))); //设置要开启服务的路径

// 客户端主动链接服务的，链接TCP信息
ws.on("connection", (client) => {
  //给客户端编号,也就是参与聊天的用户
  client.name = ++clientNum;
  // 将客户端存起来
  clients[client.name] = client;
 
  // 接收用户发来的信息并处理
  client.on("message", (msg) => {
    console.log("client" + client.name + "say:" + msg);
    //广播数据发送输出
    broadcast(client, msg);
  });
  //报错信息
  client.on("error", (err) => {
    if (err) {
      console.log(err);
    }
  });
  // 下线
  client.on("close", () => {
    delete clients[client.name];
    console.log("client" + client.name + "down~~");
  });
});
 
//广播方法
function broadcast(client, msg) {
  for (var key in clients) {
    clients[key].send("client" + client.name + "say：" + msg);
  }
}

app.listen(port, host, () => {
  //本身express监听服务
  console.log(`客户端服务器为:http://${host}:${port}`);
});