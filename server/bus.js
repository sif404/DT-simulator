// Same pub/sub API the dashboard uses, over a real MQTT connection.
const mqtt=require('mqtt');
module.exports=(url,options={})=>{
 const c=mqtt.connect(url,options),H=[],m=(p,x)=>p.endsWith('/#')?x.startsWith(p.slice(0,-1)):p===x;
 let connected=false;
 c.on('connect',()=>{connected=true;c.subscribe('axn/#')});
 c.on('close',()=>{connected=false});
 c.on('error',err=>console.error('MQTT client error:',err.message));
 c.on('message',(t,b)=>{const s=b.toString();H.forEach(([p,f])=>m(p,t)&&f(t,s))});
 return{get connected(){return connected},pub:(x,o,r)=>c.publish(x,JSON.stringify(o),{retain:!!r}),sub:(p,f)=>{H.push([p,f])}};
};
