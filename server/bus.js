// Trusted simulator/twin bus using Aedes in-process pub/sub.
// Browser clients still connect over MQTT/WebSocket; server-side traffic never
// loops through a second MQTT socket, avoiding needless reconnect/parser failures.
module.exports=(aedes)=>{
 const H=[];
 let connected=false;
 aedes.subscribe('axn/#',(packet,done)=>{
  const topic=packet.topic,payload=packet.payload.toString();
  for(const [pattern,handler] of H){
   const matches=pattern.endsWith('/#') ? topic.startsWith(pattern.slice(0,-1)) : pattern===topic;
   if(matches){
    try{handler(topic,payload)}catch(err){console.error('Twin handler error:',err.message)}
   }
  }
  done();
 },err=>{
  if(err)console.error('Twin bus subscription failed:',err);
  else{connected=true;console.log('In-process twin bus ready')}
 });
 return{
  get connected(){return connected},
  pub:(topic,value,retain=false)=>{
   aedes.publish({cmd:'publish',topic,payload:Buffer.from(JSON.stringify(value)),qos:0,retain:!!retain},err=>{
    if(err)console.error('Twin publish error:',err.message);
   });
  },
  sub:(pattern,handler)=>{H.push([pattern,handler])}
 };
};
