import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Config separada de propósito: o plugin crxjs reescreve entradas de extensão
// e não tem nada a fazer numa suíte de testes de lógica pura.
export default defineConfig({
  resolve: {
    // Precisa espelhar o alias do vite.config.ts, senão testes que importam
    // por "@/..." quebram enquanto o build passa.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
