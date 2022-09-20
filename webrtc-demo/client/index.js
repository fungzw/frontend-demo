createWs(null, msgCallback, null, null)

let localUser = ''
let remoteUser = ''
let sessionId = ''
let localMediaStream = null

/**
 * 更新用户列表
 * @param {Array} users
 */
function updateUserList(users) {
    const fragment = document.createDocumentFragment();
    const userList = document.getElementById('login-users');
    userList.innerHTML = '';

    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = user.userName;
        li.setAttribute('data-name', user.userName);
        li.addEventListener('click', handleUserClick);
        fragment.appendChild(li);
    });

    userList.appendChild(fragment);
}

// 点击用户列表
async function handleUserClick(evt) {
    const target = evt.target;
    const userName = target.getAttribute('data-name').trim();

    if (userName + '' === localUser + '') {
        showMessage('不能跟自己进行视频会话')
        return;
    }

    remoteUser = userName;
    sessionId = localUser + '_' + remoteUser
    await startChat();
}

let pc = null;

/**
 * 开启本地视频
 * @returns {Promise<boolean>}
 */
async function openVideo() {
    // 检查是否支持navigator.mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('不支持 getUserMedia 功能！');
        return false;
    } else {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(function (e) {
            console.error('设备打开失败', e)
        })

        if (!devices) {
            return false;
        }

        const inputId = [];
        devices.forEach(function (device) {
            // 有可能因为权限问题，导致deviceId是空的，导致整体inputId为空
            if (device.kind == "videoinput" && device.deviceId) {
                // 挑出视频输入设备
                inputId.push(device.deviceId)
            }
        });
        let videoCfg = true
        if (inputId.length != 0) {
            // 当找到有deviceId的videoInput时，直接声明使用它
            videoCfg = {
                deviceId: {
                    exact: inputId[0]
                }
            }
        }

        const localStream = await navigator.mediaDevices.getUserMedia({
            video: videoCfg,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        }).catch(function (e) {
            showMessage('打开设备失败')
        })

        if (!localStream) {
            return false
        }

        // 开启本地视频
        const localVideo = document.getElementById('local-video');
        localMediaStream = localStream
        localVideo.srcObject = localMediaStream;

        return true
    }
}

/**
 * 关闭本地视频
 */
function closeVideo() {
    if (localMediaStream) {
        if (localMediaStream && localMediaStream.getTracks()) {
            localMediaStream.getTracks().forEach(function (track) {
                track.stop();
            });
            localMediaStream = null;
        }
    }

    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = null
    const remoteVideo = document.getElementById('remote-video');
    remoteVideo.srcObject = null

    const closeChat = document.getElementById('closeChat');
    closeChat.style.display = 'none';
}

/**
 * 邀请用户加入视频聊天
 *  1、本地启动视频采集
 *  2、交换信令
 */
async function startChat() {
    const opened = await openVideo()

    if (opened) {
        // 创建 peerConnection
        createPeerConnection();

        // 将媒体流添加到webrtc的音视频收发器
        localMediaStream.getTracks().forEach(track => {
            pc.addTrack(track, localMediaStream);
        });

        // 本地视频流打开之后，就可以显示关闭通话的按钮
        const closeChat = document.getElementById('closeChat');
        closeChat.style.display = 'inline';
    } else {
        showMessage('开启通话失败')
    }
}

function createPeerConnection() {
    pc = new RTCPeerConnection();

    pc.onnegotiationneeded = onnegotiationneeded;
    pc.onicecandidate = onicecandidate;
    pc.ontrack = ontrack;

    return pc;
}

async function onnegotiationneeded() {
    console.log('after add track, on negotiationneeded,so create offer')
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const msg = {
        type: 'offer',
        data: {
            from: localUser,
            to: remoteUser,
            session_id: sessionId,
            description: offer // offer结构{type:'offer', sdp: sdp}
        }
    }

    sendWs(JSON.stringify(msg))
}

function onicecandidate(evt) {
    if (evt.candidate) {
        console.log('client candidate')
        const msg = {
            type: 'candidate',
            data: {
                from: localUser,
                to: remoteUser,
                session_id: sessionId,
                candidate: evt.candidate // evt结构：{sdpMid:xxx,sdpMLineIndex:xxx,candidate:xxx}
            }
        }

        sendWs(JSON.stringify(msg))
    }
}

// 调用 pc.addTrack(track, mediaStream)，remote peer的 onTrack 会触发两次
// 实际上两次触发时，evt.streams[0] 指向同一个mediaStream引用
// 这个行为有点奇怪，github issue 也有提到 https://github.com/meetecho/janus-gateway/issues/1313
let stream;

function ontrack(evt) {
    const remoteVideo = document.getElementById('remote-video');
    remoteVideo.srcObject = evt.streams[0];

    const closeChat = document.getElementById('closeChat');
    closeChat.style.display = 'inline';
}

function endChat() {
    closePeerConnection()
    closeVideo()
}

function closePeerConnection() {
    if (pc) {
        pc.close();
        pc = null;
    }
}

async function handleReceiveOffer(data) {
    // 先判断能否开启本地视频
    const opened = await openVideo()
    if (opened) {
        // 设置远端描述
        const remoteDescription = new RTCSessionDescription(data.description);
        remoteUser = data.from;
        createPeerConnection();
        await pc.setRemoteDescription(remoteDescription);

        localMediaStream.getTracks().forEach(track => {
            pc.addTrack(track, localMediaStream);
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const wantMsg = {
            type: 'answer',
            data: {
                from: localUser,
                to: remoteUser,
                session_id: sessionId,
                description: answer // answer结构也是{type:'answer',sdp:sdp}
            }
        }

        sendWs(JSON.stringify(wantMsg))
    }
}

async function handleReceiveAnswer(data) {
    const remoteDescription = new RTCSessionDescription(data.description);
    remoteUser = data.from;

    await pc.setRemoteDescription(remoteDescription);
}

async function handleReceiveCandidate(data) {
    if (pc) {
        await pc.addIceCandidate(data.candidate);
    }
}

async function handleReceiveBye() {
    endChat()
}

// 接收消息
function msgCallback(jsonMsg) {
    switch (jsonMsg.type) {
        case 'login':
            localUser = jsonMsg.data
            document.getElementById('login-name').innerHTML = localUser
            break;
        case 'online':
            updateUserList(jsonMsg.data)
            break;
        case 'offer':
            handleReceiveOffer(jsonMsg.data)
            break;
        case 'answer':
            handleReceiveAnswer(jsonMsg.data)
            break;
        case 'candidate':
            handleReceiveCandidate(jsonMsg.data)
            break;
        case 'bye':
            handleReceiveBye(jsonMsg.data)
            break;
        default:
            break;
    }
}

document.getElementById('closeChat').onclick = function () {
    const msg = {
        type: 'bye',
        data: {
            from: localUser,
            to: remoteUser,
            session_id: sessionId
        }
    }

    sendWs(JSON.stringify(msg))
    endChat()
}

let msgTime = null;
function showMessage(msg) {
    document.getElementById('msg').innerHTML = msg
    document.getElementById('msg').style.display = 'block'

    if (msgTime) {
        clearTimeout(msgTime)
        msgTime = null
    }

    msgTime = setTimeout(function (){
        document.getElementById('msg').style.display = 'none'
    }, 2000)
}
