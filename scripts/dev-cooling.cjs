'use strict';
// Separate data and port; never starts the installed OpenRGB or changes its settings.
const path=require('node:path'),fs=require('node:fs');
const {createApp}=require('../server');
async function main(){
  const args=process.argv.slice(2),hardware=args.includes('--hardware');
  if(args.some((a,i)=>!['--simulate','--hardware','--port','--data','--supervised'].includes(a)&&!['--port','--data'].includes(args[i-1])))throw Error('Argumento de desenvolvimento inválido.');
  if(hardware&&args.includes('--simulate'))throw Error('Escolha hardware ou simulação.');
  const value=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
  const localPort=value('--port')===null?5151:Number(value('--port'));
  if(!Number.isInteger(localPort)||localPort<0||localPort>65535)throw Error('Porta de desenvolvimento inválida.');
  const directory=path.resolve(value('--data')||path.join(__dirname,'../data/cooling-dev/app'));
  fs.mkdirSync(directory,{recursive:true});
  const app=await createApp({directory,localPort,listenHost:'127.0.0.1',disableHardware:true,disableAlexa:true,disableWelcome:true,
    cooling:{simulated:!hardware,allowHardware:hardware}});
  let stopping=false;
  const stop=async()=>{if(stopping)return;stopping=true;await app.stop();process.exit(0);};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  if(args.includes('--supervised')){process.stdin.setEncoding('utf8');process.stdin.on('data',text=>{if(text.includes('shutdown'))stop();});process.stdin.on('end',stop);}
  const ports=await app.start();
  console.log(JSON.stringify({development:true,simulated:!hardware,url:'http://127.0.0.1:'+ports.localPort,port:ports.localPort,pid:process.pid}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
