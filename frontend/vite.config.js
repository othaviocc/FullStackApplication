import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta usada no desenvolvimento local (fora do Docker).
    host: true,
    port: 3000,
    // Em dev o Vite repassa /api para o container do backend, assim o
    // navegador enxerga tudo na mesma origem e nao esbarra em CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
