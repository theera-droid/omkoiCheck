import {createApp} from './app.js';
const app=createApp(),port=Number(process.env.PORT||3002);
const host=process.env.HOST||'127.0.0.1';
const server=app.listen(port,host,()=>{console.log(`Omkoi: http://${host}:${port}`);app.locals.warm();});
server.on('error',error=>{console.error(error.message);process.exit(1);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.locals.close();server.close(()=>process.exit());});
