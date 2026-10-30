import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  base:process.env.VITE_PAGES==='true'?(process.env.VITE_BASE_PATH||'./'):'/',
  plugins:[vue()],
  server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/api':'http://127.0.0.1:3002'}},
});
