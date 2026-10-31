// One process: authenticated internal MQTT client, restricted public WebSocket access, dashboard and twin services.
const crypto=require('crypto'),http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer,createWebSocketStream}=require('ws');
const aedes=require('aedes')(),PORT=process.env.PORT||8080,PUB=path.join(__dirname,'../public');
const INTERNAL_USER='axn-internal';
const INTERNAL_PASSWORD=crypto.randomBytes(32).toString('hex');
const INTERNAL_CLIENT_ID='axn-internal-'+crypto.randomBytes(16).toString('hex');
const PUBLIC_PUBLISH=new Set(['axn/cmd/stadium','axn/cmd/child','axn/cmd/clock','axn/cmd/safe','axn/consent/child1']);
const denied=()=>new Error('Not authorized');

aedes.authenticate=(client,username,password,callback)=>{
 const supplied=Buffer.isBuffer(password)?password:Buffer.from(password||'');
 const expected=Buffer.from(INTERNAL_PASSWORD);
 const internal=username===INTERNAL_USER&&supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
 const anonymous=!username&&!password;
 if(internal||anonymous)return callback(null,true);
 const error=denied();error.returnCode=5;callback(error,false);
};
aedes.authorizePublish=(client,packet,callback)=>{
 if(client&&client.id===INTERNAL_CLIENT_ID)return callback(null);
 if(!client)return callback(null);
 if(PUBLIC_PUBLISH.has(packet.topic)&&!packet.retain)return callback(null);
 callback(denied());
};
aedes.authorizeSubscribe=(client,subscription,callback)=>{
 if(client&&client.id===INTERNAL_CLIENT_ID)return callback(null,subscription);
 if(subscription.topic==='axn/twin/state'&&subscription.qos===0)return callback(null,subscription);
 callback(null,null);
};

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(PUB,path.normalize(p));if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end('Not found')}
 r.setHeader('content-type',TYPES[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f))});
new WebSocketServer({server}).on('connection',(ws,req)=>aedes.handle(createWebSocketStream(ws),req));
server.listen(PORT,()=>{console.log('Dashboard + restricted MQTT/WebSocket on port '+PORT);
 setTimeout(()=>{const bus=require('./bus')('ws://127.0.0.1:'+PORT,{username:INTERNAL_USER,password:INTERNAL_PASSWORD,clientId:INTERNAL_CLIENT_ID,clean:true});require('./twin')(bus);require('./sim')(bus)},400)});
