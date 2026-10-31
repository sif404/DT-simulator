// One process: authenticated internal MQTT client, restricted public WebSocket access, dashboard and twin services.
const crypto=require('crypto'),http=require('http'),fs=require('fs'),path=require('path');
const {URL}=require('url');
const {WebSocketServer,createWebSocketStream}=require('ws');
const {Aedes}=require('aedes');
const PORT=Number(process.env.PORT)||8080,PUB=path.resolve(__dirname,'../public');
const INTERNAL_USER='axn-internal';
const INTERNAL_PASSWORD=crypto.randomBytes(32).toString('hex');
const INTERNAL_CLIENT_ID='axn-int-'+crypto.randomBytes(8).toString('hex');
const PUBLIC_PUBLISH=new Set(['axn/cmd/stadium','axn/cmd/child','axn/cmd/clock','axn/cmd/safe','axn/consent/child1']);
const ALLOWED_ORIGINS=new Set((process.env.ALLOWED_ORIGINS||'https://sif404.github.io,http://localhost:8080,http://127.0.0.1:8080').split(',').map(x=>x.trim()).filter(Boolean));
const denied=()=>Object.assign(new Error('Not authorized'),{returnCode:5});
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const RATE=new Map(),RATE_WINDOW=5000,RATE_MAX=120;
let bus=null,connections=0;

function validPublicMessage(packet){
 if(packet.retain||!Buffer.isBuffer(packet.payload)||packet.payload.length>512)return false;
 let value;try{value=JSON.parse(packet.payload.toString('utf8'))}catch{return false}
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 switch(packet.topic){
  case 'axn/cmd/stadium':return Object.keys(value).length===1&&['normal','surge','ends','offline','whatif','emergency'].includes(value.v);
  case 'axn/cmd/child':return Object.keys(value).length===1&&['normal','leaves','crowded','lost'].includes(value.v);
  case 'axn/cmd/safe':return Object.keys(value).length===1&&value.v===1;
  case 'axn/consent/child1':return Object.keys(value).length===1&&typeof value.l==='boolean';
  case 'axn/cmd/clock':{
   const keys=Object.keys(value);
   return keys.length>0&&keys.every(k=>['sp','pl','seek'].includes(k))&&
    (value.sp===undefined||(Number.isFinite(value.sp)&&value.sp>=0.25&&value.sp<=8))&&
    (value.pl===undefined||typeof value.pl==='boolean')&&
    (value.seek===undefined||(Number.isFinite(value.seek)&&value.seek>=-100&&value.seek<=150));
  }
  default:return false;
 }
}
function rateAllowed(client){
 const now=Date.now(),key=client.id,old=(RATE.get(key)||[]).filter(t=>now-t<RATE_WINDOW);
 if(old.length>=RATE_MAX){RATE.set(key,old);return false}
 old.push(now);RATE.set(key,old);
 if(RATE.size>2000){for(const k of RATE.keys()){if(k!==key)RATE.delete(k);if(RATE.size<=1500)break}}
 return true;
}
function safeOrigin(origin,req){
 if(!origin)return true; // internal service-to-broker connection
 if(ALLOWED_ORIGINS.has(origin))return true;
 try{const u=new URL(origin);return (u.protocol==='https:'||u.protocol==='http:')&&u.host===req.headers.host}
 catch{return false}
}
function serve(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','SAMEORIGIN');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end('Method not allowed')}
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.statusCode=400;return res.end('Bad request')}
 if(pathname==='/healthz'){
  const ready=!!bus?.connected;res.statusCode=ready?200:503;res.setHeader('content-type','text/plain; charset=utf-8');return res.end(ready?'ok':'starting');
 }
 if(pathname==='/')pathname='/index.html';
 if(pathname.includes('\0')){res.statusCode=400;return res.end('Bad request')}
 const file=path.resolve(PUB,'.'+pathname);
 if(file!==PUB&&!file.startsWith(PUB+path.sep)){res.statusCode=404;return res.end('Not found')}
 let stat;try{stat=fs.statSync(file)}catch{}
 if(!stat||!stat.isFile()){res.statusCode=404;return res.end('Not found')}
 res.setHeader('Content-Type',TYPES[path.extname(file).toLowerCase()]||'application/octet-stream');
 res.setHeader('Cache-Control',pathname.endsWith('.html')||pathname.endsWith('config.js')?'no-store':'public, max-age=300');
 res.statusCode=200;if(req.method==='HEAD')return res.end();
 const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.statusCode=500;res.end('Server error')});stream.pipe(res);
}
async function start(){
 const aedes=await Aedes.createBroker({drainTimeout:60000});
 aedes.authenticate=(client,username,password,callback)=>{
  const supplied=Buffer.isBuffer(password)?password:Buffer.from(password||'');
  const expected=Buffer.from(INTERNAL_PASSWORD);
  const internal=username===INTERNAL_USER&&supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);
  const anonymous=!username&&!password;
  if(internal||anonymous)return callback(null,true);
  callback(denied(),false);
 };
 aedes.authorizePublish=(client,packet,callback)=>{
  if(client&&client.id===INTERNAL_CLIENT_ID)return callback(null);
  if(!client||!PUBLIC_PUBLISH.has(packet.topic)||!validPublicMessage(packet)||!rateAllowed(client))return callback(denied());
  callback(null);
 };
 aedes.authorizeSubscribe=(client,subscription,callback)=>{
  if(client&&client.id===INTERNAL_CLIENT_ID)return callback(null,subscription);
  if(subscription.topic==='axn/twin/state'&&subscription.qos===0)return callback(null,subscription);
  callback(null,null);
 };
 aedes.on('clientDisconnect',client=>RATE.delete(client.id));
 const server=http.createServer({maxHeaderSize:8192},serve);
 server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;
 server.on('clientError',(err,socket)=>{if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')});
 const wss=new WebSocketServer({server,maxPayload:8192,perMessageDeflate:false,verifyClient:(info,done)=>{
  if(connections>=200)return done(false,503,'Server busy');
  if(!safeOrigin(info.origin,info.req))return done(false,403,'Origin not allowed');
  done(true);
 }});
 wss.on('connection',(ws,req)=>{
  connections++;ws.once('close',()=>{connections=Math.max(0,connections-1)});
  ws.on('error',err=>console.warn('WebSocket error:',err.message));
  aedes.handle(createWebSocketStream(ws),req);
 });
 server.listen(PORT,()=>{
  console.log('Dashboard + restricted MQTT/WebSocket on port '+PORT);
  bus=require('./bus')('ws://127.0.0.1:'+PORT,{username:INTERNAL_USER,password:INTERNAL_PASSWORD,clientId:INTERNAL_CLIENT_ID,clean:true,connectTimeout:5000,reconnectPeriod:1000,keepalive:30});
  require('./twin')(bus);require('./sim')(bus);
 });
}
start().catch(err=>{console.error('Startup failed:',err);process.exit(1)});
