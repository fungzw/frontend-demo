let ws

function createWs(openCallback, msgCallback, errorCallback, closeCallback) {
    // 连接到客户端
    ws = new WebSocket("wss://"+ window.location.host);
    // 上线
    ws.onopen = () => {
        if (openCallback) {
            openCallback()
        } else {
            console.log('ws opened')
        }
    }
    // 接收消息
    ws.onmessage = (msg) => {
        msgCallback(JSON.parse(msg.data))
    }
    //error
    ws.onerror = (err) => {
        if (errorCallback) {
            errorCallback(err)
        } else {
            console.log('ws error', err)
        }
    }

    //下线
    ws.onclose = () => {
        if (closeCallback) {
            closeCallback()
        } else {
            console.log('ws closed')
        }
    }
}

function sendWs(msg) {
    console.log('send msg', msg)
    ws.send(msg)
}
