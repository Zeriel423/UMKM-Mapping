import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mengaktifkan transformasi JSX dan Fast Refresh untuk aplikasi React.
export default defineConfig({
  plugins: [react()],
})
