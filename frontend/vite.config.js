import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react({
      // Babelを強制的に使用してesbuildのJSX処理を回避
      babel: {
        plugins: [],
      },
      // 全JSXファイルをBabelで処理
      include: ['**/*.jsx', '**/*.tsx'],
    }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // esbuildのJSXトランスフォームを無効化
    rollupOptions: {},
  },
  esbuild: {
    // JSXファイルはreact()プラグイン（Babel）が処理するため
    // esbuildにJSX処理をさせない
    include: /\.(ts|js)$/,
    exclude: /\.(tsx|jsx)$/,
  },
})
