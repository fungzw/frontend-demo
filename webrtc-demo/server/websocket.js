const webSocket = require("ws"); //引入ws服务器模块

const clientList = []
let clientNum = 0

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

function createWebSocket(options) {
    const ws = new webSocket.Server(options);
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
                case 'bye':
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
}

module.exports = {createWebSocket}
