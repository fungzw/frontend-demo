const ws = new WebSocket("ws://127.0.0.1:8000"); //连接到客户端
 
//上线
ws.onopen = () => {
  ws.send("hello i'm on line");
};
// 接收消息
ws.onmessage = (msg) => {
  const content = document.getElementById("content");
  content.innerHTML += msg.data + "<br>";
};
//error
ws.onerror = (err) => {
  console.log(err);
};
 
//下线
ws.onclose = () => {
  console.log("close");
};