// Twin service: state, decisions, alerts. No child coordinates are published when consent is off.
module.exports=bus=>{const WK={A:3,B:5,C:4,D:6,E:4},POS={A:[400,56],B:[734,250],C:[400,444],D:[66,250],E:[630,100]},now=Date.now,T={g:{},h:{},env:{t:31,h:38,aqi:62,db:78},v:{mode:'normal',visitors:0,cap:45e3,park:0},kid:null,con:false,safe:false,ev:[],prev:new Set(),cool:{}};
const ev=(c,p)=>{T.ev.unshift({t:now(),c,p});T.ev.length=Math.min(T.ev.length,20)};
bus.sub('axn/#',(x,b)=>{const m=JSON.parse(b),p=x.split('/');
if(p[1]=='sim'){if(p[2]=='gate'){const g=p[3],h=T.h[g]??=[];if(h.length>=10){const q=h.slice(-20),mu=q.reduce((a,v)=>a+v,0)/q.length,sd=Math.sqrt(q.reduce((a,v)=>a+(v-mu)**2,0)/q.length),z=(m.flow-mu)/Math.max(sd,4);if(z>2.5&&(T.cool[g]||0)<now()-2e4){T.cool[g]=now();ev('an',{g,z:z.toFixed(1)})}}h.push(m.flow);if(h.length>30)h.shift();T.g[g]=m}else if(p[2]=='env')T.env=m;else if(p[2]=='venue')T.v=m;else if(p[2]=='child'){if(T.con)T.kid=m}}
else if(p[1]=='consent'){T.con=!!m.l;if(!T.con)T.kid=null;ev(T.con?'con':'coff',{})}else if(x=='axn/cmd/stadium'){ev('scn',{v:m.v});if(m.v=='emergency')T.safe=false}else if(x=='axn/cmd/child')ev('cscn',{v:m.v});else if(x=='axn/cmd/safe'){T.safe=true;ev('safe',{});bus.pub('axn/cmd/stadium',{v:'normal'})}});
setInterval(()=>{const g={},al=[];let best=null;
for(const n of'ABCD'){const r=T.g[n],age=r?(now()-r.ts)/1e3:99,st=age<4?'ok':'bad',f=r?r.flow:0,x=f/120,lv=x<.45?'Low':x<.75?'Moderate':'Heavy';g[n]={flow:f,age:Math.round(age),ok:st=='ok',lv,eta:st=='ok'?Math.round(WK[n]+14*Math.min(1,x)):null};if(st=='ok'&&(!best||g[n].eta<g[best].eta))best=n}
for(const n in g){if(g[n].ok&&g[n].lv=='Heavy')al.push({k:'h'+n,sev:'w',c:'heavy',g:n,p:{g:n,alt:best,eta:g[best]?.eta}});if(!g[n].ok)al.push({k:'s'+n,sev:'w',c:'stale',g:n,p:{g:n,age:g[n].age}})}
if(T.v.visitors/T.v.cap>=.98)al.push({k:'f',sev:'e',c:'full',p:{}});
let kid={con:T.con};if(T.con&&T.kid){const k=T.kid,age=Math.round((now()-k.ts)/1e3),on=age<5,ins=Math.hypot(k.x-400,k.y-395)<62;let ng='A',nd=1e9;for(const n of T.v.mode=='whatif'?'ABCDE':'ABCD'){const q=Math.hypot(k.x-POS[n][0],k.y-POS[n][1]);if(q<nd){nd=q;ng=n}}
kid={con:true,x:k.x,y:k.y,age,on,ins,near:ng};if(!on)al.push({k:'kl',sev:'w',c:'kloss',g:'kid',p:{age}});else{if(!ins)al.push({k:'kz',sev:'e',c:'kz',g:'kid',p:{}});if(nd<90&&g[ng]?.lv=='Heavy')al.push({k:'kh',sev:'e',c:'kheavy',g:ng,p:{g:ng}})}}
const evac=T.v.mode=='emergency'&&!T.safe?{g:best,eta:g[best]?.eta,p:kid.near||best}:null,wi=T.v.mode=='whatif'?{from:g.B.flow,to:Math.round(g.B.flow*.62),saved:Math.max(0,Math.round(14*g.B.flow*.38/120))}:null;
const ids=new Set(al.map(a=>a.k));al.forEach(a=>{if(!T.prev.has(a.k))ev(a.c,a.p)});T.prev=ids;
bus.pub('axn/twin/state',{ts:now(),mode:T.v.mode,gates:g,best,env:T.env,v:T.v,kid,alerts:al,ev:T.ev,evac,wi,safe:T.safe},1)},1e3);};
