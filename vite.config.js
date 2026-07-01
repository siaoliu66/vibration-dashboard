import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/vibration-dashboard/'   // 加這行，名稱要跟你的 repo 名稱一樣
});