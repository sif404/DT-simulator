// One process: MQTT broker (tcp + websocket on the same HTTP port), static dashboard, simulator and twin service.
const net=require('net'),http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer,createWebSocketStream}=require('ws');
const aedes=require('aedes')(),PORT=process.env.PORT||8080,TCP=process.env.MQTT_TCP||1883,PUB=path.join(__dirname,'../public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(PUB,path.normalize(p));if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end('Not found')}
 r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))});
new WebSocketServer({server}).on('connection',(ws,req)=>aedes.handle(createWebSocketStream(ws),req));
net.createServer(aedes.handle).on('error',()=>{}).listen(TCP);
server.listen(PORT,()=>{console.log('Dashboard + MQTT/WebSocket on http://localhost:'+PORT);
 setTimeout(()=>{const bus=require('./bus')('mqtt://127.0.0.1:'+TCP);require('./twin')(bus);require('./sim')(bus)},400)});
