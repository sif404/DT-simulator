// Same pub/sub API the dashboard uses, over a real MQTT connection.
const mqtt=require('mqtt');
module.exports=url=>{const c=mqtt.connect(url),H=[],m=(p,x)=>p.endsWith('/#')?x.startsWith(p.slice(0,-1)):p===x;
 c.on('connect',()=>c.subscribe('axn/#'));
 c.on('message',(t,b)=>{const s=b.toString();H.forEach(([p,f])=>m(p,t)&&f(t,s))});
 return{pub:(x,o,r)=>c.publish(x,JSON.stringify(o),{retain:!!r}),sub:(p,f)=>{H.push([p,f])}}};
