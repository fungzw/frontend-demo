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
        alert('不能跟自己进行视频会话');
        return;
    }

    remoteUser = userName;
    sessionId = localUser + '_' + remoteUser
    await startChat();
}

let pc = null;

/**
 * 邀请用户加入视频聊天
 *  1、本地启动视频采集
 *  2、交换信令
 */
async function startChat() {
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
            if (device.kind == "videoinput" && device.deviceId) {
                // 挑出视频输入设备
                inputId.push(device.deviceId)
            }
        });

        if (inputId.length == 0) {
            console.error('无视频输入设备')
            return false
        }

        const localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: {
                    exact: inputId[0]
                }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        }).catch(function (e) {
            console.log('打开设备失败', e)
        })

        if (!localStream) {
            return false
        }

        // 开启本地视频
        const localVideo = document.getElementById('local-video');
        localMediaStream = localStream
        localVideo.srcObject = localMediaStream;
        console.log('startChat,localMediaStream', localMediaStream)

        // 创建 peerConnection
        createPeerConnection();

        // 将媒体流添加到webrtc的音视频收发器
        localMediaStream.getTracks().forEach(track => {
            console.log('pc add track', track)
            pc.addTrack(track, localMediaStream);
        });
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

function closePeerConnection() {
    if (this.pc) {
        this.pc.close();
        this.pc = null;
    }

    console.log('localMediaStream', localMediaStream)
    if (localMediaStream && localMediaStream.getTracks()) {
        localMediaStream.getTracks().forEach(function (track) {
            console.log('关闭track', track)
            track.stop();
        });
        localMediaStream = null;
    }

    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = null
    const remoteVideo = document.getElementById('remote-video');
    remoteVideo.srcObject = null

    const closeChat = document.getElementById('closeChat');
    closeChat.style.display = 'none';
}

async function handleReceiveOffer(data) {
    // 设置远端描述
    const remoteDescription = new RTCSessionDescription(data.description);
    remoteUser = data.from;
    createPeerConnection();
    await pc.setRemoteDescription(remoteDescription);

    // 本地音视频采集
    const localVideo = document.getElementById('local-video');
    localMediaStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    console.log('receive offer,open localmediastream', localMediaStream)
    localVideo.srcObject = localMediaStream;
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

async function handleReceiveAnswer(data) {
    const remoteDescription = new RTCSessionDescription(data.description);
    remoteUser = data.from;

    await pc.setRemoteDescription(remoteDescription);
}

async function handleReceiveCandidate(data) {
    await pc.addIceCandidate(data.candidate);
}

async function handleReceiveBye() {
    closePeerConnection()
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
    closePeerConnection()
}
