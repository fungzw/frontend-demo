const ws = new WebSocket("ws://127.0.0.1:8000"); //连接到客户端

let localUser = ''
let remoteUser = ''

/**
 * 更新用户列表
 * @param {Array} users 用户列表，比如 [{name: '小明', name: '小强'}]
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

  if (userName === localUser) {
    alert('不能跟自己进行视频会话');
    return;
  }

  remoteUser = userName;
  await startVideoTalk(remoteUser);
}

let pc = null;

/**
 * 邀请用户加入视频聊天
 *  1、本地启动视频采集
 *  2、交换信令
 */
async function startVideoTalk() {
  // 开启本地视频
  const localVideo = document.getElementById('local-video');
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = mediaStream;

  // 创建 peerConnection
  createPeerConnection();

  // 将媒体流添加到webrtc的音视频收发器
  mediaStream.getTracks().forEach(track => {
    pc.addTrack(track, mediaStream);
  });
}

function createPeerConnection() {
  pc = new RTCPeerConnection();

  pc.onnegotiationneeded = onnegotiationneeded;
  pc.onicecandidate = onicecandidate;
  pc.ontrack = ontrack;

  return pc;
}

async function onnegotiationneeded() {
  console.log('client create offer')
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const msg = {
    type: 'offer',
    data: {
      from: localUser,
      to: remoteUser,
      session_id: localUser + '_' + remoteUser,
      description: offer // offer结构{type:'offer', sdp: sdp}
    }
  }
  console.log(JSON.stringify(msg))
  ws.send(JSON.stringify(msg))
}

function onicecandidate(evt) {
  if (evt.candidate) {
    console.log('client candidate')
    const msg = {
      type: 'candidate',
      data: {
        from: localUser,
        to: remoteUser,
        session_id: localUser + '_' + remoteUser,
        candidate: {
          sdpMid: evt.candidate.sdpMid,
          sdpMLineIndex: evt.candidate.sdpMLineIndex,
          candidate: evt.candidate.candidate
        }
      }
    }

    console.log(JSON.stringify(msg))
    ws.send(JSON.stringify(msg))
  }
}

// 调用 pc.addTrack(track, mediaStream)，remote peer的 onTrack 会触发两次
// 实际上两次触发时，evt.streams[0] 指向同一个mediaStream引用
// 这个行为有点奇怪，github issue 也有提到 https://github.com/meetecho/janus-gateway/issues/1313
let stream;
function ontrack(evt) {
  const remoteVideo = document.getElementById('remote-video');
  remoteVideo.srcObject = evt.streams[0];
}

async function handleReceiveOffer(data) {
  // 设置远端描述
  const remoteDescription = new RTCSessionDescription(data.description);
  remoteUser = data.from;
  createPeerConnection();
  await pc.setRemoteDescription(remoteDescription);

  // 本地音视频采集
  const localVideo = document.getElementById('local-video');
  const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = mediaStream;
  mediaStream.getTracks().forEach(track => {
    pc.addTrack(track, mediaStream);
  });

  const answer = await pc.createAnswer(); // TODO 错误处理
  await pc.setLocalDescription(answer);
  const wantMsg = {
    type: 'answer',
    data: {
      from: localUser,
      to: remoteUser,
      session_id: localUser + '_' + remoteUser,
      description: answer // answer结构也是{type:'answer',sdp:sdp}
    }
  }
  console.log(JSON.stringify(wantMsg))
  ws.send(JSON.stringify(wantMsg))
}

async function handleReceiveAnswer(data) {
  const remoteDescription = new RTCSessionDescription(data.description);
  remoteUser = data.from;

  await pc.setRemoteDescription(remoteDescription);
}

async function handleReceiveCandidate(data){
  await pc.addIceCandidate(data.candidate);
}

//上线
ws.onopen = () => {

};
// 接收消息
ws.onmessage = (msg) => {
  console.log('client receive', msg.data)
  const jsonMsg = JSON.parse(msg.data)
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
    default:
      break;
  }
};
//error
ws.onerror = (err) => {
  console.log(err);
};

//下线
ws.onclose = () => {
  console.log("close");
};
