import {createApp} from './app.js';
const app=createApp(),port=Number(process.env.PORT||3002);
const server=app.listen(port,'127.0.0.1',()=>{console.log(`Omkoi: http://127.0.0.1:${port}`);app.locals.warm();});
server.on('error',error=>{console.error(error.message);process.exit(1);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{app.locals.close();server.close(()=>process.exit());});
